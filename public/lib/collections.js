function createEmptyUser(username) {
  return {
    username: username || 'unknown',
    updatedAt: Date.now(),
    cards: {},
  };
}

function recordCardDraw(store, userId, username, card) {
  if (!userId || !card) return store;
  const next = { ...(store || {}) };
  const entry = next[userId] ? { ...next[userId], cards: { ...next[userId].cards } } : createEmptyUser(username);
  entry.username = username || entry.username;
  entry.updatedAt = Date.now();
  const key = String(card.id);
  entry.cards[key] = (entry.cards[key] || 0) + 1;
  next[userId] = entry;
  return next;
}

function buildRarityRankMap(rarities) {
  const map = {};
  (rarities || []).forEach((rarity, index) => {
    const name = String(rarity?.name || '').trim();
    if (name) map[name] = index + 1;
  });
  return map;
}

function getUserStats(entry, cardsById, rarityRankMap = {}) {
  if (!entry?.cards) {
    return {
      uniqueCount: 0,
      totalCount: 0,
      duplicateCount: 0,
      rankSum: 0,
      byRarity: {},
    };
  }

  let uniqueCount = 0;
  let totalCount = 0;
  let duplicateCount = 0;
  let rankSum = 0;
  const byRarity = {};

  for (const [cardId, count] of Object.entries(entry.cards)) {
    const qty = Number(count) || 0;
    if (qty <= 0) continue;
    totalCount += qty;
    uniqueCount += 1;
    if (qty > 1) duplicateCount += qty - 1;

    const meta = cardsById?.[cardId];
    const rarity = meta?.rarity || 'Unknown';
    byRarity[rarity] = (byRarity[rarity] || 0) + qty;

    const rank = Number(rarityRankMap[rarity]) || 0;
    rankSum += rank * qty;
  }

  return { uniqueCount, totalCount, duplicateCount, rankSum, byRarity };
}

function formatCollectionChatMessage(username, stats, format) {
  if (!stats?.totalCount) {
    return `@${username}, у вас 0 карт.`;
  }
  const values = {
    username,
    totalCount: String(stats.totalCount),
    rankSum: String(stats.rankSum || 0),
    uniqueCount: String(stats.uniqueCount || 0),
  };
  let message =
    format || '@{username}, у вас {totalCount} карт, сумма рангов: {rankSum}';
  for (const [key, value] of Object.entries(values)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return message;
}

function cardsIndex(cards) {
  const index = {};
  for (const card of cards || []) {
    if (card?.id != null) index[String(card.id)] = card;
  }
  return index;
}

module.exports = {
  recordCardDraw,
  getUserStats,
  buildRarityRankMap,
  formatCollectionChatMessage,
  cardsIndex,
};
