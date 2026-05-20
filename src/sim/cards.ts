import { categoryLabel, diceCategories } from './categories';
import { pickOne, type Rng } from './rng';
import { metaNodeById } from './meta';
import type { CardEffect, CardRarity, CardSpec, DiceCategory, MetaNodeId } from './types';

const rarityWeights: Array<{ rarity: CardRarity; weight: number }> = [
  { rarity: 'common', weight: 72 },
  { rarity: 'uncommon', weight: 23 },
  { rarity: 'rare', weight: 5 },
];

export function draftCards(rng: Rng, count = 3, boughtMetaNodes: MetaNodeId[] = []): CardSpec[] {
  const cards: CardSpec[] = [];
  const used = new Set<string>();
  let attempts = 0;
  const unlockedCards = [...unlockedCardsFor(boughtMetaNodes)]
    .map(cardFromUnlockId)
    .filter((card): card is CardSpec => Boolean(card));

  while (cards.length < count && attempts < count * 12) {
    attempts += 1;
    const card = createCard(rng, unlockedCards);
    if (used.has(card.id)) {
      continue;
    }
    used.add(card.id);
    cards.push(card);
  }

  while (cards.length < count) {
    const category = diceCategories[cards.length % diceCategories.length];
    const card: CardSpec = {
      id: `fallback-face-${category}-${cards.length}`,
      name: `+1 ${categoryLabel(category)} S${cards.length + 1}`,
      rarity: 'common',
      description: `+1 ${categoryLabel(category)} side ${cards.length + 1}`,
      effect: { type: 'addFaceValue', category, faceIndex: cards.length, amount: 1 },
    };
    cards.push(card);
  }

  return cards;
}

function createCard(rng: Rng, unlockedCards: CardSpec[]): CardSpec {
  const rarity = rollRarity(rng);
  const matchingUnlockedCards = unlockedCards.filter((card) => card.rarity === rarity);
  if (matchingUnlockedCards.length > 0 && rng.next() < 0.55) {
    return pickOne(matchingUnlockedCards, rng);
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
      name: `x2 ${label} Dice`,
      rarity,
      description: `x2 ${label} dice`,
      effect: { type: 'multiplyDice', category, multiplier: 2 },
    };
  }

  const faceIndex = Math.floor(rng.next() * 6);
  return {
    id: `common-face-${category}-${faceIndex}`,
    name: `+1 ${label} S${faceIndex + 1}`,
    rarity,
    description: `+1 ${label} side ${faceIndex + 1}`,
    effect: { type: 'addFaceValue', category, faceIndex, amount: 1 },
  };
}

function unlockedCardsFor(boughtMetaNodes: MetaNodeId[]): Set<string> {
  return new Set(boughtMetaNodes.flatMap((nodeId) => {
    const node = metaNodeById[nodeId];
    return node?.effect.type === 'unlockCard' ? [node.effect.cardId] : [];
  }));
}

function cardFromUnlockId(cardId: string): CardSpec | undefined {
  if (cardId === 'double-highest') {
    return unlockedCard(cardId, 'rare', '2x High', '2x highest roll', { type: 'doubleHighestRoll' });
  }

  if (cardId === 'top-bottom') {
    return unlockedCard(cardId, 'common', '+5 High -1 Low', '+5 highest, -1 lowest', { type: 'topBottomDelta', topAmount: 5, bottomAmount: -1 });
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

  const plus2 = matchCategoryCard(cardId, 'plus2-');
  if (plus2) {
    return unlockedCard(cardId, 'common', `+2 ${categoryLabel(plus2)}`, `+2 ${categoryLabel(plus2)}`, {
      type: 'categoryDelta',
      category: plus2,
      amount: 2,
    });
  }

  const rareDie = matchCategoryCard(cardId, 'rare-die-');
  if (rareDie) {
    return unlockedCard(cardId, 'rare', `x2 ${categoryLabel(rareDie)} Dice`, `x2 ${categoryLabel(rareDie)} dice`, {
      type: 'multiplyDice',
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
