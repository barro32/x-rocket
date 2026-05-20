import { diceCategories } from './categories';
import { pickOne, type Rng } from './rng';
import type { CardSpec, CategoryDie, DiceCategory, DieRoll, LaunchRoll } from './types';

export function rollDice(
  dice: Record<DiceCategory, CategoryDie[]>,
  rng: Rng,
  autoRerollLowest: number,
  runCards: CardSpec[],
): LaunchRoll {
  const rolls: DieRoll[] = diceCategories.flatMap((category) => dice[category].map((die) => {
    const value = pickOne(die.faces, rng);
    return {
      dieId: die.id,
      category,
      value,
      faces: [...die.faces],
    };
  }));

  for (let i = 0; i < autoRerollLowest; i += 1) {
    const lowestIndex = lowestRollIndex(rolls);
    const roll = rolls[lowestIndex];
    rolls[lowestIndex] = {
      ...roll,
      value: pickOne(roll.faces, rng),
      rerolledFrom: roll.value,
    };
  }

  applyRollCardEffects(rolls, runCards);

  const exploded = rolls.some((roll) => roll.value === 0);
  const score = rolls.reduce((sum, roll) => sum + roll.value, 0);
  return { rolls, score, exploded };
}

function applyRollCardEffects(rolls: DieRoll[], runCards: CardSpec[]): void {
  for (const card of runCards) {
    switch (card.effect.type) {
      case 'multiplyDice':
        multiplyCategory(rolls, card.effect.category, card.effect.multiplier);
        break;
      case 'doubleHighestRoll':
        adjustRoll(rolls, highestRollIndex(rolls), rolls[highestRollIndex(rolls)].value);
        break;
      case 'categoryDelta':
        adjustCategory(rolls, card.effect.category, card.effect.amount, 'highest');
        if (card.effect.penaltyCategory && card.effect.penaltyAmount) {
          adjustCategory(rolls, card.effect.penaltyCategory, card.effect.penaltyAmount, 'lowest');
        }
        break;
      case 'topBottomDelta':
        adjustRoll(rolls, highestRollIndex(rolls), card.effect.topAmount);
        adjustRoll(rolls, lowestRollIndex(rolls), card.effect.bottomAmount);
        break;
      case 'addFaceValue':
      case 'addAllFaces':
      case 'autoRerollLowest':
        break;
    }
  }
}

function multiplyCategory(rolls: DieRoll[], category: DiceCategory, multiplier: number): void {
  for (let index = 0; index < rolls.length; index += 1) {
    if (rolls[index].category === category) {
      rolls[index] = {
        ...rolls[index],
        value: rolls[index].value * multiplier,
      };
    }
  }
}

function adjustCategory(rolls: DieRoll[], category: DiceCategory, amount: number, target: 'highest' | 'lowest'): void {
  const indices = rolls.flatMap((roll, index) => roll.category === category ? [index] : []);
  if (indices.length === 0) {
    return;
  }
  const selected = indices.reduce((best, index) => {
    if (target === 'highest') {
      return rolls[index].value > rolls[best].value ? index : best;
    }
    return rolls[index].value < rolls[best].value ? index : best;
  }, indices[0]);
  adjustRoll(rolls, selected, amount);
}

function highestRollIndex(rolls: DieRoll[]): number {
  return rolls.reduce((highest, roll, index) => roll.value > rolls[highest].value ? index : highest, 0);
}

function lowestRollIndex(rolls: DieRoll[]): number {
  return rolls.reduce((lowest, roll, index) => roll.value < rolls[lowest].value ? index : lowest, 0);
}

function adjustRoll(rolls: DieRoll[], index: number, amount: number): void {
  rolls[index] = {
    ...rolls[index],
    value: Math.max(0, rolls[index].value + amount),
  };
}
