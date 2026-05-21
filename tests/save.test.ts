import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/game';
import { parseSave, saveGame } from '../src/sim/save';

describe('save persistence', () => {
  it('parses saved state JSON', () => {
    const state = createInitialState(123);
    const raw = JSON.stringify(state);
    const parsed = parseSave(raw);

    expect(parsed).toMatchObject({
      version: 3,
      seed: 123,
      money: state.money,
    });
  });

  it('writes saves to local storage', () => {
    const values = new Map<string, string>();
    const storage = {
      setItem: (key: string, value: string) => values.set(key, value),
    } as unknown as Storage;
    const state = createInitialState(123);

    saveGame(state, storage);

    expect(JSON.parse(values.get('x-rocket-save-v3') ?? '{}')).toMatchObject({ seed: 123 });
  });

  it('migrates old array dice and multiply dice cards', () => {
    const state = createInitialState(123);
    const raw = JSON.stringify({
      ...state,
      dice: {
        ...state.dice,
        thrusters: [{ id: 'thrusters-0', category: 'thrusters', faces: [1, 0, 0, 1, 1, 1] }],
      },
      runCards: [{
        id: 'rare-die-thrusters',
        name: 'x2 Thrusters Dice',
        rarity: 'rare',
        description: 'x2 Thrusters dice',
        effect: { type: 'multiplyDice', category: 'thrusters', multiplier: 2 },
      }],
      pendingCardChoices: [{
        id: 'uncommon-x2-fuel',
        name: 'x2 Fuel Dice',
        rarity: 'uncommon',
        description: 'x2 Fuel dice',
        effect: { type: 'multiplyDice', category: 'fuel', multiplier: 2 },
      }],
    });
    const parsed = parseSave(raw);

    expect(parsed.dice.thrusters.faces).toEqual([1, 0, 0, 1, 1, 1]);
    expect(parsed.runCards[0].effect).toMatchObject({ type: 'multiplyStat', category: 'thrusters', multiplier: 2 });
    expect(parsed.pendingCardChoices[0].effect).toMatchObject({ type: 'multiplyStat', category: 'fuel', multiplier: 2 });
  });
});
