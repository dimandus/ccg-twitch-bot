function normalizeRarities(rarities) {
  return (rarities || [])
    .map((rarity) => ({ name: String(rarity?.name || '').trim(), weight: Number(rarity?.weight) || 0 }))
    .filter((rarity) => rarity.name && rarity.weight > 0);
}

function pickWeightedRarity(rarities) {
  const totalWeight = rarities.reduce((sum, rarity) => sum + rarity.weight, 0);
  let random = Math.random() * totalWeight;
  let selected = rarities[rarities.length - 1].name;
  for (const rarity of rarities) {
    random -= rarity.weight;
    if (random <= 0) {
      selected = rarity.name;
      break;
    }
  }
  return selected;
}

function getRandomCard(cards, raritiesConfig) {
  const cardsList = Array.isArray(cards) ? cards : [];
  const fallback = { id: 0, name: 'Неизвестная карточка', rarity: 'Common', color: '#FF6B35', image: '' };

  if (cardsList.length === 0) return fallback;

  const rarities = normalizeRarities(raritiesConfig);
  if (rarities.length === 0) {
    return cardsList[Math.floor(Math.random() * cardsList.length)];
  }

  const eligibleRarities = rarities.filter((rarity) =>
    cardsList.some((card) => card.rarity === rarity.name)
  );

  if (eligibleRarities.length === 0) {
    return cardsList[Math.floor(Math.random() * cardsList.length)];
  }

  const selectedRarity = pickWeightedRarity(eligibleRarities);
  const cardsWithRarity = cardsList.filter((card) => card.rarity === selectedRarity);
  return cardsWithRarity[Math.floor(Math.random() * cardsWithRarity.length)];
}

function findOrphanCardRarities(cards, raritiesConfig) {
  const configured = new Set(normalizeRarities(raritiesConfig).map((r) => r.name));
  const orphans = new Set();
  for (const card of cards || []) {
    if (card?.rarity && !configured.has(card.rarity)) {
      orphans.add(card.rarity);
    }
  }
  return Array.from(orphans);
}

function findEmptyConfiguredRarities(cards, raritiesConfig) {
  const cardsList = cards || [];
  return normalizeRarities(raritiesConfig)
    .filter((rarity) => !cardsList.some((card) => card.rarity === rarity.name))
    .map((rarity) => rarity.name);
}

module.exports = {
  getRandomCard,
  normalizeRarities,
  findOrphanCardRarities,
  findEmptyConfiguredRarities,
};
