import { describe, expect, it } from 'vitest';
import { applyCard, startingDice } from '../src/sim/dice';
import { createInitialState } from '../src/sim/game';
import type { CardSpec } from '../src/sim/types';
import { SequenceRng } from './helpers/SequenceRng';

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

    expect(next.dice.thrusters.faces).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('applies permanent meta dice face upgrades to starting dice', () => {
    const dice = startingDice(['thrusters-0']);

    expect(dice.thrusters.faces).toEqual([6, 4, 3, 2, 1, 0]);
  });

  it('applies random side card upgrades when a card is chosen with rng', () => {
    const card: CardSpec = {
      id: 'common-random-face-thrusters-2',
      name: '+2 Thrusters',
      rarity: 'common',
      description: '+2 random Thrusters side',
      effect: { type: 'addRandomFaceValue', category: 'thrusters', faceIndexes: [3, 4], amount: 1 },
    };
    const next = applyCard(createInitialState(1), card, new SequenceRng([0]));

    expect(next.dice.thrusters.faces).toEqual([5, 4, 3, 3, 2, 0]);
  });

  it('adds a face value to multiple predetermined stats', () => {
    const card: CardSpec = {
      id: 's6-three-stats-thrusters-fuel-guidance',
      name: '+1 S6 x3',
      rarity: 'rare',
      description: '+1 side 6: Thrusters, Fuel, Guidance',
      effect: { type: 'addFaceValueToCategories', categories: ['thrusters', 'fuel', 'guidance'], faceIndex: 5, amount: 1 },
    };
    const next = applyCard(createInitialState(1), card);

    expect(next.dice.thrusters.faces).toEqual([5, 4, 3, 2, 1, 1]);
    expect(next.dice.fuel.faces).toEqual([5, 4, 3, 2, 1, 1]);
    expect(next.dice.aerodynamics.faces).toEqual([5, 4, 3, 2, 1, 0]);
    expect(next.dice.guidance.faces).toEqual([5, 4, 3, 2, 1, 1]);
  });

  it('keeps roll modifier cards out of dice face state', () => {
    const state = createInitialState(1);
    const cards: CardSpec[] = [
      {
        id: 'rare-die-thrusters',
        name: 'x2 Thrusters',
        rarity: 'rare',
        description: 'x2 Thrusters roll',
        effect: { type: 'multiplyStat', category: 'thrusters', multiplier: 2 },
      },
      {
        id: 'plus3-minus1-thrusters',
        name: '+3 Thrusters -1 Fuel',
        rarity: 'common',
        description: '+3 Thrusters, -1 Fuel',
        effect: { type: 'categoryDelta', category: 'thrusters', amount: 3, penaltyCategory: 'fuel', penaltyAmount: -1 },
      },
      {
        id: 'top-bottom',
        name: '+5 High -1 Low',
        rarity: 'common',
        description: '+5 highest roll, -1 lowest roll',
        effect: { type: 'topBottomDelta', topAmount: 5, bottomAmount: -1 },
      },
      {
        id: 'double-highest',
        name: '2x High',
        rarity: 'rare',
        description: '2x highest roll',
        effect: { type: 'doubleHighestRoll' },
      },
    ];

    for (const card of cards) {
      expect(applyCard(state, card).dice).toEqual(state.dice);
    }
  });
});
