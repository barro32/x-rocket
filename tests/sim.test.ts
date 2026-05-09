import { describe, expect, it } from 'vitest';
import { buyMetaUpgrade, chooseLesson, createInitialState, isBankrupt, restartCompany, simulateLaunch } from '../src/sim/game';
import { availableLessons } from '../src/sim/lessons';
import { deriveRocketStats } from '../src/sim/parts';
import type { Rng } from '../src/sim/rng';
import type { LessonId } from '../src/sim/types';

class FixedRng implements Rng {
  private index = 0;

  constructor(private readonly values: number[]) {}

  next(): number {
    const value = this.values[this.index] ?? 0.25;
    this.index += 1;
    return value;
  }
}

describe('rocket simulation', () => {
  it('spends money and drafts lessons when a rocket explodes', () => {
    const state = createInitialState(1);
    const next = simulateLaunch(state, new FixedRng([0, 0.2, 0.8, 0.1, 0.5, 0.9]));

    expect(next.launches).toBe(1);
    expect(next.money).toBeLessThan(state.money);
    expect(next.knowledge).toBe(state.knowledge);
    expect(next.pendingLessonChoices).toHaveLength(3);
    expect(next.lastLaunch?.outcome).toBe('exploded');
    expect(next.lastLaunch?.failedPart).toBe('engine');
  });

  it('applies one drafted lesson before the next launch', () => {
    const state = {
      ...createInitialState(1),
      pendingLessonChoices: ['reinforceFrame', 'tuneEngineMix', 'standardizeAssembly'] satisfies LessonId[],
    };
    const next = chooseLesson(state, 'reinforceFrame');

    expect(next.lessons.reinforceFrame).toBe(1);
    expect(next.parts.body.reliability).toBeGreaterThan(state.parts.body.reliability);
    expect(next.pendingLessonChoices).toHaveLength(0);
  });

  it('derives rocket stats from parts', () => {
    const state = createInitialState(1);
    const stats = deriveRocketStats(state.parts);

    expect(stats.thrust).toBeGreaterThan(0);
    expect(stats.mass).toBeGreaterThan(0);
    expect(stats.ignitionReliability).toBeGreaterThan(0);
  });

  it('starts with only the basic lesson cards', () => {
    const state = createInitialState(1);

    expect(availableLessons(state).sort()).toEqual([
      'reinforceFrame',
      'standardizeAssembly',
      'tuneEngineMix',
    ]);
  });

  it('meta upgrades unlock new cards and rocket parts', () => {
    const state = { ...createInitialState(1), knowledge: 10 };
    const next = buyMetaUpgrade(state, 'basicStabilizers');

    expect(next.metaUpgrades.basicStabilizers).toBe(1);
    expect(next.parts.fins.mass).toBeGreaterThan(0);
    expect(availableLessons(next)).toContain('stabilizeFins');
  });

  it('adds one meta knowledge and advances company name on bankruptcy restart', () => {
    const state = {
      ...createInitialState(1),
      money: 0,
      knowledge: 12,
      lessons: {
        ...createInitialState(1).lessons,
        documentEverything: 2,
      },
      highestAltitudeMeters: 50_000,
    };

    expect(isBankrupt(state)).toBe(true);
    const next = restartCompany(state);

    expect(next.companyIndex).toBe(24);
    expect(next.bankruptcies).toBe(1);
    expect(next.knowledge).toBe(15);
    expect(next.money).toBeGreaterThan(0);
  });
});
