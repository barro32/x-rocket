import { describe, expect, it } from 'vitest';
import { draftCards } from '../src/sim/cards';
import { SequenceRng } from './helpers/SequenceRng';

describe('card drafting', () => {
  it('drafts unlocked meta cards into the card pool', () => {
    const cards = draftCards(new SequenceRng([0.97, 0.1, 0]), 1, ['unlock-double-highest']);

    expect(cards[0].id).toBe('double-highest');
  });

  it('drafts rare stat dice unlocks as x2 dice cards', () => {
    const cards = draftCards(new SequenceRng([0.97, 0.1, 0]), 1, ['unlock-rare-die-thrusters']);

    expect(cards[0]).toMatchObject({
      id: 'rare-die-thrusters',
      name: 'x2 Thrusters Dice',
      effect: { type: 'multiplyDice', category: 'thrusters', multiplier: 2 },
    });
  });
});
