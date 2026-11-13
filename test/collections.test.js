const assert = require('assert');
const {
  getUserStats,
  buildRarityRankMap,
  formatCollectionChatMessage,
} = require('../public/lib/collections');

const cardsById = {
  '1': { id: 1, name: 'A', rarity: 'Common' },
  '2': { id: 2, name: 'B', rarity: 'Legendary' },
};

const ranks = buildRarityRankMap([
  { name: 'Common', weight: 50 },
  { name: 'Legendary', weight: 1 },
]);

const entry = {
  username: 'tester',
  cards: { '1': 2, '2': 1 },
};

const stats = getUserStats(entry, cardsById, ranks);
assert.strictEqual(stats.totalCount, 3);
assert.strictEqual(stats.rankSum, 2 * 1 + 1 * 2);
assert.strictEqual(stats.byRarity.Common, 2);

const msg = formatCollectionChatMessage('Nick', stats, '@{username}: {totalCount} / {rankSum}');
assert.ok(msg.includes('Nick'));
assert.ok(msg.includes('3'));
assert.ok(msg.includes('4'));

console.log('collections.test.js: OK');
