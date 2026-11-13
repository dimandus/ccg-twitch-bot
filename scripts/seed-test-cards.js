const fs = require('fs');
const path = require('path');
const os = require('os');

const cards = require('../data/test-cards.json');

const candidates = [
  process.env.CCG_BOT_DATA_DIR,
  process.env.APPDATA && path.join(process.env.APPDATA, 'ccg-twitch-bot', 'ccg-bot'),
  process.env.APPDATA && path.join(process.env.APPDATA, 'CCG Twitch Bot', 'ccg-bot'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'ccg-twitch-bot', 'ccg-bot'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'CCG Twitch Bot', 'ccg-bot'),
].filter(Boolean);

const targetDir = candidates.find((dir) => fs.existsSync(dir)) || candidates[0];
if (!targetDir) {
  console.error('Не найдена папка данных бота. Укажите CCG_BOT_DATA_DIR.');
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const cardsFile = path.join(targetDir, 'cards.json');
fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log('Записано', cards.length, 'тестовых карт в', cardsFile);
