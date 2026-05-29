import { describe, expect, it } from 'vitest';
import { startingDice } from '../src/sim/dice';
import { rollDice } from '../src/sim/roll';
import type { CardSpec } from '../src/sim/types';
import { SequenceRng } from './helpers/SequenceRng';

describe('roll resolution', () => {
  const activeCategories = ['thrusters', 'fuel'] as const;

  it('auto rerolls the lowest die once per launch after the rare card', () => {
    const roll = rollDice(
      startingDice([]),
      new SequenceRng([0.9, 0.2, 0.2]),
      1,
      [],
      [...activeCategories],
    );

    expect(roll.rolls[0].rerolledFrom).toBe(0);
    expect(roll.rolls[0].value).toBe(4);
    expect(roll.exploded).toBe(false);
    expect(roll.score).toBe(8);
  });

  it('rolls current dice faces without applying card modifiers again', () => {
    const dice = startingDice([]);
    dice.thrusters.faces = [0, 0, 0, 2, 2, 2];
    const roll = rollDice(dice, new SequenceRng([0.6, 0.2]), 0, [], [...activeCategories]);

    expect(roll.rolls.find((rolled) => rolled.category === 'thrusters')?.value).toBe(2);
    expect(roll.score).toBe(6);
    expect(roll.exploded).toBe(false);
  });

  it('doubles the highest roll from the unlocked rare card', () => {
    const card: CardSpec = {
      id: 'double-highest',
      name: '2x High',
      rarity: 'rare',
      description: '2x highest roll',
      effect: { type: 'doubleHighestRoll' },
    };
    const roll = rollDice(startingDice([]), new SequenceRng([0.2, 0.2]), 0, [card], [...activeCategories]);

    expect(roll.score).toBe(12);
  });

  it('applies category delta cards before explosion and height', () => {
    const card: CardSpec = {
      id: 'plus3-minus1-thrusters',
      name: '+3 Thrusters -1 Fuel',
      rarity: 'common',
      description: '+3 Thrusters, -1 Fuel',
      effect: { type: 'categoryDelta', category: 'thrusters', amount: 3, penaltyCategory: 'fuel', penaltyAmount: -1 },
    };
    const roll = rollDice(startingDice([]), new SequenceRng([0.2, 0.9]), 0, [card], [...activeCategories]);

    expect(roll.score).toBe(7);
    expect(roll.exploded).toBe(true);
  });

  it('multiplies a stat during the roll only', () => {
    const card: CardSpec = {
      id: 'rare-die-thrusters',
      name: 'x2 Thrusters',
      rarity: 'rare',
      description: 'x2 Thrusters roll',
      effect: { type: 'multiplyStat', category: 'thrusters', multiplier: 2 },
    };
    const roll = rollDice(startingDice([]), new SequenceRng([0.2, 0.2]), 0, [card], [...activeCategories]);

    expect(roll.rolls.find((rolled) => rolled.category === 'thrusters')?.value).toBe(8);
    expect(roll.score).toBe(12);
  });

  it('emits roll events for animation sequencing', () => {
    const card: CardSpec = {
      id: 'rare-die-thrusters',
      name: 'x2 Thrusters',
      rarity: 'rare',
      description: 'x2 Thrusters roll',
      effect: { type: 'multiplyStat', category: 'thrusters', multiplier: 2 },
    };
    const roll = rollDice(startingDice([]), new SequenceRng([0.2, 0.2]), 0, [card], [...activeCategories]);

    expect(roll.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'initialRoll', category: 'thrusters', value: 4, faceIndex: 1 }),
      { type: 'cardModifier', cardId: 'rare-die-thrusters', cardName: 'x2 Thrusters', label: 'x2', category: 'thrusters', before: 4, after: 8 },
    ]));
  });

  it('emits reroll events for animation sequencing', () => {
    const roll = rollDice(
      startingDice([]),
      new SequenceRng([0.9, 0.2, 0.2]),
      1,
      [],
      [...activeCategories],
    );

    expect(roll.events).toContainEqual({ type: 'reroll', category: 'thrusters', before: 0, after: 4, faceIndex: 1 });
  });

  it('applies stat multiplication before stat penalties', () => {
    const x2Fuel: CardSpec = {
      id: 'rare-die-fuel',
      name: 'x2 Fuel',
      rarity: 'rare',
      description: 'x2 Fuel roll',
      effect: { type: 'multiplyStat', category: 'fuel', multiplier: 2 },
    };
    const plusThrustersMinusFuel: CardSpec = {
      id: 'plus3-minus1-thrusters',
      name: '+3 Thrusters -1 Fuel',
      rarity: 'common',
      description: '+3 Thrusters, -1 Fuel',
      effect: { type: 'categoryDelta', category: 'thrusters', amount: 3, penaltyCategory: 'fuel', penaltyAmount: -1 },
    };
    const dice = startingDice([]);
    dice.fuel.faces = [1, 1, 1, 2, 1, 1];
    const roll = rollDice(dice, new SequenceRng([0.2, 0]), 0, [x2Fuel, plusThrustersMinusFuel], [...activeCategories]);
    const fuelRoll = roll.rolls.find((rolled) => rolled.category === 'fuel');

    expect(fuelRoll?.value).toBe(1);
    expect(roll.exploded).toBe(false);
  });
});
