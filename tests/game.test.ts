import { describe, expect, it } from 'vitest';
import { chooseCard, claimBankruptcyReward, createInitialState, isBankrupt, restartRun, simulateLaunch } from '../src/sim/game';
import type { CardSpec } from '../src/sim/types';
import { SequenceRng } from './helpers/SequenceRng';

describe('game state flow', () => {
  it('explodes and reaches 0m when any die rolls zero', () => {
    const state = createInitialState(1);
    const next = simulateLaunch(state, new SequenceRng([0.6, 0.6, 0.6, 0.6, 0.6]));

    expect(next.lastLaunch?.roll.exploded).toBe(true);
    expect(next.lastLaunch?.heightMeters).toBe(0);
    expect(next.money).toBe(4);
  });

  it('uses linear height: score 5 reaches 5m', () => {
    const state = createInitialState(1);
    const next = simulateLaunch(state, new SequenceRng([0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.2, 0.3]));

    expect(next.lastLaunch?.roll.exploded).toBe(false);
    expect(next.lastLaunch?.roll.score).toBe(5);
    expect(next.lastLaunch?.heightMeters).toBe(5);
    expect(next.pendingCardAwards).toBe(1);
    expect(next.metaCurrency).toBe(1);
  });

  it('awards one card pick after every successful launch', () => {
    const state = createInitialState(1);
    const first = simulateLaunch(state, new SequenceRng([0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.2, 0.3]));
    const chosen = chooseCard(first, 0, new SequenceRng([0.1, 0.2, 0.3]));
    const second = simulateLaunch(chosen, new SequenceRng([0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.2, 0.3]));

    expect(first.pendingCardAwards).toBe(1);
    expect(second.pendingCardAwards).toBe(1);
    expect(second.pendingCardChoices).toHaveLength(3);
  });

  it('does not award a card pick after an exploded launch', () => {
    const state = createInitialState(1);
    const next = simulateLaunch(state, new SequenceRng([0.6, 0.6, 0.6, 0.6, 0.6]));

    expect(next.pendingCardAwards).toBe(0);
    expect(next.pendingCardChoices).toHaveLength(0);
  });

  it('awards milestone meta once per run', () => {
    const state = createInitialState(1);
    const first = simulateLaunch(state, new SequenceRng([0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.2, 0.3]));
    const chosen = chooseCard(first, 0, new SequenceRng([0.1, 0.2, 0.3]));
    const second = simulateLaunch(chosen, new SequenceRng([0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.2, 0.3]));
    const restarted = restartRun({ ...second, money: 0 });
    const third = simulateLaunch(restarted, new SequenceRng([0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.2, 0.3]));

    expect(first.metaCurrency).toBe(1);
    expect(second.metaCurrency).toBe(1);
    expect(third.metaCurrency).toBeGreaterThanOrEqual(2);
  });

  it('claims exactly one meta currency per bankruptcy', () => {
    let state = createInitialState(1);
    for (let i = 0; i < 5; i += 1) {
      state = simulateLaunch(state, new SequenceRng([0.6, 0.6, 0.6, 0.6, 0.6]));
    }

    expect(isBankrupt(state)).toBe(true);
    const claimed = claimBankruptcyReward(state);
    const claimedAgain = claimBankruptcyReward(claimed);

    expect(claimed.metaCurrency).toBe(state.metaCurrency + 1);
    expect(claimedAgain.metaCurrency).toBe(claimed.metaCurrency);
  });

  it('resets run-only card effects on restart', () => {
    const card: CardSpec = {
      id: 'test-auto-reroll',
      name: '+1 Auto Reroll',
      rarity: 'rare',
      description: 'Reroll lowest each launch',
      effect: { type: 'autoRerollLowest', amount: 1 },
    };
    const state = {
      ...createInitialState(1),
      money: 0,
      runCards: [card],
      autoRerollLowest: 1,
    };
    const restarted = restartRun(state);

    expect(restarted.autoRerollLowest).toBe(0);
    expect(restarted.runCards).toEqual([]);
  });

  it('starts each run with temporary meta rerolls and consumes them on launch', () => {
    const state = {
      ...createInitialState(1),
      boughtMetaNodes: ['reroll-lowest-0', 'reroll-lowest-1'],
    };
    const restarted = restartRun({ ...state, money: 0 });
    const launched = simulateLaunch(restarted, new SequenceRng([0.6, 0.6, 0.6, 0.6, 0.6, 0.2, 0.2]));

    expect(restarted.temporaryAutoRerollLowest).toBe(2);
    expect(launched.temporaryAutoRerollLowest).toBe(0);
    expect(launched.lastLaunch?.roll.rolls.some((roll) => roll.rerolledFrom !== undefined)).toBe(true);
  });
});
