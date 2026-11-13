const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const tmi = require('tmi.js');
const cardDraw = require('./lib/cardDraw');
const collectionLib = require('./lib/collections');
const twitchDirectAuth = require('./lib/twitchDirectAuth');
const dimandusHttp = require('./lib/dimandusHttp');
const { clampTwitchMessage } = require('./lib/twitchChatLimit');
const backupLib = require('./lib/backup');

const isDev = process.env.NODE_ENV === 'development';
const APP_VERSION = (() => {
  try {
    return require('../package.json').version;
  } catch (e) {
    return '0.0.0';
  }
})();
const TWITCH_SCOPES = 'chat:read chat:edit channel:bot moderator:manage:banned_users user:write:chat';

// Overlay server management: start with the app and stop on quit.
// In dev: spawn a child `node overlay-server.js` so it runs while app runs.
// In prod: require the bundled script so it runs inside main process; call its stop() on quit if available.
let overlayChild = null;
let overlayModule = null;

function startOverlayServer() {
  const overlayServerPathDev = path.join(__dirname, '..', 'overlay-server.js');
  const unpackedProdPath = path.join(process.resourcesPath || __dirname, 'app.asar.unpacked', 'overlay-server.js');
  const packagedPath = path.join(__dirname, '..', 'overlay-server.js');

  if (isDev) {
    try {
      const { spawn } = require('child_process');
      const overlayPort = String(getOverlaySettings().port);
      overlayChild = spawn(process.execPath, [overlayServerPathDev], {
        stdio: 'inherit',
        detached: false,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', OVERLAY_PORT: overlayPort },
      });
      overlayChild.on('exit', (code, signal) => {
        console.log('overlay child exited', code, signal);
        overlayChild = null;
      });
      console.log('✅ Overlay server spawned (dev) from', overlayServerPathDev);
    } catch (e) {
      console.error('❌ Не удалось запустить overlay в dev:', e && e.message ? e.message : e);
    }
  } else {
    // production: try require from app.asar, fallback to unpacked
    try {
      const existsPack = fs.existsSync(packagedPath);
      if (existsPack) {
        process.env.OVERLAY_PORT = String(getOverlaySettings().port);
        overlayModule = require(packagedPath);
        console.log('✅ Встроенный overlay-server запущен из', packagedPath);
        return;
      }
    } catch (e) {
      console.error('❌ Не удалось require overlay from packaged path:', e && e.message ? e.message : e);
    }

    try {
      if (fs.existsSync(unpackedProdPath)) {
        process.env.OVERLAY_PORT = String(getOverlaySettings().port);
        overlayModule = require(unpackedProdPath);
        console.log('✅ Встроенный overlay-server запущен из unpacked:', unpackedProdPath);
      } else {
        console.warn('⚠️ unpacked overlay-server не найден по пути:', unpackedProdPath);
      }
    } catch (e2) {
      console.error('❌ Попытка запустить unpacked overlay-server также не удалась:', e2 && e2.message ? e2.message : e2);
    }
  }
}

function stopOverlayServer() {
  try {
    if (overlayChild && !overlayChild.killed) {
      overlayChild.kill();
      console.log('🛑 Убит дочерний процесс overlay (dev)');
      overlayChild = null;
    }
    if (overlayModule && typeof overlayModule.stop === 'function') {
      overlayModule.stop();
      console.log('🛑 Остановлен встроенный overlay через stop()');
      overlayModule = null;
    }
  } catch (e) {
    console.error('❌ Ошибка при остановке overlay-server:', e && e.message ? e.message : e);
  }
}

// ensure overlay stops when app quits
app.on('before-quit', () => {
  flushCooldownsSync();
  stopOverlayServer();
});

// Конфиги
const CONFIG_DIR = path.join(app.getPath('userData'), 'ccg-bot');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const COOLDOWNS_FILE = path.join(CONFIG_DIR, 'cooldowns.json');
const COLLECTIONS_FILE = path.join(CONFIG_DIR, 'collections.json');
const CARDS_DB_FILE = path.join(CONFIG_DIR, 'cards.json');
const CARDS_IMG_DIR = path.join(CONFIG_DIR, 'Cards');
const TOKEN_PREFIX = 'enc:v1:';
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

let configCache = null;
let configFileMtime = null;
let collectionsCache = null;
let cooldowns = null;
let cooldownFlushTimer = null;
const allowedImportPaths = new Set();

let mainWindow;
let twitchChatClient = null;
let chatReconnectTimer = null;
let chatIntentionalDisconnect = false;
let chatReconnectAttempt = 0;
let tokenRefreshTimer = null;
let lastOverlayPort = null;
let pendingManualDisconnect = false;
const CHAT_RECONNECT_MAX_ATTEMPTS = 14;

function sayInChat(channel, message) {
  if (!twitchChatClient) return Promise.resolve();
  return twitchChatClient.say(channel, clampTwitchMessage(message)).catch((err) => {
    addLog('[' + new Date().toLocaleTimeString() + '] ❌ Ошибка отправки: ' + String(err));
  });
}

function clearChatReconnectTimer() {
  if (chatReconnectTimer) {
    clearTimeout(chatReconnectTimer);
    chatReconnectTimer = null;
  }
}

function scheduleChatReconnect() {
  if (!botState.isRunning || chatIntentionalDisconnect) return;
  clearChatReconnectTimer();
  const delay = Math.min(60000, 2000 * Math.pow(2, chatReconnectAttempt));
  botState.chatReconnecting = true;
  publishBotStatus();
  chatReconnectTimer = setTimeout(async () => {
    chatReconnectAttempt += 1;
    if (chatReconnectAttempt > CHAT_RECONNECT_MAX_ATTEMPTS) {
      botState.chatReconnecting = false;
      addLog('[' + new Date().toLocaleTimeString() + '] ❌ Не удалось переподключить чат после нескольких попыток');
      publishBotStatus();
      return;
    }
    addLog(
      '[' + new Date().toLocaleTimeString() + '] 🔄 Переподключение к Twitch Chat (попытка ' +
      chatReconnectAttempt + '/' + CHAT_RECONNECT_MAX_ATTEMPTS + ')'
    );
    const ok = await ensureChatConnected();
    if (ok) {
      chatReconnectAttempt = 0;
      botState.chatReconnecting = false;
      publishBotStatus();
    } else {
      scheduleChatReconnect();
    }
  }, delay);
}

function startTokenRefreshLoop() {
  stopTokenRefreshLoop();
  tokenRefreshTimer = setInterval(async () => {
    if (!botState.isRunning) return;
    const config = loadConfig();
    if (!config.twitch?.accessToken) return;
    if (!isTokenExpiredOrExpiring(config)) return;
    const ok = await refreshAccessToken();
    if (ok && twitchChatClient) {
      await disconnectTwitchChat();
      await ensureChatConnected();
    }
  }, 5 * 60 * 1000);
}

function stopTokenRefreshLoop() {
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
}

function restartOverlayServer() {
  stopOverlayServer();
  overlayModule = null;
  overlayChild = null;
  try {
    const packagedPath = path.join(__dirname, '..', 'overlay-server.js');
    const resolved = require.resolve(packagedPath);
    delete require.cache[resolved];
  } catch (e) {
    // ignore
  }
  startOverlayServer();
  lastOverlayPort = getOverlaySettings().port;
}

function isUserAllowed(config, userId, tags) {
  const moderation = config.settings?.moderation || {};
  const blocked = moderation.blockedUserIds || [];
  if (blocked.includes(userId)) return false;
  if (moderation.subsOnly && !tags.subscriber) return false;
  const isMod = tags.mod || tags['user-type'] === 'mod';
  const isBroadcaster = tags.badges?.broadcaster || userId === config.channelId;
  if (moderation.modsOnly && !isMod && !isBroadcaster) return false;
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  ensureConfigDir();
  try {
    loadConfig();
    loadCooldowns();
    loadCollections();
    startOverlayServer();
    lastOverlayPort = getOverlaySettings().port;
  } catch (e) {
    console.error('Не удалось загрузить конфиг:', e.message);
  }
  console.log('='.repeat(60));
  console.log('📁 Папка с картинками находится здесь:');
  console.log(CARDS_IMG_DIR);
  console.log('='.repeat(60));
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ===== КОНФИГ УПРАВЛЕНИЕ =====
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CARDS_IMG_DIR)) {
    fs.mkdirSync(CARDS_IMG_DIR, { recursive: true });
  }
}

function sealSecret(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && value.startsWith(TOKEN_PREFIX)) return value;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Шифрование ОС недоступно, токен не записан');
  }
  return TOKEN_PREFIX + safeStorage.encryptString(String(value)).toString('base64');
}

function unsealSecret(value) {
  if (value == null || value === '') return { value: null, legacy: false };
  if (typeof value !== 'string') return { value: null, legacy: false };
  if (!value.startsWith(TOKEN_PREFIX)) return { value, legacy: true };
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Не удалось расшифровать токен: шифрование ОС недоступно');
  }
  const raw = Buffer.from(value.slice(TOKEN_PREFIX.length), 'base64');
  return { value: safeStorage.decryptString(raw), legacy: false };
}

function invalidateConfigCache() {
  configCache = null;
  configFileMtime = null;
}

function getOverlaySettings() {
  const config = loadConfig();
  const host = config.settings?.overlay?.host || '127.0.0.1';
  const port = Number(config.settings?.overlay?.port);
  return {
    host: host === 'localhost' ? '127.0.0.1' : host,
    port: Number.isFinite(port) && port > 0 ? port : 3001,
  };
}

function loadConfig(forceReload = false) {
  ensureConfigDir();
  const defaultConfig = getDefaultConfig();

  if (forceReload) {
    configCache = null;
    configFileMtime = null;
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    configCache = defaultConfig;
    return configCache;
  }

  const stat = fs.statSync(CONFIG_FILE);
  if (!forceReload && configCache && configFileMtime === stat.mtimeMs) {
    return configCache;
  }
  configFileMtime = stat.mtimeMs;
  configCache = null;

  let loadedConfig;
  try {
    loadedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    console.error('Повреждён config.json, используются настройки по умолчанию:', e.message);
    configCache = defaultConfig;
    return configCache;
  }
  const mergedConfig = {
    ...defaultConfig,
    ...loadedConfig,
    twitch: {
      ...defaultConfig.twitch,
      ...(loadedConfig.twitch || {}),
    },
  };

  const loadedSettings = loadedConfig.settings || {};
  mergedConfig.settings = {
    ...defaultConfig.settings,
    ...loadedSettings,
    greeting: { ...defaultConfig.settings.greeting, ...(loadedSettings.greeting || {}) },
    commands: { ...defaultConfig.settings.commands, ...(loadedSettings.commands || {}) },
    overlay: { ...defaultConfig.settings.overlay, ...(loadedSettings.overlay || {}) },
    game: { ...defaultConfig.settings.game, ...(loadedSettings.game || {}) },
    onboarding: { ...defaultConfig.settings.onboarding, ...(loadedSettings.onboarding || {}) },
    moderation: { ...defaultConfig.settings.moderation, ...(loadedSettings.moderation || {}) },
  };

  const access = unsealSecret(mergedConfig.twitch.accessToken);
  const refresh = unsealSecret(mergedConfig.twitch.refreshToken);
  const secret = unsealSecret(mergedConfig.twitch.clientSecret);
  mergedConfig.twitch.accessToken = access.value;
  mergedConfig.twitch.refreshToken = refresh.value;
  mergedConfig.twitch.clientSecret = secret.value;
  mergedConfig._secretsNeedSeal = access.legacy || refresh.legacy || secret.legacy;

  if (mergedConfig.settings?.game?.rarityWeights && !mergedConfig.settings.game.rarities) {
    const rarityWeights = mergedConfig.settings.game.rarityWeights;
    mergedConfig.settings.game.rarities = Object.entries(rarityWeights).map(([name, weight]) => ({
      name,
      weight,
    }));
    delete mergedConfig.settings.game.rarityWeights;
    mergedConfig._secretsNeedSeal = true;
  }

  if (!loadedConfig.twitch?.clientId && defaultConfig.twitch?.clientId) {
    mergedConfig._secretsNeedSeal = true;
  }

  configCache = mergedConfig;
  return configCache;
}

function toPublicConfig(config) {
  return {
    twitch: {
      authMode: config.twitch?.authMode || 'dimandus',
      expiresAt: config.twitch?.expiresAt ?? null,
      issuedAt: config.twitch?.issuedAt ?? null,
      clientId: config.twitch?.clientId ?? null,
      hasClientSecret: Boolean(config.twitch?.clientSecret),
      hasAccessToken: Boolean(config.twitch?.accessToken),
      redirectPort: twitchDirectAuth.DEFAULT_REDIRECT_PORT,
    },
    channel: config.channel ?? null,
    channelId: config.channelId ?? null,
    game: config.game ?? null,
    settings: config.settings,
    onboarding: config.settings?.onboarding || { completed: false },
  };
}

function getDefaultConfig() {
  return {
    twitch: {
      authMode: 'dimandus',
      accessToken: null,
      refreshToken: null,
      clientSecret: null,
      expiresAt: null,
      issuedAt: null,
      clientId: "2sk3t84wmxpeulajhrnrf7ztlid1xp",
    },
    channel: null,
    game: null,
    settings: {
      greeting: {
        enabled: false,
        message: "Бот запущен и готов к работе! 🤖",
      },
      commands: {
        enabled: false,
        name: "ccg",
        respondInChat: true,
        responseFormat: "Команда {cmd} выполнена",
      },
      overlay: {
        enabled: false,
        host: "localhost",
        port: 3001,
      },
      onboarding: {
        completed: false,
      },
      moderation: {
        blockedUserIds: [],
        subsOnly: false,
        modsOnly: false,
      },
      game: {
        enabled: false,
        commandName: "!карта",
        cooldownSeconds: 60,
        responseFormat: "@{username} 🎴 {cardName} ({rarity})",
        rarities: [
          { name: "Common", weight: 50 },
          { name: "Uncommon", weight: 30 },
          { name: "Rare", weight: 15 },
          { name: "Epic", weight: 4 },
          { name: "Legendary", weight: 1 },
        ],
        collectionEnabled: true,
        collectionCommandName: "!коллекция",
        collectionResponseFormat: "@{username}, у вас {totalCount} карт, сумма рангов: {rankSum}",
      },
    },
    userCooldowns: {},
  };
}

function loadCollections() {
  if (collectionsCache) return collectionsCache;
  collectionsCache = {};
  ensureConfigDir();
  if (!fs.existsSync(COLLECTIONS_FILE)) return collectionsCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(COLLECTIONS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      collectionsCache = parsed;
    }
  } catch (e) {
    collectionsCache = {};
  }
  return collectionsCache;
}

function saveCollections(store) {
  collectionsCache = store || {};
  ensureConfigDir();
  const tmp = COLLECTIONS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(collectionsCache, null, 2), 'utf8');
  fs.renameSync(tmp, COLLECTIONS_FILE);
}

function recordCollectionDraw(userId, username, card) {
  const updated = collectionLib.recordCardDraw(loadCollections(), userId, username, card);
  saveCollections(updated);
}

function validateRaritiesAgainstCards() {
  const cards = loadCards();
  const config = loadConfig();
  const orphans = cardDraw.findOrphanCardRarities(cards, config.settings?.game?.rarities);
  const empty = cardDraw.findEmptyConfiguredRarities(cards, config.settings?.game?.rarities);
  return { orphans, empty };
}

function saveConfig(config) {
  const accessToken = sealSecret(config.twitch?.accessToken);
  const refreshToken = sealSecret(config.twitch?.refreshToken);
  const clientSecret = sealSecret(config.twitch?.clientSecret);
  delete config.userCooldowns;
  delete config._secretsNeedSeal;
  configCache = config;

  const persisted = {
    ...config,
    twitch: {
      ...(config.twitch || {}),
      accessToken,
      refreshToken,
      clientSecret,
    },
  };
  delete persisted.userCooldowns;
  delete persisted._secretsNeedSeal;

  ensureConfigDir();
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(persisted, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
}

function cooldownWindowMs(config) {
  const seconds = Number(config.settings?.game?.cooldownSeconds);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
}

function loadCooldowns() {
  if (cooldowns) return cooldowns;
  cooldowns = {};
  ensureConfigDir();

  if (fs.existsSync(COOLDOWNS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(COOLDOWNS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        cooldowns = parsed;
      }
    } catch (e) {
      cooldowns = {};
    }
  }

  const config = loadConfig();
  const embedded = config.userCooldowns;
  let dirty = Boolean(config._secretsNeedSeal);
  if (embedded && typeof embedded === 'object' && Object.keys(embedded).length > 0) {
    for (const [id, ts] of Object.entries(embedded)) {
      if (cooldowns[id] == null) cooldowns[id] = ts;
    }
    delete config.userCooldowns;
    dirty = true;
  }

  if (pruneCooldowns(cooldownWindowMs(config))) dirty = true;
  if (dirty) {
    flushCooldownsSync();
    try {
      saveConfig(config);
    } catch (e) {
      console.error('Не удалось обновить конфиг при миграции:', e.message);
    }
  }
  return cooldowns;
}

function pruneCooldowns(cooldownMs) {
  if (!cooldowns) return false;
  const now = Date.now();
  let removed = false;
  for (const [id, ts] of Object.entries(cooldowns)) {
    const time = Number(ts);
    if (!Number.isFinite(time) || now - time >= cooldownMs) {
      delete cooldowns[id];
      removed = true;
    }
  }
  return removed;
}

function flushCooldownsSync() {
  if (cooldownFlushTimer) {
    clearTimeout(cooldownFlushTimer);
    cooldownFlushTimer = null;
  }
  if (!cooldowns) return;
  ensureConfigDir();
  const tmp = COOLDOWNS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cooldowns), 'utf8');
  fs.renameSync(tmp, COOLDOWNS_FILE);
}

function scheduleCooldownFlush() {
  if (cooldownFlushTimer) return;
  cooldownFlushTimer = setTimeout(() => {
    cooldownFlushTimer = null;
    try {
      flushCooldownsSync();
    } catch (e) {
      console.error('Не удалось записать кулдауны:', e.message);
    }
  }, 2000);
}

function isInsideDir(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeImageFilename(filename) {
  if (typeof filename !== 'string' || !filename) {
    throw new Error('Некорректное имя файла');
  }
  const normalized = filename.replace(/\\/g, '/');
  const base = path.posix.basename(normalized);
  if (base !== normalized || base === '.' || base === '..') {
    throw new Error('Некорректное имя файла');
  }
  if (!/^[\w.-]+$/.test(base)) {
    throw new Error('Некорректное имя файла');
  }
  const ext = path.extname(base).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) {
    throw new Error('Неподдерживаемый тип изображения');
  }
  return base;
}

function cardFileFromRelative(relativePath) {
  if (typeof relativePath !== 'string') {
    throw new Error('Invalid path format');
  }
  const normalized = relativePath.replace(/\\/g, '/');
  if (!normalized.startsWith('Cards/')) {
    throw new Error('Invalid path format');
  }
  const fileName = safeImageFilename(normalized.slice('Cards/'.length));
  const filePath = path.join(CARDS_IMG_DIR, fileName);
  if (!isInsideDir(CARDS_IMG_DIR, filePath)) {
    throw new Error('Path traversal attempt');
  }
  return { fileName, filePath };
}

function mimeFromFilename(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }[ext] || null;
}

// ===== КАРТОЧКИ =====
function getDefaultCards() {
  const seedPath = path.join(__dirname, '..', 'data', 'test-cards.json');
  try {
    if (fs.existsSync(seedPath)) {
      const parsed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Не удалось прочитать test-cards.json:', e.message);
  }
  return [];
}

function loadCards() {
  ensureConfigDir();
  if (fs.existsSync(CARDS_DB_FILE)) {
    try {
      const data = fs.readFileSync(CARDS_DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return getDefaultCards();
    }
  }
  const defaultCards = getDefaultCards();
  saveCards(defaultCards);
  return defaultCards;
}

function saveCards(cards) {
  ensureConfigDir();
  fs.writeFileSync(CARDS_DB_FILE, JSON.stringify(cards, null, 2), 'utf8');
}

function checkUserCooldown(config, userId) {
  const now = Date.now();
  const cooldownMs = cooldownWindowMs(config);
  const map = loadCooldowns();
  if (pruneCooldowns(cooldownMs)) scheduleCooldownFlush();
  const lastTime = Number(map[userId]);

  if (!Number.isFinite(lastTime) || now - lastTime >= cooldownMs) {
    return { available: true, remainingMs: 0 };
  }

  return { available: false, remainingMs: cooldownMs - (now - lastTime) };
}

function setUserCooldown(userId) {
  const config = loadConfig();
  const cooldownMs = cooldownWindowMs(config);
  const map = loadCooldowns();
  pruneCooldowns(cooldownMs);
  map[userId] = Date.now();
  scheduleCooldownFlush();
}

function formatCardResponse(format, username, card) {
  return format
    .replace(/{username}/g, username)
    .replace(/{cardName}/g, card.name)
    .replace(/{rarity}/g, card.rarity)
    .replace(/{cardColor}/g, card.color || '#000000');
}

// ===== TWITCH CHAT =====
function publishBotStatus() {
  const config = loadConfig();
  botState.isAuthorized = Boolean(config.twitch?.accessToken);
  botState.gameEnabled = Boolean(config.settings?.game?.enabled);
  if (mainWindow) {
    mainWindow.webContents.send('bot-status-changed', { ...botState });
  }
}

async function ensureChatConnected() {
  const config = loadConfig();
  if (!botState.isRunning) {
    botState.chatConnected = false;
    publishBotStatus();
    return false;
  }
  if (!config.twitch?.accessToken || !config.channel) {
    botState.chatConnected = false;
    publishBotStatus();
    return false;
  }
  if (twitchChatClient) {
    botState.chatConnected = true;
    publishBotStatus();
    return true;
  }
  const connected = await connectTwitchChat(config.twitch.accessToken, config.channel);
  botState.chatConnected = connected;
  publishBotStatus();
  return connected;
}

function applyTokenResponse(config, tokenData) {
  const issuedAtMs = Date.now();
  const expiresIn = Number(tokenData.expires_in) || 0;
  config.twitch.accessToken = tokenData.access_token;
  if (tokenData.refresh_token) {
    config.twitch.refreshToken = tokenData.refresh_token;
  }
  config.twitch.expiresAt = issuedAtMs + expiresIn * 1000;
  config.twitch.issuedAt = issuedAtMs;
  saveConfig(config);
}

async function connectTwitchChat(accessToken, channelName) {
  try {
    if (twitchChatClient) {
      await disconnectTwitchChat();
    }
    let config = loadConfig();

    // Проверяем и рефрешим токен если нужно
    if (isTokenExpiredOrExpiring(config)) {
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Токен протух или вот-вот протечет');
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        addLog('[' + new Date().toLocaleTimeString() + '] ❌ Не удалось обновить токен. Авторизуйтесь заново.');
        return false;
      }
      config = loadConfig(); // Перезагружаем конфиг с новым токеном
      accessToken = config.twitch?.accessToken;
    }

    twitchChatClient = new tmi.client({
      options: { debug: false },
      connection: {
        reconnect: true,
      },
      identity: {
        username: channelName,
        password: 'oauth:' + accessToken,
      },
      channels: [channelName],
    });

    twitchChatClient.on('message', (channel, tags, message, self) => {
      if (self) return;

      const liveConfig = loadConfig();
      const userId = tags['user-id'];
      const username = tags['display-name'];
      if (!isUserAllowed(liveConfig, userId, tags)) {
        return;
      }

      const trimmed = message.trim();
      const drawCommand = (liveConfig.settings?.game?.commandName || '').trim();
      const collectionEnabled = liveConfig.settings?.game?.collectionEnabled !== false;
      const collectionCommand = (liveConfig.settings?.game?.collectionCommandName || '!коллекция').trim();

      if (collectionEnabled && collectionCommand && trimmed === collectionCommand) {
        handleCollectionChatReply(channel, userId, username, liveConfig);
        return;
      }

      if (!drawCommand || trimmed !== drawCommand) return;

      addLog('[' + new Date().toLocaleTimeString() + '] 🎯 ' + username + ' → ' + message);

      if (!liveConfig.settings?.game?.enabled) {
        addLog(
          '[' + new Date().toLocaleTimeString() + '] ℹ️ ' + username + ' → карта, но игра выключена'
        );
        sayInChat(channel, `@${username} игра карточек сейчас выключена.`);
        return;
      }

      const getCardResult = handleGetCard(userId, username);

      if (getCardResult.success) {
        const card = getCardResult.card;
        const format = liveConfig.settings?.game?.responseFormat || '@{username} 🎴 {cardName} ({rarity})';
        const responseMsg = formatCardResponse(format, username, card);
        sayInChat(channel, responseMsg);

        sendCardToOverlay(username, card);
      } else {
        const errorMsg = `@${username} ⏱️ ${getCardResult.error}`;
        sayInChat(channel, errorMsg);
      }
    });

    twitchChatClient.on('connected', () => {
      chatReconnectAttempt = 0;
      botState.chatConnected = true;
      botState.chatReconnecting = false;
      botState.lastChatError = null;
      publishBotStatus();
      addLog('[' + new Date().toLocaleTimeString() + '] ✅ Подключено к Twitch Chat (канал: ' + channelName + ')');
    });

    twitchChatClient.on('disconnected', (reason) => {
      twitchChatClient = null;
      botState.chatConnected = false;
      publishBotStatus();
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Отключено от Twitch Chat: ' + reason);
      if (botState.isRunning && !chatIntentionalDisconnect && !pendingManualDisconnect) {
        scheduleChatReconnect();
      }
    });

    await twitchChatClient.connect();
    botState.chatConnected = true;
    botState.lastChatError = null;
    publishBotStatus();
    return true;
  } catch (e) {
    botState.lastChatError = e.message;
    addLog('[' + new Date().toLocaleTimeString() + '] ❌ Ошибка подключения к чату: ' + e.message);
    publishBotStatus();
  return false;
  }
}

async function disconnectTwitchChat() {
  try {
    clearChatReconnectTimer();
    pendingManualDisconnect = true;
    if (twitchChatClient) {
      await twitchChatClient.disconnect();
      twitchChatClient = null;
      botState.chatConnected = false;
      publishBotStatus();
      addLog('[' + new Date().toLocaleTimeString() + '] 👋 Отключено от Twitch Chat');
    }
  } catch (e) {
    addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Ошибка отключения: ' + e.message);
  } finally {
    setTimeout(() => {
      pendingManualDisconnect = false;
    }, 250);
  }
}

// ===== УПРАВЛЕНИЕ КАРТОЧКАМИ =====
function pickRandomCard(config) {
  return cardDraw.getRandomCard(loadCards(), config.settings?.game?.rarities);
}

function sendCardToOverlay(username, card) {
  try {
    const { host, port: overlayPort } = getOverlaySettings();
    
    addLog('[' + new Date().toLocaleTimeString() + '] 📤 Отправляю карточку на оверлей: ' + card.name);
    
    // Преобразуем путь к картинке в base64 если это локальный файл
    let cardImage = card.image || '';
    console.log('📸 Исходный путь к картинке:', cardImage);
    
    // Нормализуем path - заменяем backslashes на forward slashes
    const normalizedPath = cardImage.replace(/\\/g, '/');
    console.log('📸 Нормализованный путь:', normalizedPath);
    
    if (normalizedPath.startsWith('Cards/')) {
      try {
        const { fileName, filePath } = cardFileFromRelative(normalizedPath);
        console.log('📂 Полный путь к файлу:', filePath);
        console.log('📂 Проверяю существование файла...');
        const fileExists = fs.existsSync(filePath);
        console.log('📂 Файл существует?', fileExists);
        
        if (!fileExists) {
          console.error('❌ Файл не найден:', filePath);
          addLog('[' + new Date().toLocaleTimeString() + '] ❌ Файл картинки не найден: ' + filePath);
        } else {
          const fileContent = fs.readFileSync(filePath);
          console.log('📂 Размер файла:', fileContent.length, 'байт');
          
          const ext = fileName.split('.').pop() || 'png';
          const mimeType = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp'
          }[ext.toLowerCase()] || 'image/png';
          
          cardImage = 'data:' + mimeType + ';base64,' + fileContent.toString('base64');
          console.log('✅ Картинка загружена и конвертирована, размер base64:', cardImage.length);
        }
      } catch (e) {
        addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Не удалось загрузить картинку: ' + e.message);
        console.error('❌ Ошибка загрузки:', e);
      }
    } else {
      console.log('⚠️ Путь не начинается с Cards/, используем как есть');
    }

    const postData = JSON.stringify({
      username: username,
      cardName: card.name,
      cardColor: card.color || '#FF6B35',
      cardImage: cardImage,
      rarity: card.rarity || '',
    });

    console.log('📦 Отправляю данные:', { username, cardName: card.name, cardColor: card.color, rarity: card.rarity, imageSize: cardImage.length });

    const options = {
      hostname: host,
      port: overlayPort,
      path: '/api/show-card',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    console.log('🔗 Отправляю HTTP POST на http://127.0.0.1:' + overlayPort + '/api/show-card');

    const req = http.request(options, (res) => {
      console.log('📊 HTTP ответ статус:', res.statusCode);
      res.on('data', () => {});
      res.on('end', () => {
        addLog('[' + new Date().toLocaleTimeString() + '] ✅ Карточка отправлена на оверлей (статус: ' + res.statusCode + ')');
      });
    });

    req.on('error', (error) => {
      // Оверлей-сервер может быть не запущен, это нормально
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Оверлей не доступен: ' + error.message);
      console.error('❌ Ошибка отправки на оверлей:', error.message);
    });

    req.write(postData);
    req.end();
  } catch (e) {
    console.error('❌ Ошибка при отправке на оверлей:', e.message);
  }
}

function handleGetCard(userId, username) {
  const config = loadConfig();

  if (!config.settings?.game?.enabled) {
    return { success: false, error: 'Игра отключена' };
  }

  const cooldown = checkUserCooldown(config, userId);
  if (!cooldown.available) {
    const remainingSeconds = Math.ceil(cooldown.remainingMs / 1000);
    return {
      success: false,
      error: `Подождите ${remainingSeconds} сек`,
      cooldown: remainingSeconds,
    };
  }

  const card = pickRandomCard(config);
  setUserCooldown(userId);
  recordCollectionDraw(userId, username, card);

  const displayName = username || userId;
  addLog(
    '[' + new Date().toLocaleTimeString() + '] 🎴 ' + displayName + ' получил карточку: ' +
    card.name + ' (' + card.rarity + ')'
  );

  return {
    success: true,
    card: card,
  };
}

function handleCollectionChatReply(channel, userId, username, config) {
  const entry = loadCollections()[userId];
  const cardsById = collectionLib.cardsIndex(loadCards());
  const rarityRankMap = collectionLib.buildRarityRankMap(config.settings?.game?.rarities);
  const stats = collectionLib.getUserStats(entry, cardsById, rarityRankMap);
  const format = config.settings?.game?.collectionResponseFormat;
  const responseMsg = clampTwitchMessage(
    collectionLib.formatCollectionChatMessage(username, stats, format)
  );
  addLog('[' + new Date().toLocaleTimeString() + '] 📚 ' + username + ' → коллекция (' + stats.totalCount + ' карт)');
  sayInChat(channel, responseMsg);
}

// ===== УПРАВЛЕНИЕ ТОКЕНАМИ =====
function isTokenExpiredOrExpiring(config) {
  const expiresAt = config.twitch?.expiresAt;
  const now = Date.now();
  const tenMinutesMs = 10 * 60 * 1000;

  if (!expiresAt) {
    return true; // Нет токена
  }

  // Проверяем если токен истек или истекает меньше чем через 10 минут
  return now >= (expiresAt - tenMinutesMs);
}

async function refreshAccessToken() {
  try {
    const config = loadConfig();

    if (!config.twitch?.refreshToken) {
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Refresh token отсутствует');
      return false;
    }

    addLog('[' + new Date().toLocaleTimeString() + '] 🔄 Обновление токена доступа...');

    if (config.twitch?.authMode === 'direct') {
      const tokenData = await twitchDirectAuth.refreshDirectToken({
        clientId: config.twitch.clientId,
        clientSecret: config.twitch.clientSecret,
        refreshToken: config.twitch.refreshToken,
      });
      if (!tokenData?.access_token) {
        addLog('[' + new Date().toLocaleTimeString() + '] ❌ Ошибка обновления direct OAuth токена');
        return false;
      }
      applyTokenResponse(config, tokenData);
      addLog('[' + new Date().toLocaleTimeString() + '] ✅ Direct OAuth токен обновлен');
      return true;
    }

    const opts = dimandusHttp.withTlsPolicy({
      hostname: 'dimandus.ru',
      port: 5001,
      path: '/api/auth/twitch/refresh',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const requestData = JSON.stringify({
      refresh_token: config.twitch.refreshToken,
    });

    return new Promise((resolve) => {
      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const response = JSON.parse(data);
              const { access_token, refresh_token, expires_in } = response;

              if (access_token && expires_in) {
                applyTokenResponse(config, {
                  access_token,
                  refresh_token,
                  expires_in,
                });
                addLog('[' + new Date().toLocaleTimeString() + '] ✅ Токен обновлен (действует ' + expires_in + ' сек)');
                resolve(true);
                return;
              }
            }
          } catch (e) {
            addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Ошибка парсинга ответа: ' + e.message);
          }

          addLog('[' + new Date().toLocaleTimeString() + '] ❌ Ошибка обновления токена (ответ: ' + res.statusCode + ')');
          resolve(false);
        });
      });

      req.on('error', (e) => {
        addLog('[' + new Date().toLocaleTimeString() + '] ❌ Ошибка при обновлении токена: ' + e.message);
        resolve(false);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve(false);
      });

      req.write(requestData);
      req.end();
    });
  } catch (e) {
    addLog('[' + new Date().toLocaleTimeString() + '] ❌ Ошибка рефреша токена: ' + e.message);
    return false;
  }
}

// ===== АВТОРИЗАЦИЯ =====
const AUTH_SERVER = 'https://dimandus.ru:5001';
let currentAuthSession = null;
const logs = [];

function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = dimandusHttp.withTlsPolicy({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      ...options,
    });

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

function addLog(message) {
  logs.push(message);
  if (logs.length > 100) {
    logs.shift();
  }
  if (mainWindow) {
    mainWindow.webContents.send('new-log', message);
  }
}

// ===== IPC HANDLERS =====
let botState = {
  isRunning: false,
  isAuthorized: false,
  chatConnected: false,
  gameEnabled: false,
  chatReconnecting: false,
  lastChatError: null,
  appVersion: APP_VERSION,
};

let hasShownCardsDir = false;

ipcMain.handle('get-bot-status', () => {
  const config = loadConfig();
  const hasToken = config.twitch?.accessToken != null;
  return {
    isRunning: botState.isRunning,
    isAuthorized: hasToken,
    chatConnected: botState.chatConnected,
    gameEnabled: Boolean(config.settings?.game?.enabled),
    chatReconnecting: botState.chatReconnecting,
    lastChatError: botState.lastChatError,
    appVersion: APP_VERSION,
  };
});

async function finalizeTwitchAuthorization(tokenData, mode) {
  const config = loadConfig();
  applyTokenResponse(config, tokenData);
  config.twitch.authMode = mode;

  let username = null;
  let userId = null;
  if (mode === 'direct') {
    const validated = await twitchDirectAuth.getValidatedUser(tokenData.access_token);
    if (validated?.login) {
      username = validated.login;
      userId = validated.user_id;
    }
  } else {
    const userInfo = await getTwitchUserInfo(tokenData.access_token);
    username = userInfo?.login || userInfo?.display_name || null;
    userId = userInfo?.id || null;
  }

  if (username) {
    config.channel = username;
    config.channelId = userId;
  }
  saveConfig(config);
  botState.isAuthorized = true;
  publishBotStatus();
  return { success: true, username, userId };
}

async function authorizeTwitchDirect() {
  try {
    const config = loadConfig();
    if (!config.twitch?.clientId) {
      return { success: false, error: 'Укажите Twitch Client ID в окне резервной авторизации' };
    }

    addLog('[' + new Date().toLocaleTimeString() + '] 🔑 Direct OAuth Twitch (PKCE)...');
  addLog('[' + new Date().toLocaleTimeString() + '] ℹ️ Redirect URI: http://localhost:' + twitchDirectAuth.DEFAULT_REDIRECT_PORT);

    const tokenData = await twitchDirectAuth.authorizeWithPkce({
      clientId: config.twitch.clientId,
      clientSecret: config.twitch.clientSecret || undefined,
      scopes: TWITCH_SCOPES.split(' '),
      redirectPort: twitchDirectAuth.DEFAULT_REDIRECT_PORT,
      openUrl: (url) => shell.openExternal(url),
    });

    const result = await finalizeTwitchAuthorization(tokenData, 'direct');
    addLog('[' + new Date().toLocaleTimeString() + '] 🎉 Direct OAuth завершён для ' + (result.username || 'канал'));
    return result;
  } catch (error) {
    addLog('[' + new Date().toLocaleTimeString() + '] ❌ Direct OAuth: ' + error.message);
    return { success: false, error: error.message };
  }
}

ipcMain.handle('authorize-twitch-direct', () => authorizeTwitchDirect());

ipcMain.handle('authorize-twitch', async () => {
  try {
    const config = loadConfig();
    if (config.twitch?.authMode === 'direct') {
      return await authorizeTwitchDirect();
    }

    addLog('[' + new Date().toLocaleTimeString() + '] 🔄 Инициализация Twitch авторизации...');
    
    const initResponse = await httpGet(
      `${AUTH_SERVER}/api/auth/twitch/init?scope=${encodeURIComponent(
        'chat:read chat:edit channel:bot moderator:manage:banned_users user:write:chat'
      )}`
    );

    if (initResponse.statusCode !== 200) {
      const error = 'Ошибка инициализации авторизации';
      addLog('[' + new Date().toLocaleTimeString() + '] ❌ ' + error);
      return { success: false, error };
    }

    const { auth_url, session_id } = initResponse.data;
    currentAuthSession = {
      sessionId: session_id,
      startTime: Date.now(),
    };

    addLog('[' + new Date().toLocaleTimeString() + '] 🌐 Открываю браузер для авторизации...');
    addLog('[' + new Date().toLocaleTimeString() + '] 💡 После авторизации в Twitch страница закроется автоматически');
    
    shell.openExternal(auth_url);

    addLog('[' + new Date().toLocaleTimeString() + '] ⏳ Ожидание завершения авторизации...');
    return await waitForAuthCompletion();
  } catch (error) {
    const msg = '💥 Ошибка авторизации: ' + error.message;
    addLog('[' + new Date().toLocaleTimeString() + '] ' + msg);
    return { success: false, error: error.message };
  }
});

// Получение информации о пользователе Twitch
function getTwitchUserInfo(accessToken) {
  return new Promise((resolve) => {
    const config = loadConfig();
    const clientId = config.twitch?.clientId;

    if (!clientId) {
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Client ID не установлен в конфиге');
      resolve(null);
      return;
    }

    addLog('[' + new Date().toLocaleTimeString() + '] 🔍 Запрашиваю информацию о пользователе у Twitch API...');

    const opts = {
      hostname: 'api.twitch.tv',
      port: 443,
      path: '/helix/users',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Client-ID': clientId,
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            if (json.data && json.data.length > 0) {
              addLog('[' + new Date().toLocaleTimeString() + '] ✅ Информация о пользователе получена');
              resolve(json.data[0]);
              return;
            }
          } else {
            addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Twitch API ответил: ' + res.statusCode);
          }
        } catch (e) {
          addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Ошибка парсинга ответа: ' + e.message);
        }
        resolve(null);
      });
    });

    req.on('error', (e) => {
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Ошибка запроса к Twitch: ' + e.message);
      resolve(null);
    });
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

function sendChatMessage(accessToken, broadcasterId, message) {
  return new Promise((resolve) => {
    if (!broadcasterId || !message) {
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Не могу отправить сообщение: отсутствует ID канала или текст');
      resolve(false);
      return;
    }

    const config = loadConfig();
    const clientId = config.twitch?.clientId;

    if (!clientId) {
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Client ID не установлен в конфиге');
      resolve(false);
      return;
    }

    const messageData = JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id: broadcasterId,
      message: clampTwitchMessage(message),
    });

    const opts = {
      hostname: 'api.twitch.tv',
      port: 443,
      path: '/helix/chat/messages',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Client-ID': clientId,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(messageData),
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          addLog('[' + new Date().toLocaleTimeString() + '] 💬 Приветствие отправлено в чат');
          resolve(true);
        } else {
          addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Ошибка при отправке сообщения: ' + res.statusCode);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Ошибка отправки сообщения: ' + e.message);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });

    req.write(messageData);
    req.end();
  });
}

async function waitForAuthCompletion() {
  const maxAttempts = 60;
  const interval = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const statusResponse = await httpGet(
        `${AUTH_SERVER}/api/auth/twitch/status/${currentAuthSession.sessionId}`
      );

      if (statusResponse.statusCode === 200) {
        const { status, access_token, refresh_token, expires_in, scope } = statusResponse.data;

        if (status === 'completed') {
          addLog('[' + new Date().toLocaleTimeString() + '] 🎉 Twitch авторизация успешна!');
          addLog('[' + new Date().toLocaleTimeString() + '] 🔑 Access Token получен');

          // Получаем информацию о пользователе
          let userInfo = await getTwitchUserInfo(access_token);
          let username = userInfo?.login || userInfo?.display_name;
          
          username = username || 'Twitch User';
          const userId = userInfo?.id || 'unknown';

          addLog('[' + new Date().toLocaleTimeString() + '] 👤 Канал: ' + username + ' (ID: ' + userId + ')');
          addLog('[' + new Date().toLocaleTimeString() + '] 📋 Scope: ' + (scope?.join(', ') || 'все'));

          const config = loadConfig();
          applyTokenResponse(config, { access_token, refresh_token, expires_in });
          config.channel = username;
          config.channelId = userId;
          config.twitch.authMode = 'dimandus';
          saveConfig(config);

          addLog('[' + new Date().toLocaleTimeString() + '] 🔐 Токен сохранен (истекает через ' + expires_in + ' сек)');

          botState.isAuthorized = true;
          publishBotStatus();

          return { success: true, expiresIn: expires_in, username, userId };
        } else if (status === 'error') {
          const error = statusResponse.data.error_description || 'Неизвестная ошибка';
          addLog('[' + new Date().toLocaleTimeString() + '] ❌ Ошибка авторизации: ' + error);
          return { success: false, error };
        } else if (status === 'expired') {
          addLog('[' + new Date().toLocaleTimeString() + '] ❌ Сессия авторизации истекла');
          return { success: false, error: 'Сессия истекла' };
        }
      }

      if (attempt % 10 === 0 && attempt > 0) {
        addLog('[' + new Date().toLocaleTimeString() + '] ⏳ Ожидание авторизации... (' + attempt + '/' + maxAttempts + ')');
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (error) {
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Ошибка проверки статуса: ' + error.message);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  addLog('[' + new Date().toLocaleTimeString() + '] ❌ Таймаут ожидания авторизации');
  return { success: false, error: 'Таймаут ожидания авторизации' };
}

ipcMain.handle('start-bot', async () => {
  let config = loadConfig();
  if (!config.twitch?.accessToken) {
    addLog('[' + new Date().toLocaleTimeString() + '] ❌ Бот не авторизован. Пожалуйста авторизуйтесь в Twitch.');
    return { success: false, error: 'Не авторизован' };
  }

  // Проверяем и рефрешим токен если нужно
  if (isTokenExpiredOrExpiring(config)) {
    addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Токен протух или вот-вот протечет');
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      addLog('[' + new Date().toLocaleTimeString() + '] ❌ Не удалось обновить токен. Авторизуйтесь заново.');
      return { success: false, error: 'Не удалось обновить токен доступа' };
    }
    config = loadConfig(); // Перезагружаем конфиг с новым токеном
  }

  chatIntentionalDisconnect = false;
  botState.isRunning = true;
  startTokenRefreshLoop();
  addLog('[' + new Date().toLocaleTimeString() + '] 🚀 Бот запущен.');

  if (!config.settings?.game?.enabled) {
    addLog('[' + new Date().toLocaleTimeString() + '] ℹ️ Игра выключена — команда карты неактивна, чат всё равно подключится.');
  }

  // Отправляем приветственное сообщение если включено
  if (config.settings?.greeting?.enabled && config.settings.greeting.message) {
    const userId = config.channelId || 'unknown';
    await sendChatMessage(
      config.twitch.accessToken,
      userId,
      config.settings.greeting.message
    );
  }

  let chatConnected = false;
  if (config.channel) {
    chatConnected = await ensureChatConnected();
    if (!chatConnected) {
      const err = botState.lastChatError || 'не удалось подключиться';
      addLog('[' + new Date().toLocaleTimeString() + '] ⚠️ Не удалось подключиться к чату Twitch: ' + err);
    }
  }

  publishBotStatus();
  return {
    success: true,
    chatConnected,
    gameEnabled: Boolean(config.settings?.game?.enabled),
    chatError: chatConnected ? null : (botState.lastChatError || 'Чат не подключён'),
  };
});

ipcMain.handle('stop-bot', async () => {
  botState.isRunning = false;
  chatIntentionalDisconnect = true;
  stopTokenRefreshLoop();
  clearChatReconnectTimer();
  botState.chatReconnecting = false;
  
  // Отключаемся от чата
  await disconnectTwitchChat();
  addLog('[' + new Date().toLocaleTimeString() + '] Бот остановлен.');
  
  // Синхронизируем авторизацию с конфигом перед отправкой
  const config = loadConfig();
  publishBotStatus();
  return { success: true };
});

function getCollectionSummaries(search = '') {
  const collections = loadCollections();
  const cardsById = collectionLib.cardsIndex(loadCards());
  const config = loadConfig();
  const rarityRankMap = collectionLib.buildRarityRankMap(config.settings?.game?.rarities);
  const query = String(search || '').trim().toLowerCase();

  return Object.entries(collections)
    .map(([userId, entry]) => ({
      userId,
      username: entry?.username || userId,
      updatedAt: entry?.updatedAt || null,
      ...collectionLib.getUserStats(entry, cardsById, rarityRankMap),
    }))
    .filter((row) => {
      if (!query) return true;
      return row.username.toLowerCase().includes(query) || row.userId.includes(query);
    })
    .sort((a, b) => b.rankSum - a.rankSum || b.totalCount - a.totalCount);
}

ipcMain.handle('get-collections', (event, search = '') => getCollectionSummaries(search));

ipcMain.handle('get-user-collection', (event, userId) => {
  const collections = loadCollections();
  const entry = collections[userId];
  if (!entry) return { success: false, error: 'Пользователь не найден' };
  const cardsById = collectionLib.cardsIndex(loadCards());
  const config = loadConfig();
  const rarityRankMap = collectionLib.buildRarityRankMap(config.settings?.game?.rarities);
  const stats = collectionLib.getUserStats(entry, cardsById, rarityRankMap);
  const cards = Object.entries(entry.cards || {}).map(([cardId, count]) => ({
    cardId,
    count,
    name: cardsById[cardId]?.name || `#${cardId}`,
    rarity: cardsById[cardId]?.rarity || '',
  }));
  cards.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
  return {
    success: true,
    userId,
    username: entry.username,
    ...stats,
    cards,
  };
});

ipcMain.handle('validate-rarities', () => {
  const result = validateRaritiesAgainstCards();
  return { success: true, ...result };
});

ipcMain.handle('save-auth-settings', (event, payload = {}) => {
  try {
    const current = loadConfig();
    const nextTwitch = { ...current.twitch };
    if (payload.authMode === 'direct' || payload.authMode === 'dimandus') {
      nextTwitch.authMode = payload.authMode;
    }
    if (typeof payload.clientId === 'string' && payload.clientId.trim()) {
      nextTwitch.clientId = payload.clientId.trim();
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'clientSecret')) {
      const trimmed = String(payload.clientSecret || '').trim();
      nextTwitch.clientSecret = trimmed || null;
    }
    current.twitch = nextTwitch;
    saveConfig(current);
    return { success: true, config: toPublicConfig(loadConfig()) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-logs', () => {
  if (!hasShownCardsDir) {
    hasShownCardsDir = true;
    addLog('[' + new Date().toLocaleTimeString() + '] 📁 Папка с картинками: ' + CARDS_IMG_DIR);
  }
  return logs;
});

ipcMain.handle('get-config', () => {
  return toPublicConfig(loadConfig(true));
});

ipcMain.handle('reload-config', () => {
  invalidateConfigCache();
  return toPublicConfig(loadConfig(true));
});

ipcMain.handle('save-config', async (event, incoming) => {
  try {
    if (!incoming || typeof incoming !== 'object') {
      return { success: false, error: 'Некорректный конфиг' };
    }
    const current = loadConfig();
    const next = { ...current };
    if (incoming.settings) next.settings = incoming.settings;
    if (Object.prototype.hasOwnProperty.call(incoming, 'channel')) next.channel = incoming.channel;
    if (Object.prototype.hasOwnProperty.call(incoming, 'channelId')) next.channelId = incoming.channelId;
    if (Object.prototype.hasOwnProperty.call(incoming, 'game')) next.game = incoming.game;
    if (incoming.twitch && typeof incoming.twitch.clientId === 'string' && incoming.twitch.clientId) {
      next.twitch = { ...current.twitch, clientId: incoming.twitch.clientId };
    }
    delete next.userCooldowns;
    delete next._secretsNeedSeal;
    const previousCooldown = current.settings?.game?.cooldownSeconds;
    const prevOverlayPort = current.settings?.overlay?.port;
    saveConfig(next);
    invalidateConfigCache();
    pruneCooldowns(cooldownWindowMs(next));
    scheduleCooldownFlush();

    const nextOverlayPort = next.settings?.overlay?.port;
    if (prevOverlayPort !== nextOverlayPort) {
      restartOverlayServer();
      addLog(
        '[' + new Date().toLocaleTimeString() + '] 🔄 Оверлей перезапущен на порту ' +
        (nextOverlayPort || getOverlaySettings().port)
      );
    }

  const rarityCheck = validateRaritiesAgainstCards();
  const warnings = [];
  if (rarityCheck.orphans.length) {
    warnings.push('Карты с неизвестными редкостями: ' + rarityCheck.orphans.join(', '));
  }
  if (rarityCheck.empty.length) {
    warnings.push('Редкости без карт (не выпадают): ' + rarityCheck.empty.join(', '));
  }
  if (previousCooldown !== next.settings?.game?.cooldownSeconds) {
    addLog('[' + new Date().toLocaleTimeString() + '] ℹ️ Кулдаун обновлён, список кулдаунов пересчитан');
  }

    if (botState.isRunning) {
      await ensureChatConnected();
    }

    return { success: true, warnings };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('set-client-id', (event, clientId) => {
  if (!clientId) {
    return { success: false, error: 'Client ID не может быть пустым' };
  }
  const config = loadConfig();
  config.twitch.clientId = clientId;
  saveConfig(config);
  addLog('[' + new Date().toLocaleTimeString() + '] ✅ Client ID сохранен в конфиг');
  return { success: true };
});

ipcMain.handle('simulate-logs', () => {
  // Пусто
});

ipcMain.handle('get-card', (event, userId) => {
  return handleGetCard(userId);
});

ipcMain.handle('get-cards-list', () => {
  return loadCards();
});

ipcMain.handle('save-cards-list', (event, cards) => {
  saveCards(cards);
  const rarityCheck = validateRaritiesAgainstCards();
  const warnings = [];
  if (rarityCheck.orphans.length) {
    warnings.push('Карты с неизвестными редкостями: ' + rarityCheck.orphans.join(', '));
  }
  return { success: true, warnings };
});

ipcMain.handle('save-card-image', async (event, filename, imageData) => {
  try {
    ensureConfigDir();
    const safeName = safeImageFilename(filename);
    const filePath = path.join(CARDS_IMG_DIR, safeName);
    if (!isInsideDir(CARDS_IMG_DIR, filePath)) {
      return { success: false, error: 'Path traversal attempt' };
    }

    let buffer;
    if (typeof imageData === 'string' && imageData.startsWith('data:')) {
      const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(imageData);
      if (!match) return { success: false, error: 'Некорректное изображение' };
      buffer = Buffer.from(match[2], 'base64');
    } else if (typeof imageData === 'string') {
      let url;
      try {
        url = new URL(imageData);
      } catch (e) {
        return { success: false, error: 'Некорректный URL изображения' };
      }
      if (url.protocol !== 'https:') {
        return { success: false, error: 'Разрешены только https-ссылки на изображения' };
      }
      return await new Promise((resolve) => {
        https.get(url, (response) => {
          if (response.statusCode !== 200) {
            response.resume();
            resolve({ success: false, error: 'Не удалось скачать изображение: ' + response.statusCode });
            return;
          }
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            try {
              fs.writeFileSync(filePath, Buffer.concat(chunks));
              resolve({ success: true, relativePath: 'Cards/' + safeName });
            } catch (e) {
              resolve({ success: false, error: e.message });
            }
          });
        }).on('error', (e) => {
          resolve({ success: false, error: e.message });
        });
      });
    } else {
      buffer = Buffer.from(imageData);
    }

    fs.writeFileSync(filePath, buffer);
    return { success: true, relativePath: 'Cards/' + safeName };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('read-image-file', async (event, filePath) => {
  try {
    if (typeof filePath !== 'string' || !filePath) {
      return { success: false, error: 'Invalid path' };
    }
    const resolved = path.resolve(filePath);
    const mimeType = mimeFromFilename(resolved);
    if (!mimeType) return { success: false, error: 'Неподдерживаемый тип изображения' };
    const allowed = allowedImportPaths.has(resolved) || isInsideDir(CARDS_IMG_DIR, resolved);
    if (!allowed) return { success: false, error: 'Чтение этого файла не разрешено' };

    const fileContent = fs.readFileSync(resolved);
    allowedImportPaths.delete(resolved);
    return {
      success: true,
      base64Data: 'data:' + mimeType + ';base64,' + fileContent.toString('base64'),
      ext: path.extname(resolved).slice(1),
      filePath: resolved,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-image-as-base64', (event, relativePath) => {
  try {
    const { fileName, filePath } = cardFileFromRelative(relativePath);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found: ' + filePath };
    }
    const mimeType = mimeFromFilename(fileName);
    const fileContent = fs.readFileSync(filePath);
    return {
      success: true,
      dataUrl: 'data:' + mimeType + ';base64,' + fileContent.toString('base64'),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('move-image-file', (event, oldPath, newFilename) => {
  try {
    if (typeof oldPath !== 'string' || !oldPath) {
      return { success: false, error: 'Invalid path' };
    }
    const source = path.resolve(oldPath);
    if (!isInsideDir(CARDS_IMG_DIR, source)) {
      return { success: false, error: 'Перемещать можно только файлы из папки Cards' };
    }
    const safeName = safeImageFilename(newFilename);
    const dest = path.join(CARDS_IMG_DIR, safeName);
    if (!isInsideDir(CARDS_IMG_DIR, dest)) {
      return { success: false, error: 'Path traversal attempt' };
    }
    fs.renameSync(source, dest);
    return { success: true, relativePath: 'Cards/' + safeName };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('open-file-dialog', async () => {
  ensureConfigDir();
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: CARDS_IMG_DIR,
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
      ],
      properties: ['openFile']
    });
    if (!result.canceled && Array.isArray(result.filePaths)) {
      for (const selected of result.filePaths) {
        const resolved = path.resolve(selected);
        if (mimeFromFilename(resolved)) allowedImportPaths.add(resolved);
      }
    }
    return result;
  } catch (e) {
    return { canceled: true, error: e.message };
  }
});

ipcMain.handle('get-cards-dir', () => {
  ensureConfigDir();
  return CARDS_IMG_DIR;
});

ipcMain.handle('open-cards-dir', () => {
  ensureConfigDir();
  try {
    shell.openPath(CARDS_IMG_DIR);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

const AUTHOR_EXTERNAL_HOSTS = new Set([
  'boosty.to',
  'www.donationalerts.com',
  'donationalerts.com',
  't.me',
  'vk.com',
  'www.vk.com',
]);

ipcMain.handle('open-external-url', (event, url) => {
  try {
    if (typeof url !== 'string' || !url.trim()) {
      return { success: false, error: 'Пустая ссылка' };
    }
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: 'Недопустимый протокол' };
    }
    const host = parsed.hostname.toLowerCase();
    let allowed = AUTHOR_EXTERNAL_HOSTS.has(host);
    if (!allowed) {
      for (const suffix of AUTHOR_EXTERNAL_HOSTS) {
        if (host.endsWith('.' + suffix)) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) {
      return { success: false, error: 'Ссылка не в списке разрешённых' };
    }
    shell.openExternal(parsed.toString());
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('open-data-dir', () => {
  ensureConfigDir();
  try {
    shell.openPath(CONFIG_DIR);
    return { success: true, path: CONFIG_DIR };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-app-info', () => {
  return {
    version: APP_VERSION,
    dataDir: CONFIG_DIR,
    cardsDir: CARDS_IMG_DIR,
  };
});

ipcMain.handle('complete-onboarding', () => {
  try {
    const cfg = loadConfig();
    cfg.settings = cfg.settings || {};
    cfg.settings.onboarding = { ...(cfg.settings.onboarding || {}), completed: true };
    saveConfig(cfg);
    invalidateConfigCache();
    return { success: true, config: toPublicConfig(loadConfig(true)) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

function sanitizeConfigForBackup(config) {
  const copy = JSON.parse(JSON.stringify(config || {}));
  if (copy.twitch) {
    delete copy.twitch.accessToken;
    delete copy.twitch.refreshToken;
    delete copy.twitch.clientSecret;
  }
  delete copy.userCooldowns;
  delete copy._secretsNeedSeal;
  return copy;
}

ipcMain.handle('export-user-backup', async () => {
  try {
    ensureConfigDir();
    const payload = backupLib.exportUserData(CONFIG_DIR);
    if (payload.files['config.json']) {
      const cfg = JSON.parse(payload.files['config.json']);
      payload.files['config.json'] = JSON.stringify(sanitizeConfigForBackup(cfg), null, 2);
    }
    const defaultName = `ccg-bot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { success: true, filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('import-user-backup', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths?.length) return { success: false, canceled: true };
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const payload = JSON.parse(raw);
    if (payload.files?.['config.json']) {
      const imported = JSON.parse(payload.files['config.json']);
      const current = loadConfig(true);
      payload.files['config.json'] = JSON.stringify(
        {
          ...imported,
          twitch: current.twitch,
        },
        null,
        2
      );
    }
    backupLib.importUserData(CONFIG_DIR, payload);
    invalidateConfigCache();
    collectionsCache = null;
    cooldowns = null;
    addLog('[' + new Date().toLocaleTimeString() + '] 📦 Данные восстановлены из бэкапа');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('reset-collections', (event, payload = {}) => {
  try {
    const userId = payload.userId ? String(payload.userId) : null;
  if (userId) {
    const store = loadCollections();
    if (!store[userId]) return { success: false, error: 'Пользователь не найден' };
    delete store[userId];
    saveCollections(store);
    collectionsCache = store;
    addLog('[' + new Date().toLocaleTimeString() + '] 🗑️ Коллекция пользователя сброшена: ' + userId);
  } else {
    collectionsCache = {};
    saveCollections({});
    addLog('[' + new Date().toLocaleTimeString() + '] 🗑️ Все коллекции сброшены');
  }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apply-rarity-rename', (event, { from, to }) => {
  try {
    const fromName = String(from || '').trim();
    const toName = String(to || '').trim();
    if (!fromName || !toName) {
      return { success: false, error: 'Укажите старое и новое имя редкости' };
    }
    const cards = loadCards();
    let updated = 0;
    for (const card of cards) {
      if (card.rarity === fromName) {
        card.rarity = toName;
        updated += 1;
      }
    }
    if (updated) saveCards(cards);
    addLog(
      '[' + new Date().toLocaleTimeString() + '] ✏️ Редкость "' + fromName + '" → "' + toName + '" на ' + updated + ' картах'
    );
    return { success: true, updated };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

