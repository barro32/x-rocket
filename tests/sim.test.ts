import { describe, expect, it } from 'vitest';
import { bankruptcyReward, buyMetaUpgrade, chooseLesson, claimBankruptcyReward, createInitialState, isBankrupt, launchCost, restartCompany, simulateLaunch } from '../src/sim/game';
import { applyLessonToParts, availableLessons, lessonSpecs } from '../src/sim/lessons';
import { defaultMetaUpgrades, isMetaUpgradeUnlocked } from '../src/sim/metaUpgrades';
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
    expect(next.knowledge).toBe(state.knowledge + 1);
    expect(next.pendingLessonChoices).toEqual(['tuneEngineMix']);
    expect(next.lastLaunch?.outcome).toBe('exploded');
    expect(next.lastLaunch?.failedPart).toBe('engine');
  });

  it('applies one drafted lesson before the next launch', () => {
    const state = {
      ...createInitialState(1),
      pendingLessonChoices: ['tuneEngineMix'] satisfies LessonId[],
    };
    const next = chooseLesson(state, 'tuneEngineMix');

    expect(next.lessons.tuneEngineMix).toBe(1);
    expect(next.parts.engine.thrust).toBeGreaterThan(state.parts.engine.thrust);
    expect(next.pendingLessonChoices).toHaveLength(0);
  });

  it('derives rocket stats from parts', () => {
    const state = createInitialState(1);
    const stats = deriveRocketStats(state.parts);

    expect(stats.thrust).toBeGreaterThan(0);
    expect(stats.mass).toBeGreaterThan(0);
    expect(stats.ignitionReliability).toBeGreaterThan(0);
  });

  it('starts with only tune engine mix as a lesson card', () => {
    const state = createInitialState(1);

    expect(availableLessons(state)).toEqual(['tuneEngineMix']);
  });

  it('meta upgrades unlock new cards and rocket parts', () => {
    const state = { ...createInitialState(1), knowledge: 10 };
    const blocked = buyMetaUpgrade(state, 'basicStabilizers');
    const withRoot = buyMetaUpgrade(state, 'blackBoxRecovery');
    const next = buyMetaUpgrade(withRoot, 'basicStabilizers');

    expect(blocked.metaUpgrades.basicStabilizers).toBe(0);
    expect(isMetaUpgradeUnlocked(state.metaUpgrades, 'blackBoxRecovery')).toBe(true);
    expect(isMetaUpgradeUnlocked(state.metaUpgrades, 'basicStabilizers')).toBe(false);
    expect(withRoot.metaUpgrades.blackBoxRecovery).toBe(1);
    expect(next.metaUpgrades.basicStabilizers).toBe(1);
    expect(next.parts.fins.mass).toBeGreaterThan(0);
    expect(availableLessons(next)).toContain('stabilizeFins');
  });

  it('advances company name on bankruptcy restart without base bankruptcy knowledge', () => {
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
    expect(next.knowledge).toBe(14);
    expect(next.money).toBeGreaterThan(0);
  });

  it('launches cost $50 and starting funds allow two launches before bankruptcy', () => {
    const state = createInitialState(1);
    const afterFirstLaunch = chooseLesson(
      simulateLaunch(state, new FixedRng([0.99, 0.99, 0.99, 0.99, 0.99, 0.25])),
      'tuneEngineMix',
    );
    const afterSecondLaunch = chooseLesson(
      simulateLaunch(afterFirstLaunch, new FixedRng([0.99, 0.99, 0.99, 0.99, 0.99, 0.25])),
      'tuneEngineMix',
    );

    expect(state.money).toBe(100);
    expect(launchCost(state)).toBe(50);
    expect(isBankrupt(afterFirstLaunch)).toBe(false);
    expect(isBankrupt(afterSecondLaunch)).toBe(true);
  });

  it('bad launch stays under 100 meters', () => {
    const state = createInitialState(1);
    const next = simulateLaunch(state, new FixedRng([0, 0.2, 0.8, 0.1, 0.5, 0.9]));

    expect(next.lastLaunch?.altitudeMeters).toBeLessThan(100);
  });

  it('engine tuning increases altitude potential', () => {
    const state = createInitialState(1);
    const tuned = chooseLesson({ ...state, pendingLessonChoices: ['tuneEngineMix'] }, 'tuneEngineMix');
    const cleanFlightRng = [0.99, 0.99, 0.99, 0.99, 0.99, 0.5, 0.5, 0.5];
    const baseLaunch = simulateLaunch(state, new FixedRng(cleanFlightRng));
    const tunedLaunch = simulateLaunch(tuned, new FixedRng(cleanFlightRng));

    expect(tunedLaunch.lastLaunch?.altitudeMeters).toBeGreaterThan(baseLaunch.lastLaunch?.altitudeMeters ?? 0);
  });

  it('claims only bonus bankruptcy rewards and only once', () => {
    const state = {
      ...createInitialState(1),
      money: 0,
      knowledge: 0,
    };

    expect(bankruptcyReward(state)).toBe(0);
    const claimed = claimBankruptcyReward(state);
    const claimedAgain = claimBankruptcyReward(claimed);

    expect(claimed.knowledge).toBe(0);
    expect(claimed.bankruptcyRewardClaimed).toBe(true);
    expect(claimedAgain.knowledge).toBe(0);
  });

  it('locked optional parts do not zero out derived stats', () => {
    const base = createInitialState(1);
    const withFins = createInitialState(1, { ...defaultMetaUpgrades, basicStabilizers: 1 });
    const baseStats = deriveRocketStats(base.parts);
    const finStats = deriveRocketStats(withFins.parts);

    expect(base.parts.fins.unlocked).toBe(false);
    expect(baseStats.stability).toBeGreaterThan(0);
    expect(finStats.stability).toBeGreaterThan(baseStats.stability);
  });

  it('questionable investors increases restart money', () => {
    const state = {
      ...createInitialState(1, { ...defaultMetaUpgrades, questionableInvestors: 1 }),
      money: 0,
    };
    const next = restartCompany(state);

    expect(next.money).toBeGreaterThan(restartCompany({ ...createInitialState(1), money: 0 }).money);
  });

  it('every lesson either changes part stats or explicitly changes bankruptcy reward', () => {
    const parts = createInitialState(1, {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      scrapyardEngineering: 1,
      basicStabilizers: 1,
      guidanceProgram: 1,
      failureReviewBoard: 1,
    }).parts;

    lessonSpecs.forEach((lesson) => {
      if (lesson.id === 'documentEverything') {
        const state = {
          ...createInitialState(1),
          money: 0,
          lessons: { ...createInitialState(1).lessons, documentEverything: 1 },
        };
        expect(bankruptcyReward(state)).toBeGreaterThan(0);
        return;
      }

      expect(applyLessonToParts(parts, lesson.id)).not.toEqual(parts);
    });
  });
});
