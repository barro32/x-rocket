import { diceCategories } from './categories';
import { metaNodeById } from './meta';
import type { CardSpec, CategoryDie, DiceCategory, GameState, MetaNodeId } from './types';

export const startingFaces = [0, 0, 0, 1, 1, 1];

export function startingDice(boughtMetaNodes: MetaNodeId[]): Record<DiceCategory, CategoryDie[]> {
  const dice = Object.fromEntries(diceCategories.map((category) => [
    category,
    [{ id: `${category}-0`, category, faces: [...startingFaces] }],
  ])) as Record<DiceCategory, CategoryDie[]>;

  for (const nodeId of boughtMetaNodes) {
    const node = metaNodeById[nodeId];
    if (!node) {
      continue;
    }

    if (node.effect.type === 'addFaceValue') {
      const die = dice[node.effect.category][0];
      die.faces[node.effect.faceIndex] = (die.faces[node.effect.faceIndex] ?? 0) + node.effect.amount;
    } else if (node.effect.type === 'addWeakestFace') {
      const category = weakestCategory(dice);
      addToFirstZeroFace(dice[category][0], node.effect.amount);
    }
  }

  return dice;
}

export function applyCard(state: GameState, card: CardSpec): GameState {
  switch (card.effect.type) {
    case 'addFaceValue': {
      const dice = cloneDice(state.dice);
      const die = dice[card.effect.category][0];
      die.faces[card.effect.faceIndex] = (die.faces[card.effect.faceIndex] ?? 0) + card.effect.amount;
      return { ...state, dice };
    }
    case 'addAllFaces': {
      const dice = cloneDice(state.dice);
      const { amount, category } = card.effect;
      for (const die of dice[category]) {
        die.faces = die.faces.map((face) => face + amount);
      }
      return { ...state, dice };
    }
    case 'autoRerollLowest':
      return { ...state, autoRerollLowest: state.autoRerollLowest + card.effect.amount };
    case 'doubleHighestRoll':
    case 'categoryDelta':
    case 'topBottomDelta':
    case 'multiplyDice':
      return state;
  }
}

function addToFirstZeroFace(die: CategoryDie, amount = 1): void {
  const index = die.faces.findIndex((face) => face === 0);
  die.faces[index === -1 ? 0 : index] += amount;
}

function weakestCategory(dice: Record<DiceCategory, CategoryDie[]>): DiceCategory {
  return diceCategories.reduce((weakest, category) => (
    dieTotal(dice[category][0]) < dieTotal(dice[weakest][0]) ? category : weakest
  ), diceCategories[0]);
}

function dieTotal(die: CategoryDie): number {
  return die.faces.reduce((sum, face) => sum + face, 0);
}

function cloneDice(dice: Record<DiceCategory, CategoryDie[]>): Record<DiceCategory, CategoryDie[]> {
  return Object.fromEntries(diceCategories.map((category) => [
    category,
    dice[category].map((die) => ({ ...die, faces: [...die.faces] })),
  ])) as Record<DiceCategory, CategoryDie[]>;
}
