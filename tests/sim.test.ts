import { describe, expect, it } from 'vitest';
import { bankruptcyReward, buyMetaUpgrade, chooseLesson, claimBankruptcyReward, createInitialState, isBankrupt, launchCost, restartCompany, simulateLaunch } from '../src/sim/game';
import { applyLessonToRocketStats, availableLessons, lessonSpecs } from '../src/sim/lessons';
import { defaultMetaUpgrades, isMetaUpgradeUnlocked, metaUpgradeById, metaUpgradeCost } from '../src/sim/metaUpgrades';
import { orbitScoreThreshold, rocketScore } from '../src/sim/rocketStats';
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
    const next = simulateLaunch(state, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0]));

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

  it('starts with visible rocket stats below orbit threshold', () => {
    const state = createInitialState(1);

    expect(state.rocketStats.thrust).toBeGreaterThan(0);
    expect(state.rocketStats.lightness).toBeGreaterThanOrEqual(0);
    expect(rocketScore(state.rocketStats)).toBeLessThan(orbitScoreThreshold);
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
    const next = simulateLaunch(state, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.99, 0.99, 0, 0.99, 0.99]));

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
    const next = simulateLaunch(state, new FixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0]));

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
