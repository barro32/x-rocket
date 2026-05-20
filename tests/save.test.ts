import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/game';
import { parseSave, saveFileName, serializeSave } from '../src/sim/save';

describe('save import/export', () => {
  it('round-trips formatted save JSON', () => {
    const state = createInitialState(123);
    const raw = serializeSave(state);
    const parsed = parseSave(raw);

    expect(raw).toContain('\n');
    expect(parsed).toMatchObject({
      version: 3,
      seed: 123,
      money: state.money,
    });
  });

  it('uses a stable debug export filename', () => {
    expect(saveFileName).toBe('x-rocket-save-v3.json');
  });
});
