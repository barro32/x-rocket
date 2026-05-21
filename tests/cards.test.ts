import { describe, expect, it } from 'vitest';
import { draftCards, unlockedCardPoolFor } from '../src/sim/cards';
import { SequenceRng } from './helpers/SequenceRng';

describe('card drafting', () => {
  it('drafts unlocked meta cards into the card pool', () => {
    const cards = draftCards(new SequenceRng([0.97, 0.1, 0]), 1, ['unlock-double-highest']);

    expect(cards[0].id).toBe('double-highest');
  });

  it('drafts rare stat unlocks as x2 stat cards', () => {
    const cards = draftCards(new SequenceRng([0.97, 0.1, 0]), 1, ['unlock-rare-die-thrusters']);

    expect(cards[0]).toMatchObject({
      id: 'rare-die-thrusters',
      name: 'x2 Thrusters',
      effect: { type: 'multiplyStat', category: 'thrusters', multiplier: 2 },
    });
  });

  it('drafts side-one stat unlocks as +3 side-one cards', () => {
    const cards = draftCards(new SequenceRng([0.1, 0.1, 0]), 1, ['unlock-plus3-side1-thrusters']);

    expect(cards[0]).toMatchObject({
      id: 'plus3-side1-thrusters',
      name: '+3 Thrusters S1',
      description: '+3 Thrusters side 1',
      effect: { type: 'addFaceValue', category: 'thrusters', faceIndex: 0, amount: 3 },
    });
  });

  it('drafts rare S6 unlocks with three predetermined stats', () => {
    const cards = draftCards(new SequenceRng([0.97, 0.1, 0, 0, 0.3, 0.6]), 1, ['unlock-s6-three-stats']);

    expect(cards[0]).toMatchObject({
      name: '+1 S6 x3',
      description: '+1 side 6: Thrusters, Fuel, Guidance',
      effect: { type: 'addFaceValueToCategories', categories: ['thrusters', 'fuel', 'guidance'], faceIndex: 5, amount: 1 },
    });
  });

  it('drafts common stat cards with a predetermined random side', () => {
    const cards = draftCards(new SequenceRng([0.1, 0.1, 0.5]), 1);

    expect(cards[0]).toMatchObject({
      name: '+1 Thrusters S4',
      description: '+1 Thrusters side 4',
      effect: { type: 'addRandomFaceValue', category: 'thrusters', faceIndexes: [3], amount: 1 },
    });
  });

  it('upgrades random side cards after buying the matching meta node', () => {
    const cards = draftCards(new SequenceRng([0.1, 0.1, 0.5, 0.8]), 1, ['upgrade-random-face-card-thrusters']);

    expect(cards[0]).toMatchObject({
      name: '+2 Thrusters S4/S5',
      description: '+1 Thrusters sides 4 and 5',
      effect: { type: 'addRandomFaceValue', category: 'thrusters', faceIndexes: [3, 4], amount: 1 },
    });
  });

  it('keeps fallback random side cards on valid stat categories', () => {
    const cards = draftCards(new SequenceRng(Array(200).fill(0.1)), 8);

    expect(cards.map((card) => card.effect.type === 'addRandomFaceValue' ? card.effect.category : ''))
      .toEqual(['thrusters', 'fuel', 'aerodynamics', 'guidance', 'weight', 'thrusters', 'fuel', 'aerodynamics']);
  });

  it('summarizes the currently unlocked card pool', () => {
    const cards = unlockedCardPoolFor([
      'upgrade-random-face-card-thrusters',
      'unlock-double-highest',
      'unlock-s6-three-stats',
    ]);

    expect(cards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'base-random-face-thrusters',
        name: '+2 Thrusters random sides',
        source: 'base',
      }),
      expect.objectContaining({
        id: 'double-highest',
        name: '2x High',
        source: 'meta',
      }),
      expect.objectContaining({
        id: 's6-three-stats',
        description: '+1 side 6 on 3 predetermined random stats',
        source: 'meta',
      }),
    ]));
  });
});
