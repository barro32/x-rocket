import { diceCategories } from './categories';
import type { Rng } from './rng';
import type { CardSpec, CategoryDie, DiceCategory, DieRoll, LaunchRoll, RollEvent } from './types';

export function rollDice(
  dice: Record<DiceCategory, CategoryDie>,
  rng: Rng,
  autoRerollLowest: number,
  runCards: CardSpec[],
): LaunchRoll {
  const events: RollEvent[] = [];
  const rolls: DieRoll[] = diceCategories.map((category) => {
    const die = dice[category];
    const rolledFace = pickFace(die.faces, rng);
    events.push({ type: 'initialRoll', category, value: rolledFace.value, faceIndex: rolledFace.faceIndex });
    return {
      dieId: die.id,
      category,
      initialValue: rolledFace.value,
      initialFaceIndex: rolledFace.faceIndex,
      value: rolledFace.value,
      faces: [...die.faces],
      modifiers: [],
    };
  });

  for (let i = 0; i < autoRerollLowest; i += 1) {
    const lowestIndex = lowestRollIndex(rolls);
    const roll = rolls[lowestIndex];
    const reroll = pickFace(roll.faces, rng);
    events.push({ type: 'reroll', category: roll.category, before: roll.value, after: reroll.value, faceIndex: reroll.faceIndex });
    rolls[lowestIndex] = {
      ...roll,
      value: reroll.value,
      rerolledFrom: roll.value,
      rerolledFaceIndex: reroll.faceIndex,
      modifiers: [...roll.modifiers, {
        label: 'reroll',
        before: roll.value,
        after: reroll.value,
      }],
    };
  }

  applyRollCardEffects(rolls, runCards, events);

  const exploded = rolls.some((roll) => roll.value === 0);
  const score = rolls.reduce((sum, roll) => sum + roll.value, 0);
  return { rolls, events, score, exploded };
}

function applyRollCardEffects(rolls: DieRoll[], runCards: CardSpec[], events: RollEvent[]): void {
  for (const card of runCards) {
    switch (card.effect.type) {
      case 'multiplyStat':
        multiplyCategory(rolls, card.effect.category, card.effect.multiplier, card, events);
        break;
      case 'doubleHighestRoll':
        adjustRoll(rolls, highestRollIndex(rolls), rolls[highestRollIndex(rolls)].value, 'x2', card, events);
        break;
      case 'categoryDelta':
        adjustCategory(rolls, card.effect.category, card.effect.amount, 'highest', card, events);
        if (card.effect.penaltyCategory && card.effect.penaltyAmount) {
          adjustCategory(rolls, card.effect.penaltyCategory, card.effect.penaltyAmount, 'lowest', card, events);
        }
        break;
      case 'topBottomDelta':
        adjustRoll(rolls, highestRollIndex(rolls), card.effect.topAmount, signedLabel(card.effect.topAmount), card, events);
        adjustRoll(rolls, lowestRollIndex(rolls), card.effect.bottomAmount, signedLabel(card.effect.bottomAmount), card, events);
        break;
      case 'addFaceValue':
      case 'addRandomFaceValue':
      case 'addFaceValueToCategories':
      case 'addAllFaces':
      case 'autoRerollLowest':
        break;
    }
  }
}

function multiplyCategory(rolls: DieRoll[], category: DiceCategory, multiplier: number, card: CardSpec, events: RollEvent[]): void {
  for (let index = 0; index < rolls.length; index += 1) {
    if (rolls[index].category === category) {
      const before = rolls[index].value;
      const after = before * multiplier;
      events.push({ type: 'cardModifier', cardId: card.id, cardName: card.name, label: `x${multiplier}`, category, before, after });
      rolls[index] = {
        ...rolls[index],
        value: after,
        modifiers: [...rolls[index].modifiers, { label: `x${multiplier}`, before, after }],
      };
    }
  }
}

function adjustCategory(
  rolls: DieRoll[],
  category: DiceCategory,
  amount: number,
  target: 'highest' | 'lowest',
  card: CardSpec,
  events: RollEvent[],
): void {
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
  adjustRoll(rolls, selected, amount, signedLabel(amount), card, events);
}

function highestRollIndex(rolls: DieRoll[]): number {
  return rolls.reduce((highest, roll, index) => roll.value > rolls[highest].value ? index : highest, 0);
}

function lowestRollIndex(rolls: DieRoll[]): number {
  return rolls.reduce((lowest, roll, index) => roll.value < rolls[lowest].value ? index : lowest, 0);
}

function adjustRoll(rolls: DieRoll[], index: number, amount: number, label: string, card: CardSpec, events: RollEvent[]): void {
  const before = rolls[index].value;
  const after = Math.max(0, before + amount);
  events.push({ type: 'cardModifier', cardId: card.id, cardName: card.name, label, category: rolls[index].category, before, after });
  rolls[index] = {
    ...rolls[index],
    value: after,
    modifiers: [...rolls[index].modifiers, { label, before, after }],
  };
}

function signedLabel(amount: number): string {
  return `${amount >= 0 ? '+' : ''}${amount}`;
}

function pickFace(faces: number[], rng: Rng): { value: number; faceIndex: number } {
  const faceIndex = Math.min(faces.length - 1, Math.floor(rng.next() * faces.length));
  return { value: faces[faceIndex], faceIndex };
}
