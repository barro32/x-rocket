import { describe, expect, it } from 'vitest';
import { startingDice } from '../src/sim/dice';
import { rollDice } from '../src/sim/roll';
import type { CardSpec } from '../src/sim/types';
import { SequenceRng } from './helpers/SequenceRng';

describe('roll resolution', () => {
  it('auto rerolls the lowest die once per launch after the rare card', () => {
    const roll = rollDice(
      startingDice([]),
      new SequenceRng([0, 0.6, 0.6, 0.6, 0.6, 0.6]),
      1,
      [],
    );

    expect(roll.rolls[0].rerolledFrom).toBe(0);
    expect(roll.rolls[0].value).toBe(1);
    expect(roll.exploded).toBe(false);
    expect(roll.score).toBe(5);
  });

  it('doubles the highest roll from the unlocked rare card', () => {
    const card: CardSpec = {
      id: 'double-highest',
      name: '2x High',
      rarity: 'rare',
      description: '2x highest roll',
      effect: { type: 'doubleHighestRoll' },
    };
    const roll = rollDice(startingDice([]), new SequenceRng([0.6, 0.6, 0.6, 0.6, 0.6]), 0, [card]);

    expect(roll.score).toBe(6);
  });

  it('applies category delta cards before explosion and height', () => {
    const card: CardSpec = {
      id: 'plus3-minus1-thrusters',
      name: '+3 Thrusters -1 Fuel',
      rarity: 'common',
      description: '+3 Thrusters, -1 Fuel',
      effect: { type: 'categoryDelta', category: 'thrusters', amount: 3, penaltyCategory: 'fuel', penaltyAmount: -1 },
    };
    const roll = rollDice(startingDice([]), new SequenceRng([0.6, 0.6, 0.6, 0.6, 0.6]), 0, [card]);

    expect(roll.score).toBe(7);
    expect(roll.exploded).toBe(true);
  });

  it('multiplies all dice for a stat during the roll only', () => {
    const card: CardSpec = {
      id: 'rare-die-thrusters',
      name: 'x2 Thrusters Dice',
      rarity: 'rare',
      description: 'x2 Thrusters dice',
      effect: { type: 'multiplyDice', category: 'thrusters', multiplier: 2 },
    };
    const roll = rollDice(startingDice([]), new SequenceRng([0.6, 0.6, 0.6, 0.6, 0.6, 0.6]), 0, [card]);

    expect(roll.rolls.filter((rolled) => rolled.category === 'thrusters')).toHaveLength(1);
    expect(roll.rolls.find((rolled) => rolled.category === 'thrusters')?.value).toBe(2);
    expect(roll.score).toBe(6);
  });

  it('applies stat multiplication before stat penalties', () => {
    const x2Fuel: CardSpec = {
      id: 'rare-die-fuel',
      name: 'x2 Fuel Dice',
      rarity: 'rare',
      description: 'x2 Fuel dice',
      effect: { type: 'multiplyDice', category: 'fuel', multiplier: 2 },
    };
    const plusThrustersMinusFuel: CardSpec = {
      id: 'plus3-minus1-thrusters',
      name: '+3 Thrusters -1 Fuel',
      rarity: 'common',
      description: '+3 Thrusters, -1 Fuel',
      effect: { type: 'categoryDelta', category: 'thrusters', amount: 3, penaltyCategory: 'fuel', penaltyAmount: -1 },
    };
    const dice = startingDice([]);
    dice.fuel[0].faces = [1, 1, 1, 2, 1, 1];
    const roll = rollDice(dice, new SequenceRng([0.6, 0, 0.6, 0.6, 0.6]), 0, [x2Fuel, plusThrustersMinusFuel]);
    const fuelRoll = roll.rolls.find((rolled) => rolled.category === 'fuel');

    expect(fuelRoll?.value).toBe(1);
    expect(roll.exploded).toBe(false);
  });
});
