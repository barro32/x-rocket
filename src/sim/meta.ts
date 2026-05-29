import { activeDiceCategoriesFor, unlockDiceNodeId } from './categories';
import type { DiceCategory, GameState, MetaNodeId, MetaNodeSpec } from './types';

const ringOne: MetaNodeSpec[] = [
  faceNode('thrusters-0', '+1 Thrusters S1', 'thrusters', 0),
  faceNode('fuel-0', '+1 Fuel S1', 'fuel', 0),
  unlockDiceNode('aerodynamics'),
  unlockDiceNode('guidance'),
  unlockDiceNode('weight'),
  {
    id: 'weakest-0',
    label: '+1 Weakest',
    cost: 1,
    effect: { type: 'addWeakestFace', amount: 1 },
  },
];

const ringTwo: MetaNodeSpec[] = [
  faceUpgradeNode('thrusters', 1),
  faceUpgradeNode('fuel', 1),
  faceUpgradeNode('thrusters', 0, 2),
  faceUpgradeNode('fuel', 0, 2),
  randomFaceCardUpgradeNode('thrusters'),
  randomFaceCardUpgradeNode('fuel'),
  rerollLowestNode('reroll-lowest-0'),
  unlockCardNode('unlock-top-bottom', 'Unlock +5 High -1 Low', 'top-bottom'),
  plus3Minus1UnlockNode('thrusters'),
  plus3Minus1UnlockNode('fuel'),
  plus3SideOneUnlockNode('thrusters'),
  plus3SideOneUnlockNode('fuel'),
];

const ringThree: MetaNodeSpec[] = [
  ...unlockedDiceCategories().map((category) => faceUpgradeNode(category, 1)),
  ...unlockedDiceCategories().map((category) => faceUpgradeNode(category, 0, 2)),
  ...unlockedDiceCategories().map(randomFaceCardUpgradeNode),
  ...unlockedDiceCategories().map(plus3SideOneUnlockNode),
  rareDieUnlockNode('thrusters'),
  rareDieUnlockNode('fuel'),
  unlockCardNode('unlock-double-highest', 'Unlock Rare 2x High', 'double-highest'),
  rerollLowestNode('reroll-lowest-1'),
  plus3Minus1UnlockNode('aerodynamics'),
  plus3Minus1UnlockNode('guidance'),
];

const ringFour: MetaNodeSpec[] = [
  ...categoryCycle().map((category) => faceUpgradeNode(category, 1, 2)),
  ...categoryCycle().map((category) => faceUpgradeNode(category, 2)),
  ...categoryCycle().map((category) => faceUpgradeNode(category, 3)),
  ...categoryCycle().map((category) => faceUpgradeNode(category, 0, 3)),
  ...unlockedDiceCategories().map(rareDieUnlockNode),
  unlockCardNode('unlock-s6-three-stats', 'Unlock Rare +1 S6 x3', 's6-three-stats'),
];

const ringFive: MetaNodeSpec[] = [
  ...categoryCycle().map((category) => faceUpgradeNode(category, 1, 3)),
  ...categoryCycle().map((category) => faceUpgradeNode(category, 2, 2)),
  ...categoryCycle().map((category) => faceUpgradeNode(category, 3, 2)),
  ...categoryCycle().map((category) => faceUpgradeNode(category, 4)),
  ...unlockedDiceCategories().map((category) => faceUpgradeNode(category, 0, 4)),
  ...categoryCycle().map(allFacesUnlockNode),
  plus3Minus1UnlockNode('weight'),
];

export const metaNodes: MetaNodeSpec[] = [
  {
    id: 'startingCapital',
    label: '$5 -> $10',
    cost: 1,
    effect: { type: 'startingMoney' },
  },
  ...ringOne,
  ...ringTwo,
  ...ringThree,
  ...ringFour,
  ...ringFive,
];

export const metaNodeById = Object.fromEntries(metaNodes.map((node) => [node.id, node])) as Record<MetaNodeId, MetaNodeSpec>;
export type PositionedMetaNodeSpec = MetaNodeSpec & { x: number; y: number; z: number };
export const positionedMetaNodes: PositionedMetaNodeSpec[] = metaNodes.map((node, index) => {
  const [x, y, z] = coordForOrderedIndex(index);
  return { ...node, x, y, z };
});
const positionedMetaNodeById = Object.fromEntries(positionedMetaNodes.map((node) => [node.id, node])) as Record<MetaNodeId, PositionedMetaNodeSpec>;

export function canBuyMetaNode(state: GameState, id: MetaNodeId): boolean {
  const node = metaNodeById[id];
  if (!node) {
    return false;
  }

  if (state.boughtMetaNodes.includes(id)) {
    return false;
  }

  if (state.metaCurrency < node.cost) {
    return false;
  }

  if (id === 'startingCapital') {
    return true;
  }

  if (isCategoryLockedForNode(state, node)) {
    return false;
  }

  return state.boughtMetaNodes.some((boughtId) => {
    const boughtNode = positionedMetaNodeById[boughtId];
    const positionedNode = positionedMetaNodeById[id];
    return positionedNode && boughtNode ? cubeDistance(positionedNode, boughtNode) === 1 : false;
  });
}

export function buyMetaNode(state: GameState, id: MetaNodeId): GameState {
  if (!canBuyMetaNode(state, id)) {
    return state;
  }

  return {
    ...state,
    metaCurrency: state.metaCurrency - metaNodeById[id].cost,
    boughtMetaNodes: [...state.boughtMetaNodes, id],
  };
}

export function isMetaNodeUnlocked(state: GameState, id: MetaNodeId): boolean {
  if (id === 'startingCapital') {
    return true;
  }

  return state.boughtMetaNodes.some((boughtId) => {
    const node = positionedMetaNodeById[id];
    const boughtNode = positionedMetaNodeById[boughtId];
    return node && boughtNode ? cubeDistance(node, boughtNode) === 1 : false;
  });
}

function cubeDistance(a: PositionedMetaNodeSpec, b: PositionedMetaNodeSpec): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

function faceNode(
  id: MetaNodeId,
  label: string,
  category: DiceCategory,
  faceIndex: number,
): MetaNodeSpec {
  return {
    id,
    label,
    cost: 1,
    effect: { type: 'addFaceValue', category, faceIndex, amount: 1 },
  };
}

function unlockDiceNode(category: DiceCategory): MetaNodeSpec {
  return {
    id: unlockDiceNodeId(category),
    label: `Unlock ${shortCategory(category)}`,
    cost: 1,
    effect: { type: 'unlockDice', category },
  };
}

function faceUpgradeNode(category: DiceCategory, faceIndex: number, instance = 1): MetaNodeSpec {
  return faceNode(
    faceUpgradeId(category, faceIndex, instance),
    `+1 ${shortCategory(category)} S${faceIndex + 1}`,
    category,
    faceIndex,
  );
}

function randomFaceCardUpgradeNode(category: DiceCategory): MetaNodeSpec {
  return {
    id: `upgrade-random-face-card-${category}`,
    label: `Cards: +2 ${shortCategory(category)}`,
    cost: 1,
    effect: { type: 'upgradeRandomFaceCard', category, amount: 2 },
  };
}

function rerollLowestNode(id: MetaNodeId): MetaNodeSpec {
  return {
    id,
    label: '+1 Reroll Low',
    cost: 1,
    effect: { type: 'autoRerollLowest', amount: 1 },
  };
}

function unlockCardNode(id: MetaNodeId, label: string, cardId: string): MetaNodeSpec {
  return {
    id,
    label,
    cost: 1,
    effect: { type: 'unlockCard', cardId },
  };
}

function plus3Minus1UnlockNode(category: DiceCategory): MetaNodeSpec {
  return unlockCardNode(
    `unlock-plus3-minus1-${category}`,
    `Unlock +3 ${shortCategory(category)} -1 ${shortCategory(nextCategory(category))}`,
    `plus3-minus1-${category}`,
  );
}

function plus3SideOneUnlockNode(category: DiceCategory): MetaNodeSpec {
  return unlockCardNode(
    `unlock-plus3-side1-${category}`,
    `Unlock +3 ${shortCategory(category)} S1`,
    `plus3-side1-${category}`,
  );
}

function rareDieUnlockNode(category: DiceCategory): MetaNodeSpec {
  return unlockCardNode(
    `unlock-rare-die-${category}`,
    `Unlock Rare x2 ${shortCategory(category)}`,
    `rare-die-${category}`,
  );
}

function allFacesUnlockNode(category: DiceCategory): MetaNodeSpec {
  return unlockCardNode(
    `unlock-all-faces-${category}`,
    `Unlock +1 All ${shortCategory(category)}`,
    `all-faces-${category}`,
  );
}

function isCategoryLockedForNode(state: GameState, node: MetaNodeSpec): boolean {
  const activeCategories = activeDiceCategoriesFor(state.boughtMetaNodes);
  switch (node.effect.type) {
    case 'addFaceValue':
    case 'upgradeRandomFaceCard':
      return !activeCategories.includes(node.effect.category);
    case 'unlockCard':
      if (node.effect.cardId === 's6-three-stats') {
        return activeCategories.length < 3;
      }
      return !categoriesForCardId(node.effect.cardId).every((category) => activeCategories.includes(category));
    case 'startingMoney':
    case 'unlockDice':
    case 'addWeakestFace':
    case 'autoRerollLowest':
      return false;
  }
}

function categoriesForCardId(cardId: string): DiceCategory[] {
  if (cardId === 'double-highest' || cardId === 'top-bottom' || cardId === 's6-three-stats') {
    return [];
  }

  const plus3 = matchCategoryCard(cardId, 'plus3-minus1-');
  if (plus3) {
    return [plus3, nextCategory(plus3)];
  }

  return [
    matchCategoryCard(cardId, 'plus3-side1-'),
    matchCategoryCard(cardId, 'rare-die-'),
    matchCategoryCard(cardId, 'all-faces-'),
  ].filter((category): category is DiceCategory => Boolean(category));
}

function matchCategoryCard(cardId: string, prefix: string): DiceCategory | undefined {
  const category = cardId.startsWith(prefix) ? cardId.slice(prefix.length) : '';
  return categoryCycle().includes(category as DiceCategory) ? category as DiceCategory : undefined;
}

function coordForOrderedIndex(index: number): [number, number, number] {
  if (index === 0) {
    return [0, 0, 0];
  }

  let radius = 1;
  let remaining = index;
  while (remaining > radius * 6) {
    remaining -= radius * 6;
    radius += 1;
  }

  return ringCoords(radius)[remaining - 1];
}

function ringCoords(radius: number): Array<[number, number, number]> {
  const directions: Array<[number, number, number]> = [
    [0, 1, -1],
    [-1, 1, 0],
    [-1, 0, 1],
    [0, -1, 1],
    [1, -1, 0],
    [1, 0, -1],
  ];
  const coords: Array<[number, number, number]> = [];
  let x = radius;
  let y = -radius;
  let z = 0;

  for (const [dx, dy, dz] of directions) {
    for (let step = 0; step < radius; step += 1) {
      coords.push([x, y, z]);
      x += dx;
      y += dy;
      z += dz;
    }
  }

  return coords;
}

function faceUpgradeId(category: DiceCategory, faceIndex: number, instance: number): MetaNodeId {
  return instance === 1 ? `${category}-${faceIndex}` : `${category}-${faceIndex}-${instance}`;
}

function categoryCycle(): DiceCategory[] {
  return ['thrusters', 'fuel', 'aerodynamics', 'guidance', 'weight'];
}

function unlockedDiceCategories(): DiceCategory[] {
  return ['aerodynamics', 'guidance', 'weight'];
}

function nextCategory(category: DiceCategory): DiceCategory {
  const categories = categoryCycle();
  return categories[(categories.indexOf(category) + 1) % categories.length];
}

function shortCategory(category: DiceCategory): string {
  switch (category) {
    case 'thrusters':
      return 'Thrusters';
    case 'fuel':
      return 'Fuel';
    case 'aerodynamics':
      return 'Aero';
    case 'guidance':
      return 'Guidance';
    case 'weight':
      return 'Weight';
  }
}
