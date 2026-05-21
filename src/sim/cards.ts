import { categoryLabel, diceCategories } from './categories';
import { pickOne, type Rng } from './rng';
import { metaNodeById } from './meta';
import type { CardEffect, CardRarity, CardSpec, DiceCategory, MetaNodeId } from './types';

export interface CardPoolEntry {
  id: string;
  name: string;
  rarity: CardRarity;
  description: string;
  source: 'base' | 'meta';
}

const rarityWeights: Array<{ rarity: CardRarity; weight: number }> = [
  { rarity: 'common', weight: 72 },
  { rarity: 'uncommon', weight: 23 },
  { rarity: 'rare', weight: 5 },
];

export function draftCards(rng: Rng, count = 3, boughtMetaNodes: MetaNodeId[] = []): CardSpec[] {
  const cards: CardSpec[] = [];
  const used = new Set<string>();
  let attempts = 0;
  const unlockedCardIds = [...unlockedCardsFor(boughtMetaNodes)];

  while (cards.length < count && attempts < count * 12) {
    attempts += 1;
    const card = createCard(rng, unlockedCardIds, boughtMetaNodes);
    if (used.has(card.id)) {
      continue;
    }
    used.add(card.id);
    cards.push(card);
  }

  while (cards.length < count) {
    const category = diceCategories[cards.length % diceCategories.length];
    const sideCount = randomFaceCardSideCount(category, boughtMetaNodes);
    const faceIndex = cards.length % 6;
    const faceIndexes = Array.from({ length: sideCount }, (_, index) => (faceIndex + index) % 6);
    const totalAmount = faceIndexes.length;
    const card: CardSpec = {
      id: `fallback-random-face-${category}-${faceIndexes.join('-')}-${cards.length}`,
      name: `+${totalAmount} ${categoryLabel(category)} ${sideLabel(faceIndexes)}`,
      rarity: 'common',
      description: `+1 ${categoryLabel(category)} ${sideDescription(faceIndexes)}`,
      effect: { type: 'addRandomFaceValue', category, faceIndexes, amount: 1 },
    };
    cards.push(card);
  }

  return cards;
}

export function unlockedCardPoolFor(boughtMetaNodes: MetaNodeId[]): CardPoolEntry[] {
  return [
    ...diceCategories.map((category): CardPoolEntry => {
      const sideCount = randomFaceCardSideCount(category, boughtMetaNodes);
      return {
        id: `base-random-face-${category}`,
        name: `+${sideCount} ${categoryLabel(category)} random ${sideCount === 1 ? 'side' : 'sides'}`,
        rarity: 'common',
        description: sideCount === 1
          ? `+1 ${categoryLabel(category)} on one predetermined random side`
          : `+1 ${categoryLabel(category)} on ${sideCount} predetermined random sides`,
        source: 'base',
      };
    }),
    ...diceCategories.map((category): CardPoolEntry => ({
      id: `base-x2-${category}`,
      name: `x2 ${categoryLabel(category)}`,
      rarity: 'uncommon',
      description: `x2 ${categoryLabel(category)} roll`,
      source: 'base',
    })),
    {
      id: 'base-auto-reroll',
      name: '+1 Auto Reroll',
      rarity: 'rare',
      description: 'Reroll lowest each launch',
      source: 'base',
    },
    ...[...unlockedCardsFor(boughtMetaNodes)]
      .map(cardPoolEntryFromUnlockId)
      .filter((entry): entry is CardPoolEntry => Boolean(entry)),
  ];
}

function createCard(rng: Rng, unlockedCardIds: string[], boughtMetaNodes: MetaNodeId[]): CardSpec {
  const rarity = rollRarity(rng);
  const matchingUnlockedCardIds = unlockedCardIds.filter((cardId) => unlockedCardRarity(cardId) === rarity);
  if (matchingUnlockedCardIds.length > 0 && rng.next() < 0.55) {
    const card = cardFromUnlockId(pickOne(matchingUnlockedCardIds, rng), rng);
    if (card) {
      return card;
    }
  }

  if (rarity === 'rare') {
    return {
      id: `rare-reroll-${Math.floor(rng.next() * 100000)}`,
      name: '+1 Auto Reroll',
      rarity,
      description: 'Reroll lowest each launch',
      effect: { type: 'autoRerollLowest', amount: 1 },
    };
  }

  const category = pickOne(diceCategories, rng);
  const label = categoryLabel(category);

  if (rarity === 'uncommon') {
    return {
      id: `uncommon-x2-${category}`,
      name: `x2 ${label}`,
      rarity,
      description: `x2 ${label} roll`,
      effect: { type: 'multiplyStat', category, multiplier: 2 },
    };
  }

  const sideCount = randomFaceCardSideCount(category, boughtMetaNodes);
  const faceIndexes = randomFaceIndexes(rng, sideCount);
  const totalAmount = faceIndexes.length;
  return {
    id: `common-random-face-${category}-${faceIndexes.join('-')}`,
    rarity,
    name: `+${totalAmount} ${label} ${sideLabel(faceIndexes)}`,
    description: `+1 ${label} ${sideDescription(faceIndexes)}`,
    effect: { type: 'addRandomFaceValue', category, faceIndexes, amount: 1 },
  };
}

function unlockedCardsFor(boughtMetaNodes: MetaNodeId[]): Set<string> {
  return new Set(boughtMetaNodes.flatMap((nodeId) => {
    const node = metaNodeById[nodeId];
    return node?.effect.type === 'unlockCard' ? [node.effect.cardId] : [];
  }));
}

function randomFaceCardSideCount(category: DiceCategory, boughtMetaNodes: MetaNodeId[]): number {
  return boughtMetaNodes.reduce((amount, nodeId) => {
    const node = metaNodeById[nodeId];
    return node?.effect.type === 'upgradeRandomFaceCard' && node.effect.category === category
      ? Math.max(amount, node.effect.amount)
      : amount;
  }, 1);
}

function randomFaceIndexes(rng: Rng, count: number): number[] {
  const indexes: number[] = [];
  const targetCount = Math.min(count, 6);
  let attempts = 0;
  while (indexes.length < targetCount && attempts < 24) {
    attempts += 1;
    const faceIndex = Math.floor(rng.next() * 6);
    if (!indexes.includes(faceIndex)) {
      indexes.push(faceIndex);
    }
  }

  for (let faceIndex = 0; indexes.length < targetCount && faceIndex < 6; faceIndex += 1) {
    if (!indexes.includes(faceIndex)) {
      indexes.push(faceIndex);
    }
  }

  return indexes.sort((a, b) => a - b);
}

function sideLabel(faceIndexes: number[]): string {
  return faceIndexes.map((faceIndex) => `S${faceIndex + 1}`).join('/');
}

function sideDescription(faceIndexes: number[]): string {
  if (faceIndexes.length === 1) {
    return `side ${faceIndexes[0] + 1}`;
  }

  return `sides ${faceIndexes.map((faceIndex) => faceIndex + 1).join(' and ')}`;
}

function cardFromUnlockId(cardId: string, rng: Rng): CardSpec | undefined {
  if (cardId === 'double-highest') {
    return unlockedCard(cardId, 'rare', '2x High', '2x highest roll', { type: 'doubleHighestRoll' });
  }

  if (cardId === 'top-bottom') {
    return unlockedCard(cardId, 'common', '+5 High -1 Low', '+5 highest roll, -1 lowest roll', { type: 'topBottomDelta', topAmount: 5, bottomAmount: -1 });
  }

  if (cardId === 's6-three-stats') {
    const categories = randomCategories(rng, 3);
    return unlockedCard(
      `${cardId}-${categories.join('-')}`,
      'rare',
      '+1 S6 x3',
      `+1 side 6: ${categories.map(categoryLabel).join(', ')}`,
      { type: 'addFaceValueToCategories', categories, faceIndex: 5, amount: 1 },
    );
  }

  const plus3 = matchCategoryCard(cardId, 'plus3-minus1-');
  if (plus3) {
    const penaltyCategory = nextCategory(plus3);
    return unlockedCard(
      cardId,
      'common',
      `+3 ${categoryLabel(plus3)} -1 ${categoryLabel(penaltyCategory)}`,
      `+3 ${categoryLabel(plus3)}, -1 ${categoryLabel(penaltyCategory)}`,
      { type: 'categoryDelta', category: plus3, amount: 3, penaltyCategory, penaltyAmount: -1 },
    );
  }

  const plus3SideOne = matchCategoryCard(cardId, 'plus3-side1-');
  if (plus3SideOne) {
    return unlockedCard(cardId, 'common', `+3 ${categoryLabel(plus3SideOne)} S1`, `+3 ${categoryLabel(plus3SideOne)} side 1`, {
      type: 'addFaceValue',
      category: plus3SideOne,
      faceIndex: 0,
      amount: 3,
    });
  }

  const rareDie = matchCategoryCard(cardId, 'rare-die-');
  if (rareDie) {
    return unlockedCard(cardId, 'rare', `x2 ${categoryLabel(rareDie)}`, `x2 ${categoryLabel(rareDie)} roll`, {
      type: 'multiplyStat',
      category: rareDie,
      multiplier: 2,
    });
  }

  const allFaces = matchCategoryCard(cardId, 'all-faces-');
  if (allFaces) {
    return unlockedCard(cardId, 'rare', `+1 All ${categoryLabel(allFaces)}`, `+1 all ${categoryLabel(allFaces)} faces`, {
      type: 'addAllFaces',
      category: allFaces,
      amount: 1,
    });
  }

  return undefined;
}

function unlockedCard(id: string, rarity: CardRarity, name: string, description: string, effect: CardEffect): CardSpec {
  return { id, rarity, name, description, effect };
}

function cardPoolEntryFromUnlockId(cardId: string): CardPoolEntry | undefined {
  if (cardId === 'double-highest') {
    return unlockedCardPoolEntry(cardId, 'rare', '2x High', '2x highest roll');
  }

  if (cardId === 'top-bottom') {
    return unlockedCardPoolEntry(cardId, 'common', '+5 High -1 Low', '+5 highest roll, -1 lowest roll');
  }

  if (cardId === 's6-three-stats') {
    return unlockedCardPoolEntry(cardId, 'rare', '+1 S6 x3', '+1 side 6 on 3 predetermined random stats');
  }

  const plus3 = matchCategoryCard(cardId, 'plus3-minus1-');
  if (plus3) {
    const penaltyCategory = nextCategory(plus3);
    return unlockedCardPoolEntry(
      cardId,
      'common',
      `+3 ${categoryLabel(plus3)} -1 ${categoryLabel(penaltyCategory)}`,
      `+3 ${categoryLabel(plus3)}, -1 ${categoryLabel(penaltyCategory)}`,
    );
  }

  const plus3SideOne = matchCategoryCard(cardId, 'plus3-side1-');
  if (plus3SideOne) {
    return unlockedCardPoolEntry(cardId, 'common', `+3 ${categoryLabel(plus3SideOne)} S1`, `+3 ${categoryLabel(plus3SideOne)} side 1`);
  }

  const rareDie = matchCategoryCard(cardId, 'rare-die-');
  if (rareDie) {
    return unlockedCardPoolEntry(cardId, 'rare', `x2 ${categoryLabel(rareDie)}`, `x2 ${categoryLabel(rareDie)} roll`);
  }

  const allFaces = matchCategoryCard(cardId, 'all-faces-');
  if (allFaces) {
    return unlockedCardPoolEntry(cardId, 'rare', `+1 All ${categoryLabel(allFaces)}`, `+1 all ${categoryLabel(allFaces)} faces`);
  }

  return undefined;
}

function unlockedCardPoolEntry(id: string, rarity: CardRarity, name: string, description: string): CardPoolEntry {
  return { id, rarity, name, description, source: 'meta' };
}

function unlockedCardRarity(cardId: string): CardRarity | undefined {
  if (cardId === 'double-highest' || cardId === 's6-three-stats') {
    return 'rare';
  }

  if (cardId === 'top-bottom') {
    return 'common';
  }

  if (matchCategoryCard(cardId, 'plus3-minus1-') || matchCategoryCard(cardId, 'plus3-side1-')) {
    return 'common';
  }

  if (matchCategoryCard(cardId, 'rare-die-') || matchCategoryCard(cardId, 'all-faces-')) {
    return 'rare';
  }

  return undefined;
}

function randomCategories(rng: Rng, count: number): DiceCategory[] {
  const categories: DiceCategory[] = [];
  let attempts = 0;
  while (categories.length < Math.min(count, diceCategories.length) && attempts < 24) {
    attempts += 1;
    const category = pickOne(diceCategories, rng);
    if (!categories.includes(category)) {
      categories.push(category);
    }
  }

  for (const category of diceCategories) {
    if (categories.length >= count) {
      break;
    }
    if (!categories.includes(category)) {
      categories.push(category);
    }
  }

  return categories;
}

function matchCategoryCard(cardId: string, prefix: string): DiceCategory | undefined {
  const category = cardId.slice(prefix.length);
  return diceCategories.includes(category as DiceCategory) ? category as DiceCategory : undefined;
}

function nextCategory(category: DiceCategory): DiceCategory {
  return diceCategories[(diceCategories.indexOf(category) + 1) % diceCategories.length];
}

function rollRarity(rng: Rng): CardRarity {
  const total = rarityWeights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * total;
  for (const entry of rarityWeights) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.rarity;
    }
  }
  return 'common';
}
