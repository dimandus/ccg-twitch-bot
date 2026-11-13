const TWITCH_MESSAGE_LIMIT = 500;

function clampTwitchMessage(message, max = TWITCH_MESSAGE_LIMIT) {
  if (message == null) return '';
  const text = String(message);
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 3)) + '...';
}

module.exports = {
  TWITCH_MESSAGE_LIMIT,
  clampTwitchMessage,
};
