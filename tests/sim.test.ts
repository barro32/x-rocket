import { describe, expect, it } from 'vitest';
import { bankruptcyReward, buyMetaUpgrade, chooseLesson, claimBankruptcyReward, createInitialState, isBankrupt, launchCost, restartCompany, simulateLaunch } from '../src/sim/game';
import { applyLessonToRocketStats, availableLessons, lessonEffectText, lessonSpecs } from '../src/sim/lessons';
import { defaultMetaUpgrades, isMetaUpgradeUnlocked, metaUpgradeById, metaUpgradeCost } from '../src/sim/metaUpgrades';
import { orbitScoreThreshold, rocketScore } from '../src/sim/rocketStats';
import type { Rng } from '../src/sim/rng';
import type { GameState, LessonId, MetaUpgradeId, RocketStats } from '../src/sim/types';

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
    const next = simulateLaunch(state, new FixedRng([0]));

    expect(next.launches).toBe(1);
    expect(next.money).toBeLessThan(state.money);
    expect(next.knowledge).toBe(state.knowledge + 1);
    expect(next.pendingLessonChoices).toEqual(['tuneEngineMix']);
    expect(next.lastLaunch?.outcome).toBe('exploded');
    expect(next.lastLaunch?.failedStat).toBe('thrust');
  });

  it('applies one drafted lesson before the next launch', () => {
    const state = {
      ...createInitialState(1),
      pendingLessonChoices: ['tuneEngineMix'] satisfies LessonId[],
    };
    const next = chooseLesson(state, 'tuneEngineMix');

    expect(next.lessons.tuneEngineMix).toBe(1);
    expect(next.rocketStats.thrust).toBeGreaterThan(state.rocketStats.thrust);
    expect(next.pendingLessonChoices).toHaveLength(0);
  });

  it('starts with zero rocket stats below orbit threshold', () => {
    const state = createInitialState(1);

    expect(state.rocketStats).toEqual({
      thrust: 0,
      fuel: 0,
      aerodynamics: 0,
      lightness: 0,
      guidance: 0,
      reliability: 0,
    });
    expect(rocketScore(state.rocketStats)).toBeLessThan(orbitScoreThreshold);
  });

  it('does not roll zero launch stats upward or leave the pad', () => {
    const next = simulateLaunch(createInitialState(1), new FixedRng([0.99, 0.99, 0.99, 0.99, 0.99, 0]));

    expect(next.lastLaunch?.rolledStats).toEqual({
      thrust: 0,
      fuel: 0,
      aerodynamics: 0,
      lightness: 0,
      guidance: 0,
    });
    expect(next.lastLaunch?.score).toBe(0);
    expect(next.lastLaunch?.altitudeMeters).toBe(0);
  });

  it('allows nonzero launch stats to overperform without letting zero stats do so', () => {
    const state = {
      ...createInitialState(1),
      money: 1_000,
      rocketStats: {
        thrust: 10,
        fuel: 10,
        aerodynamics: 10,
        lightness: 10,
        guidance: 10,
        reliability: 99,
      },
    };
    const next = simulateLaunch(state, new FixedRng([0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99]));

    expect(next.lastLaunch?.rolledStats.thrust).toBeGreaterThan(state.rocketStats.thrust);
    expect(next.lastLaunch?.rolledStats.fuel).toBeGreaterThan(state.rocketStats.fuel);
    expect(next.lastLaunch?.score).toBeGreaterThan(rocketScore(state.rocketStats));
  });

  it('caps perfect max-stat launch altitude at 500 kilometers', () => {
    const state = {
      ...createInitialState(1),
      money: 1_000,
      rocketStats: {
        thrust: 99,
        fuel: 99,
        aerodynamics: 99,
        lightness: 99,
        guidance: 99,
        reliability: 99,
      },
    };
    const next = simulateLaunch(state, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.99, 0.99, 0.99, 0.99, 0.99]));

    expect(next.lastLaunch?.rolledStats).toEqual({
      thrust: 99,
      fuel: 99,
      aerodynamics: 99,
      lightness: 99,
      guidance: 99,
    });
    expect(next.lastLaunch?.altitudeMeters).toBe(500_000);
  });

  it('starts with only tune engine mix as a lesson card', () => {
    const state = createInitialState(1);

    expect(availableLessons(state)).toEqual(['tuneEngineMix']);
  });

  it('meta upgrades unlock new cards and upgrade card strength', () => {
    const state = { ...createInitialState(1), knowledge: 10 };
    const blocked = buyMetaUpgrade(state, 'basicStabilizers');
    const withRoot = buyMetaUpgrade(state, 'blackBoxRecovery');
    const next = buyMetaUpgrade(withRoot, 'basicStabilizers');
    const guidanceProgram = {
      ...next,
      metaUpgrades: { ...next.metaUpgrades, guidanceProgram: 2 },
    };
    const baseFins = applyLessonToRocketStats(next.rocketStats, 'stabilizeFins', next.metaUpgrades);
    const upgradedFins = applyLessonToRocketStats(guidanceProgram.rocketStats, 'stabilizeFins', guidanceProgram.metaUpgrades);

    expect(blocked.metaUpgrades.basicStabilizers).toBe(0);
    expect(isMetaUpgradeUnlocked(state.metaUpgrades, 'blackBoxRecovery')).toBe(true);
    expect(isMetaUpgradeUnlocked(state.metaUpgrades, 'basicStabilizers')).toBe(false);
    expect(withRoot.metaUpgrades.blackBoxRecovery).toBe(1);
    expect(next.metaUpgrades.basicStabilizers).toBe(1);
    expect(next.rocketStats.guidance).toBe(withRoot.rocketStats.guidance);
    expect(availableLessons(next)).toContain('stabilizeFins');
    expect(upgradedFins.guidance - guidanceProgram.rocketStats.guidance).toBeGreaterThan(baseFins.guidance - next.rocketStats.guidance);
  });

  it('formats lesson card effects with current meta scaling', () => {
    const metaUpgrades = {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      crashLab: 2,
      guidanceProgram: 2,
      advancedAerodynamics: 1,
      recoveryProgram: 1,
      supplierContracts: 1,
      failureReviewBoard: 4,
    };

    expect(lessonEffectText('tuneEngineMix', metaUpgrades)).toBe('Thrust +9 | Reliability -3');
    expect(lessonEffectText('stabilizeFins', metaUpgrades)).toBe('Guidance +9 | Aerodynamics +2 | Lightness -2');
    expect(lessonEffectText('fairNoseCone', metaUpgrades)).toBe('Aerodynamics +7 | Guidance +1');
    expect(lessonEffectText('reinforceFrame', metaUpgrades)).toBe('Reliability +8 | Lightness -3');
    expect(lessonEffectText('standardizeAssembly', metaUpgrades)).toBe('Launch cost -6%');
    expect(lessonEffectText('salvageUsefulParts', metaUpgrades)).toBe('Salvage +10%');
  });

  it('formats lesson card stat effects as clamped deltas for the current rocket', () => {
    const lowStats = {
      thrust: 97,
      fuel: 97,
      aerodynamics: 97,
      lightness: 1,
      guidance: 97,
      reliability: 1,
    };
    const highStats = {
      ...lowStats,
      lightness: 97,
    };

    expect(lessonEffectText('tuneEngineMix', defaultMetaUpgrades, lowStats)).toBe('Thrust +2 | Reliability -1');
    expect(lessonEffectText('cutDeadWeight', defaultMetaUpgrades, highStats)).toBe('Lightness +2 | Reliability -1');
    expect(lessonEffectText('reinforceFrame', defaultMetaUpgrades, lowStats)).toBe('Reliability +5 | Lightness -1');
  });

  it('applies every stat lesson from a midrange rocket before clamping', () => {
    const metaUpgrades = {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      basicStabilizers: 1,
      guidanceProgram: 1,
      advancedAerodynamics: 1,
      failureReviewBoard: 1,
    };
    const stats = {
      thrust: 40,
      fuel: 40,
      aerodynamics: 40,
      lightness: 40,
      guidance: 40,
      reliability: 40,
    };

    expect(appliedDeltaForLesson(stats, 'tuneEngineMix', metaUpgrades)).toMatchObject({ thrust: 7, reliability: -3 });
    expect(appliedDeltaForLesson(stats, 'improveFuelFlow', metaUpgrades)).toMatchObject({ fuel: 7, reliability: 1 });
    expect(appliedDeltaForLesson(stats, 'stabilizeFins', metaUpgrades)).toMatchObject({ guidance: 7, aerodynamics: 2, lightness: -2 });
    expect(appliedDeltaForLesson(stats, 'fairNoseCone', metaUpgrades)).toMatchObject({ aerodynamics: 7, guidance: 1 });
    expect(appliedDeltaForLesson(stats, 'cutDeadWeight', metaUpgrades)).toMatchObject({ lightness: 8, reliability: -3 });
    expect(appliedDeltaForLesson(stats, 'reinforceFrame', metaUpgrades)).toMatchObject({ reliability: 6, lightness: -3 });
    expect(appliedDeltaForLesson(stats, 'recruitSpecialist', metaUpgrades)).toMatchObject({ guidance: 8, reliability: 5 });
  });

  it('clamps stat lesson side effects from a zero-stat company', () => {
    const state = createInitialState(1, {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      basicStabilizers: 1,
      guidanceProgram: 1,
      advancedAerodynamics: 1,
      failureReviewBoard: 1,
    });

    expect(deltaForLesson(state, 'tuneEngineMix')).toMatchObject({ thrust: 7, reliability: 0 });
    expect(deltaForLesson(state, 'improveFuelFlow')).toMatchObject({ fuel: 7, reliability: 1 });
    expect(deltaForLesson(state, 'stabilizeFins')).toMatchObject({ guidance: 7, aerodynamics: 2, lightness: 0 });
    expect(deltaForLesson(state, 'fairNoseCone')).toMatchObject({ aerodynamics: 7, guidance: 1 });
    expect(deltaForLesson(state, 'cutDeadWeight')).toMatchObject({ lightness: 8, reliability: 0 });
    expect(deltaForLesson(state, 'reinforceFrame')).toMatchObject({ reliability: 6, lightness: 0 });
    expect(deltaForLesson(state, 'recruitSpecialist')).toMatchObject({ guidance: 8, reliability: 5 });
  });

  it('applies every economy and knowledge lesson through the drafted-card path', () => {
    const state = createInitialState(1, {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      scrapyardEngineering: 1,
      failureReviewBoard: 1,
    });
    const salvageState = chooseLesson({ ...state, pendingLessonChoices: ['salvageUsefulParts'] }, 'salvageUsefulParts');
    const standardizeState = chooseLesson({ ...state, pendingLessonChoices: ['standardizeAssembly'] }, 'standardizeAssembly');
    const documentState = chooseLesson({ ...state, pendingLessonChoices: ['documentEverything'] }, 'documentEverything');

    const explodedWithoutSalvage = simulateLaunch(state, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0]));
    const explodedWithSalvage = simulateLaunch(salvageState, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0]));

    expect(explodedWithSalvage.money).toBeGreaterThan(explodedWithoutSalvage.money);
    expect(launchCost(standardizeState)).toBeLessThan(launchCost(state));
    expect(bankruptcyReward(documentState)).toBe(bankruptcyReward(state) + 1);
  });

  it('clamps rocket stats between 0 and 99 after repeated lesson stacks', () => {
    const highStats = applyLessonToRocketStats({
      thrust: 98,
      fuel: 98,
      aerodynamics: 98,
      lightness: 98,
      guidance: 98,
      reliability: 98,
    }, 'recruitSpecialist', { ...defaultMetaUpgrades, guidanceProgram: 3 });
    const lowStats = applyLessonToRocketStats({
      thrust: 1,
      fuel: 1,
      aerodynamics: 1,
      lightness: 1,
      guidance: 1,
      reliability: 1,
    }, 'tuneEngineMix');

    Object.values(highStats).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(99);
    });
    Object.values(lowStats).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(99);
    });
    expect(highStats.guidance).toBe(99);
    expect(highStats.reliability).toBe(99);
    expect(lowStats.reliability).toBe(0);
  });

  it('meta upgrade costs scale for multi-level nodes', () => {
    const spec = metaUpgradeById.questionableInvestors;

    expect(metaUpgradeCost(spec, 0)).toBeLessThan(metaUpgradeCost(spec, 1));
    expect(metaUpgradeCost(spec, 1)).toBeLessThan(metaUpgradeCost(spec, 2));
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
      simulateLaunch(state, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.99, 0.99, 0.99, 0.99, 0.99])),
      'tuneEngineMix',
    );
    const afterSecondLaunch = chooseLesson(
      simulateLaunch(afterFirstLaunch, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.99, 0.99, 0.99, 0.99, 0.99])),
      'tuneEngineMix',
    );

    expect(state.money).toBe(100);
    expect(launchCost(state)).toBe(50);
    expect(isBankrupt(afterFirstLaunch)).toBe(false);
    expect(isBankrupt(afterSecondLaunch)).toBe(true);
  });

  it('does not draft lesson cards when the launch leaves the company bankrupt', () => {
    const state = {
      ...createInitialState(1),
      money: 50,
    };
    const next = simulateLaunch(state, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0]));

    expect(isBankrupt(next)).toBe(true);
    expect(next.pendingLessonChoices).toHaveLength(0);
  });

  it('bad launch stays under 100 meters', () => {
    const state = createInitialState(1);
    const next = simulateLaunch(state, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0]));

    expect(next.lastLaunch?.altitudeMeters).toBeLessThan(6_000);
  });

  it('engine tuning increases altitude potential', () => {
    const state = createInitialState(1);
    const tuned = chooseLesson({ ...state, pendingLessonChoices: ['tuneEngineMix'] }, 'tuneEngineMix');
    const cleanFlightRng = [0.5, 0.5, 0.5, 0.5, 0.5, 0.99, 0.99, 0.99, 0.99, 0.99];
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

  it('reliability tightens the launch variance band', () => {
    const base = createInitialState(1);
    const reinforced = chooseLesson({ ...base, pendingLessonChoices: ['reinforceFrame'] }, 'reinforceFrame');

    expect(reinforced.rocketStats.reliability).toBeGreaterThan(base.rocketStats.reliability);
  });

  it('reliability directly reduces catastrophic failure chance', () => {
    const lowReliability = createInitialState(1);
    const highReliability = {
      ...lowReliability,
      rocketStats: {
        ...lowReliability.rocketStats,
        reliability: 99,
      },
    };

    const lowReliabilityLaunch = simulateLaunch(lowReliability, new FixedRng([0.02]));
    const highReliabilityLaunch = simulateLaunch(highReliability, new FixedRng([0.02, 0.99, 0.99, 0.99, 0.99]));

    expect(lowReliabilityLaunch.lastLaunch?.outcome).toBe('exploded');
    expect(highReliabilityLaunch.lastLaunch?.outcome).toBe('failed');
    expect(highReliabilityLaunch.lastLaunch?.failedStat).toBeUndefined();
  });

  it('questionable investors increases restart money', () => {
    const state = {
      ...createInitialState(1, { ...defaultMetaUpgrades, questionableInvestors: 1 }),
      money: 0,
    };
    const next = restartCompany(state);

    expect(next.money).toBeGreaterThan(restartCompany({ ...createInitialState(1), money: 0 }).money);
  });

  it('supplier contracts lowers launch cost', () => {
    const state = createInitialState(1, { ...defaultMetaUpgrades, scrapyardEngineering: 1, supplierContracts: 2 });

    expect(launchCost(state)).toBeLessThan(launchCost(createInitialState(1)));
  });

  it('advanced aerodynamics unlocks a direct aerodynamics card', () => {
    const state = createInitialState(1, {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      basicStabilizers: 1,
      advancedAerodynamics: 1,
    });

    expect(availableLessons(state)).toContain('fairNoseCone');
  });

  it('prototype archive grants startup lesson stacks instead of draft choices', () => {
    const state = createInitialState(1, {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      failureReviewBoard: 1,
      prototypeArchive: 2,
    });

    expect(state.pendingLessonChoices).toHaveLength(0);
    expect(state.lessons.tuneEngineMix).toBe(2);
    expect(state.rocketStats.thrust).toBeGreaterThan(createInitialState(1).rocketStats.thrust);
  });

  it('mission control steers failed launch drafts toward the failed stat', () => {
    const state = createInitialState(1, {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      basicStabilizers: 1,
      failureReviewBoard: 1,
      prototypeArchive: 1,
      missionControl: 1,
      advancedAerodynamics: 1,
    });
    const next = simulateLaunch(state, new FixedRng([0.5, 0.99, 0.99, 0, 0.99, 0.99, 0]));

    expect(next.lastLaunch?.failedStat).toBe('aerodynamics');
    expect(next.pendingLessonChoices).toContain('fairNoseCone');
    expect(next.pendingLessonChoices).toHaveLength(3);
  });

  it('safety review board vetoes one catastrophic explosion per company', () => {
    const state = createInitialState(1, {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      failureReviewBoard: 1,
      safetyReviewBoard: 1,
    });
    const next = simulateLaunch(state, new FixedRng([0]));

    expect(next.lastLaunch?.outcome).not.toBe('exploded');
    expect(next.safetyReviewUses).toBe(1);
    expect(next.lastLaunch?.message).toContain('Safety board vetoed the explosion');
  });

  it('every lesson either changes rocket stats or explicitly changes economy/reward systems', () => {
    const stats = createInitialState(1, {
      ...defaultMetaUpgrades,
      blackBoxRecovery: 1,
      scrapyardEngineering: 1,
      basicStabilizers: 1,
      guidanceProgram: 1,
      advancedAerodynamics: 1,
      failureReviewBoard: 1,
    }).rocketStats;

    lessonSpecs.forEach((lesson) => {
      if (lesson.id === 'documentEverything' || lesson.id === 'salvageUsefulParts' || lesson.id === 'standardizeAssembly') {
        const state = {
          ...createInitialState(1),
          money: 0,
          lessons: { ...createInitialState(1).lessons, documentEverything: 1 },
        };
        if (lesson.id === 'documentEverything') {
          expect(bankruptcyReward(state)).toBeGreaterThan(0);
        }
        return;
      }

      expect(applyLessonToRocketStats(stats, lesson.id)).not.toEqual(stats);
    });
  });
});

function deltaForLesson(state: GameState, lessonId: LessonId): RocketStats {
  const next = chooseLesson({ ...state, pendingLessonChoices: [lessonId] }, lessonId);
  return {
    thrust: next.rocketStats.thrust - state.rocketStats.thrust,
    fuel: next.rocketStats.fuel - state.rocketStats.fuel,
    aerodynamics: next.rocketStats.aerodynamics - state.rocketStats.aerodynamics,
    lightness: next.rocketStats.lightness - state.rocketStats.lightness,
    guidance: next.rocketStats.guidance - state.rocketStats.guidance,
    reliability: next.rocketStats.reliability - state.rocketStats.reliability,
  };
}

function appliedDeltaForLesson(
  stats: RocketStats,
  lessonId: LessonId,
  metaUpgrades: Record<MetaUpgradeId, number>,
): RocketStats {
  const next = applyLessonToRocketStats(stats, lessonId, metaUpgrades);
  return {
    thrust: next.thrust - stats.thrust,
    fuel: next.fuel - stats.fuel,
    aerodynamics: next.aerodynamics - stats.aerodynamics,
    lightness: next.lightness - stats.lightness,
    guidance: next.guidance - stats.guidance,
    reliability: next.reliability - stats.reliability,
  };
}
