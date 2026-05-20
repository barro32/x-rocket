import type { DiceCategory, GameState, MetaNodeId, MetaNodeSpec } from './types';

const ringOne: MetaNodeSpec[] = [
  faceNode('thrusters-0', '+1 Thrusters S1', 1, -1, 0, 'thrusters', 0),
  faceNode('fuel-0', '+1 Fuel S1', 1, 0, -1, 'fuel', 0),
  faceNode('aerodynamics-0', '+1 Aero S1', 0, 1, -1, 'aerodynamics', 0),
  faceNode('guidance-0', '+1 Guidance S1', -1, 1, 0, 'guidance', 0),
  faceNode('weight-0', '+1 Weight S1', -1, 0, 1, 'weight', 0),
  {
    id: 'weakest-0',
    label: '+1 Weakest',
    cost: 1,
    x: 0,
    y: -1,
    z: 1,
    effect: { type: 'addWeakestFace', amount: 1 },
  },
];

const ringTwoCoords: Array<[number, number, number]> = [
  [2, -2, 0],
  [2, -1, -1],
  [2, 0, -2],
  [1, 1, -2],
  [0, 2, -2],
  [-1, 2, -1],
  [-2, 2, 0],
  [-2, 1, 1],
  [-2, 0, 2],
  [-1, -1, 2],
  [0, -2, 2],
  [1, -2, 1],
];

const ringTwo = ringTwoCoords.map(([x, y, z], index) => {
  const categories: DiceCategory[] = ['thrusters', 'fuel', 'aerodynamics', 'guidance', 'weight'];
  const category = categories[index % categories.length];
  const faceIndex = 1 + Math.floor(index / categories.length);
  return faceNode(`${category}-${faceIndex}`, `+1 ${shortCategory(category)} S${faceIndex + 1}`, x, y, z, category, faceIndex);
});

const newUpgradeSpecs = [
  unlockNodeSpec('unlock-double-highest', 'Unlock Rare 2x High', 'double-highest'),
  ...categoryCycle().map((category, index) => unlockNodeSpec(
    `unlock-plus3-minus1-${category}`,
    `Unlock +3 ${shortCategory(category)} -1 ${shortCategory(nextCategory(category))}`,
    `plus3-minus1-${category}`,
    index,
  )),
  ...categoryCycle().map((category, index) => unlockNodeSpec(
    `unlock-plus2-${category}`,
    `Unlock +2 ${shortCategory(category)}`,
    `plus2-${category}`,
    index + 5,
  )),
  ...categoryCycle().map((category, index) => unlockNodeSpec(
    `unlock-rare-die-${category}`,
    `Unlock Rare x2 ${shortCategory(category)} Dice`,
    `rare-die-${category}`,
    index + 10,
  )),
  ...categoryCycle().flatMap((category) => [4, 5].map((faceIndex) => ({
    kind: 'face' as const,
    id: `${category}-${faceIndex}`,
    label: `+1 ${shortCategory(category)} S${faceIndex + 1}`,
    category,
    faceIndex,
  }))),
  unlockNodeSpec('unlock-top-bottom', 'Unlock +5 High -1 Low', 'top-bottom'),
  ...categoryCycle().map((category, index) => unlockNodeSpec(
    `unlock-all-faces-${category}`,
    `Unlock +1 All ${shortCategory(category)}`,
    `all-faces-${category}`,
    index + 15,
  )),
];

const expansionCoords = [...ringCoords(3), ...ringCoords(4)];
const expansionNodes = newUpgradeSpecs.map((spec, index): MetaNodeSpec => {
  const [x, y, z] = expansionCoords[index];
  if (spec.kind === 'face') {
    return faceNode(spec.id, spec.label, x, y, z, spec.category, spec.faceIndex);
  }

  return {
    id: spec.id,
    label: spec.label,
    cost: 1,
    x,
    y,
    z,
    effect: { type: 'unlockCard', cardId: spec.cardId },
  };
});

export const metaNodes: MetaNodeSpec[] = [
  {
    id: 'startingCapital',
    label: '$5 -> $10',
    cost: 1,
    x: 0,
    y: 0,
    z: 0,
    effect: { type: 'startingMoney' },
  },
  ...ringOne,
  ...ringTwo,
  ...expansionNodes,
];

export const metaNodeById = Object.fromEntries(metaNodes.map((node) => [node.id, node])) as Record<MetaNodeId, MetaNodeSpec>;

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
    const boughtNode = metaNodeById[boughtId];
    return boughtNode ? cubeDistance(node, boughtNode) === 1 : false;
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
    const node = metaNodeById[id];
    const boughtNode = metaNodeById[boughtId];
    return node && boughtNode ? cubeDistance(node, boughtNode) === 1 : false;
  });
}

function cubeDistance(a: MetaNodeSpec, b: MetaNodeSpec): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

function faceNode(
  id: MetaNodeId,
  label: string,
  x: number,
  y: number,
  z: number,
  category: DiceCategory,
  faceIndex: number,
): MetaNodeSpec {
  return {
    id,
    label,
    cost: 1,
    x,
    y,
    z,
    effect: { type: 'addFaceValue', category, faceIndex, amount: 1 },
  };
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
