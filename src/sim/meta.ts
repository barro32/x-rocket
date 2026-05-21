import type { DiceCategory, GameState, MetaNodeId, MetaNodeSpec } from './types';

const ringOne: MetaNodeSpec[] = [
  faceNode('thrusters-0', '+1 Thrusters S1', 'thrusters', 0),
  faceNode('fuel-0', '+1 Fuel S1', 'fuel', 0),
  faceNode('aerodynamics-0', '+1 Aero S1', 'aerodynamics', 0),
  faceNode('guidance-0', '+1 Guidance S1', 'guidance', 0),
  faceNode('weight-0', '+1 Weight S1', 'weight', 0),
  {
    id: 'weakest-0',
    label: '+1 Weakest',
    cost: 1,
    effect: { type: 'addWeakestFace', amount: 1 },
  },
];

const faceUpgradeSpecs = categoryCycle().flatMap((category) => [
  ...extraFaceUpgradeSpecs(category, 1, 3),
  ...extraFaceUpgradeSpecs(category, 0, 2, 2),
  ...extraFaceUpgradeSpecs(category, 2, 2),
  ...extraFaceUpgradeSpecs(category, 3, 2),
  ...extraFaceUpgradeSpecs(category, 4, 1),
]);

const unlockSpecs = [
  ...categoryCycle().map((category, index) => randomFaceCardUpgradeSpec(category, index)),
  rerollLowestSpec('reroll-lowest-0', '+1 Reroll Low', 0),
  rerollLowestSpec('reroll-lowest-1', '+1 Reroll Low', 1),
  unlockNodeSpec('unlock-double-highest', 'Unlock Rare 2x High', 'double-highest'),
  ...categoryCycle().map((category, index) => unlockNodeSpec(
    `unlock-plus3-minus1-${category}`,
    `Unlock +3 ${shortCategory(category)} -1 ${shortCategory(nextCategory(category))}`,
    `plus3-minus1-${category}`,
    index,
  )),
  ...categoryCycle().map((category, index) => unlockNodeSpec(
    `unlock-plus3-side1-${category}`,
    `Unlock +3 ${shortCategory(category)} S1`,
    `plus3-side1-${category}`,
    index + 5,
  )),
  ...categoryCycle().map((category, index) => unlockNodeSpec(
    `unlock-rare-die-${category}`,
    `Unlock Rare x2 ${shortCategory(category)}`,
    `rare-die-${category}`,
    index + 10,
  )),
  unlockNodeSpec('unlock-s6-three-stats', 'Unlock Rare +1 S6 x3', 's6-three-stats', 15),
  unlockNodeSpec('unlock-top-bottom', 'Unlock +5 High -1 Low', 'top-bottom'),
  ...categoryCycle().map((category, index) => unlockNodeSpec(
    `unlock-all-faces-${category}`,
    `Unlock +1 All ${shortCategory(category)}`,
    `all-faces-${category}`,
    index + 16,
  )),
];

const expansionNodes = [...faceUpgradeSpecs, ...unlockSpecs].map((spec): MetaNodeSpec => {
  if (spec.kind === 'face') {
    return faceNode(spec.id, spec.label, spec.category, spec.faceIndex);
  }

  if (spec.kind === 'randomFaceCardUpgrade') {
    return {
      id: spec.id,
      label: spec.label,
      cost: 1,
      effect: { type: 'upgradeRandomFaceCard', category: spec.category, amount: spec.amount },
    };
  }

  if (spec.kind === 'rerollLowest') {
    return {
      id: spec.id,
      label: spec.label,
      cost: 1,
      effect: { type: 'autoRerollLowest', amount: spec.amount },
    };
  }

  return {
    id: spec.id,
    label: spec.label,
    cost: 1,
    effect: { type: 'unlockCard', cardId: spec.cardId },
  };
});

export const metaNodes: MetaNodeSpec[] = [
  {
    id: 'startingCapital',
    label: '$5 -> $10',
    cost: 1,
    effect: { type: 'startingMoney' },
  },
  ...ringOne,
  ...expansionNodes,
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

function unlockNodeSpec(id: MetaNodeId, label: string, cardId: string, order = 0) {
  return { kind: 'unlock' as const, id, label, cardId, order };
}

function randomFaceCardUpgradeSpec(category: DiceCategory, order = 0) {
  return {
    kind: 'randomFaceCardUpgrade' as const,
    id: `upgrade-random-face-card-${category}`,
    label: `Cards: +2 ${shortCategory(category)}`,
    category,
    amount: 2,
    order,
  };
}

function rerollLowestSpec(id: MetaNodeId, label: string, order = 0) {
  return {
    kind: 'rerollLowest' as const,
    id,
    label,
    amount: 1,
    order,
  };
}

function extraFaceUpgradeSpecs(category: DiceCategory, faceIndex: number, count: number, startInstance = 1) {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'face' as const,
    id: faceUpgradeId(category, faceIndex, startInstance + index),
    label: `+1 ${shortCategory(category)} S${faceIndex + 1}`,
    category,
    faceIndex,
  }));
}

function faceUpgradeId(category: DiceCategory, faceIndex: number, instance: number): MetaNodeId {
  return instance === 1 ? `${category}-${faceIndex}` : `${category}-${faceIndex}-${instance}`;
}

function categoryCycle(): DiceCategory[] {
  return ['thrusters', 'fuel', 'aerodynamics', 'guidance', 'weight'];
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
