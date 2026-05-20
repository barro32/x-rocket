import { describe, expect, it } from 'vitest';
import { applyCard, startingDice } from '../src/sim/dice';
import { createInitialState } from '../src/sim/game';
import type { CardSpec } from '../src/sim/types';

describe('dice state', () => {
  it('adds one to every face of a stat from the unlocked rare all-faces card', () => {
    const card: CardSpec = {
      id: 'all-faces-thrusters',
      name: '+1 All Thrusters',
      rarity: 'rare',
      description: '+1 all Thrusters faces',
      effect: { type: 'addAllFaces', category: 'thrusters', amount: 1 },
    };
    const next = applyCard(createInitialState(1), card);

    expect(next.dice.thrusters[0].faces).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('applies permanent meta dice face upgrades to starting dice', () => {
    const dice = startingDice(['thrusters-0']);

    expect(dice.thrusters[0].faces).toEqual([1, 0, 0, 1, 1, 1]);
  });
});
