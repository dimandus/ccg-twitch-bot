const fs = require('fs');
const path = require('path');

const DATA_FILES = ['config.json', 'cards.json', 'collections.json', 'cooldowns.json'];

function exportUserData(configDir) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    files: {},
  };
  for (const name of DATA_FILES) {
    const filePath = path.join(configDir, name);
    if (!fs.existsSync(filePath)) continue;
    payload.files[name] = fs.readFileSync(filePath, 'utf8');
  }
  return payload;
}

function importUserData(configDir, payload) {
  if (!payload || typeof payload !== 'object' || !payload.files) {
    throw new Error('Неверный формат бэкапа');
  }
  const allowed = new Set(DATA_FILES);
  for (const [name, content] of Object.entries(payload.files)) {
    if (!allowed.has(name)) continue;
    if (typeof content !== 'string') continue;
    JSON.parse(content);
    const tmp = path.join(configDir, name + '.tmp');
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, path.join(configDir, name));
  }
}

module.exports = {
  DATA_FILES,
  exportUserData,
  importUserData,
};
