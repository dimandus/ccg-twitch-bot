const assert = require('assert');
const {
  getRandomCard,
  findOrphanCardRarities,
  findEmptyConfiguredRarities,
} = require('../public/lib/cardDraw');

const cards = [
  { id: 1, name: 'A', rarity: 'Common' },
  { id: 2, name: 'B', rarity: 'Rare' },
];

const rarities = [
  { name: 'Common', weight: 50 },
  { name: 'Legendary', weight: 1 },
  { name: 'Rare', weight: 10 },
];

let onlyCommon = 0;
let onlyRare = 0;
for (let i = 0; i < 500; i += 1) {
  const card = getRandomCard(cards, rarities);
  assert.ok(card.rarity === 'Common' || card.rarity === 'Rare');
  if (card.rarity === 'Common') onlyCommon += 1;
  if (card.rarity === 'Rare') onlyRare += 1;
}
assert.ok(onlyCommon > 0 && onlyRare > 0, 'должны выпадать только редкости с картами');

assert.deepStrictEqual(findOrphanCardRarities(cards, rarities), []);
assert.deepStrictEqual(
  findOrphanCardRarities([{ id: 3, name: 'X', rarity: 'Epic' }], rarities),
  ['Epic']
);
assert.deepStrictEqual(findEmptyConfiguredRarities(cards, rarities), ['Legendary']);

console.log('card-draw.test.js: OK');
