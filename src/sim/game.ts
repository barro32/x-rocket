import { Mulberry32, type Rng } from './rng';
import { availableLessons, defaultLessons, rebuildRocketStats } from './lessons';
import { buyMetaUpgrade as buyMetaUpgradeCore, defaultMetaUpgrades, metaUpgradeCost } from './metaUpgrades';
import { launchVariance, orbitScoreThreshold, performanceStatIds, rocketScore, statLabel, type PerformanceStatId } from './rocketStats';
import type {
  FailurePhase,
  GameState,
  LaunchResult,
  LessonId,
  MetaUpgradeId,
  RocketStatId,
  RocketStats,
  RolledRocketStats,
} from './types';

const orbitAltitudeMeters = 100_000;
const startingMoney = 100;
const restartLoan = 100;
const baseLaunchCost = 50;

export function createInitialState(seed = Date.now(), metaUpgrades = defaultMetaUpgrades): GameState {
  const normalizedMetaUpgrades = { ...defaultMetaUpgrades, ...metaUpgrades };
  const initialLessons = startingLessonsFor(normalizedMetaUpgrades);
  return {
    version: 2,
    money: startingMoneyFor(normalizedMetaUpgrades),
    knowledge: 0,
    metaUpgrades: normalizedMetaUpgrades,
    safetyReviewUses: 0,
    companyIndex: 23,
    launches: 0,
    bankruptcies: 0,
    bankruptcyRewardClaimed: false,
    highestAltitudeMeters: 0,
    lessons: initialLessons,
    pendingLessonChoices: [],
    rocketStats: rebuildRocketStats(normalizedMetaUpgrades, initialLessons),
    unlockedLayers: {
      ground: true,
      orbit: false,
      station: false,
      moon: false,
      mars: false,
      solar: false,
    },
    seed,
  };
}

export function buyMetaUpgrade(state: GameState, id: MetaUpgradeId): GameState {
  const next = buyMetaUpgradeCore(state, id);
  if (next === state) {
    return state;
  }

  return {
    ...next,
    rocketStats: rebuildRocketStats(next.metaUpgrades, next.lessons),
    pendingLessonChoices: [],
  };
}

export function launchCost(state: GameState): number {
  const assemblyDiscountPerStack = 0.05 + (state.metaUpgrades.supplierContracts > 0 ? 0.01 : 0);
  const assemblyDiscount = Math.min(0.48, state.lessons.standardizeAssembly * assemblyDiscountPerStack);
  const contractDiscount = Math.min(0.34, state.metaUpgrades.supplierContracts * 0.06);
  return Math.max(6, Math.floor(baseLaunchCost * (1 - assemblyDiscount - contractDiscount)));
}

export function isBankrupt(state: GameState): boolean {
  return state.money < launchCost(state);
}

export function chooseLesson(state: GameState, id: LessonId): GameState {
  if (!state.pendingLessonChoices.includes(id)) {
    return state;
  }

  const nextLessons = {
    ...state.lessons,
    [id]: state.lessons[id] + 1,
  };

  return {
    ...state,
    lessons: nextLessons,
    rocketStats: rebuildRocketStats(state.metaUpgrades, nextLessons),
    pendingLessonChoices: [],
  };
}

export function restartCompany(state: GameState): GameState {
  const claimedState = claimBankruptcyReward(state);
  const nextSeed = claimedState.seed + 1;

  return {
    ...createInitialState(nextSeed, claimedState.metaUpgrades),
    money: restartMoneyFor(claimedState.metaUpgrades),
    knowledge: claimedState.knowledge,
    companyIndex: claimedState.companyIndex + 1,
    bankruptcies: claimedState.bankruptcies + 1,
    highestAltitudeMeters: claimedState.highestAltitudeMeters,
    safetyReviewUses: 0,
    unlockedLayers: { ...claimedState.unlockedLayers },
  };
}

export function bankruptcyReward(state: GameState): number {
  return state.lessons.documentEverything + state.metaUpgrades.failureReviewBoard;
}

export function claimBankruptcyReward(state: GameState): GameState {
  if (!isBankrupt(state) || state.bankruptcyRewardClaimed) {
    return state;
  }

  return {
    ...state,
    knowledge: state.knowledge + bankruptcyReward(state),
    bankruptcyRewardClaimed: true,
  };
}

function startingMoneyFor(metaUpgrades: Record<MetaUpgradeId, number>): number {
  return startingMoney + metaUpgrades.questionableInvestors * 180;
}

function restartMoneyFor(metaUpgrades: Record<MetaUpgradeId, number>): number {
  return restartLoan + metaUpgrades.questionableInvestors * 180;
}

function startingLessonsFor(metaUpgrades: Record<MetaUpgradeId, number>): Record<LessonId, number> {
  return {
    ...defaultLessons,
    tuneEngineMix: Math.min(2, metaUpgrades.prototypeArchive),
  };
}

function calculateSalvage(
  cost: number,
  salvageRate: number,
  outcome: LaunchResult['outcome'],
): number {
  if (outcome === 'exploded') {
    return Math.floor(cost * salvageRate);
  }

  if (outcome === 'failed') {
    return Math.floor(cost * salvageRate * 0.5);
  }

  return 0;
}

export function simulateLaunch(state: GameState, rng: Rng = new Mulberry32(state.seed + state.launches)): GameState {
  if (state.pendingLessonChoices.length > 0) {
    return state;
  }

  const cost = launchCost(state);
  if (state.money < cost) {
    return state;
  }

  const variance = launchVariance(state.rocketStats);
  const rolledStats = rollLaunchStats(state.rocketStats, rng, variance);
  const failure = rollFailure(rolledStats, rng);
  const reliability = state.rocketStats.reliability / 99;
  const score = rocketScore(rolledStats);
  const nominalAltitudeMeters = Math.floor(orbitAltitudeMeters * clamp(score / orbitScoreThreshold, 0.04, 1.15));
  const altitudeMeters = failure
    ? Math.floor(nominalAltitudeMeters * failure.altitudeFactor)
    : nominalAltitudeMeters;

  let outcome: LaunchResult['outcome'] = 'failed';
  let effectiveFailure = failure;
  let safetyReviewUses = state.safetyReviewUses;
  if (failure?.explodes && state.metaUpgrades.safetyReviewBoard > safetyReviewUses) {
    effectiveFailure = {
      ...failure,
      explodes: false,
    };
    safetyReviewUses += 1;
  }

  if (effectiveFailure?.explodes) {
    outcome = 'exploded';
  } else if (score >= orbitScoreThreshold) {
    outcome = 'orbit';
  }

  const contractPayout = outcome === 'orbit' ? 220 : 0;
  const salvage = calculateSalvage(cost, salvageRateFor(state), outcome);
  const moneyDelta = contractPayout + salvage - cost;
  const money = state.money + moneyDelta;
  const highestAltitudeMeters = Math.max(state.highestAltitudeMeters, altitudeMeters);

  const result: LaunchResult = {
    outcome,
    altitudeMeters,
    moneyDelta,
    reliability,
    score,
    rolledStats,
    failurePhase: effectiveFailure?.phase,
    failedStat: effectiveFailure?.stat,
    message: launchMessage(outcome, altitudeMeters, effectiveFailure, safetyReviewUses > state.safetyReviewUses),
  };

  return {
    ...state,
    money,
    knowledge: state.knowledge + 1,
    launches: state.launches + 1,
    highestAltitudeMeters,
    safetyReviewUses,
    lastLaunch: result,
    pendingLessonChoices: money >= launchCost({ ...state, money }) ? draftLessonChoices(state, rng, outcome, effectiveFailure?.stat) : [],
    unlockedLayers: {
      ...state.unlockedLayers,
      orbit: state.unlockedLayers.orbit || outcome === 'orbit',
    },
  };
}

interface FailureResult {
  phase: FailurePhase;
  stat: RocketStatId;
  explodes: boolean;
  altitudeFactor: number;
}

function rollFailure(
  stats: RolledRocketStats,
  rng: Rng,
): FailureResult | undefined {
  for (const statId of performanceStatIds) {
    if (rng.next() < failureChanceFor(stats[statId])) {
      return {
        phase: statId,
        stat: statId,
        explodes: true,
        altitudeFactor: failureAltitudeFactor(statId),
      };
    }
  }

  return undefined;
}

function launchMessage(
  outcome: LaunchResult['outcome'],
  altitudeMeters: number,
  failure?: FailureResult,
  shielded = false,
): string {
  const altitudeM = Math.floor(altitudeMeters);

  if (failure) {
    const statName = statLabel(failure.stat);
    const shieldNote = shielded ? ' Safety board vetoed the explosion.' : '';
    if (failure.explodes) {
      return `${statName} roll collapsed at ${altitudeM} m. Vehicle destroyed.${shieldNote}`;
    }
    return `${statName} roll collapsed at ${altitudeM} m. Flight ended early.${shieldNote}`;
  }

  if (outcome === 'orbit') {
    return `Orbit reached at ${altitudeM} m. Contracts unlocked.`;
  }

  if (outcome === 'exploded') {
    return `Vehicle exploded at ${altitudeM} m. The engineers learned something.`;
  }

  return `Flight topped out at ${altitudeM} m. Iterate and launch again.`;
}

function draftLessonChoices(
  state: GameState,
  rng: Rng,
  outcome: LaunchResult['outcome'],
  failedStat?: RocketStatId,
): LessonId[] {
  const baseCount = 3 + (state.lessons.recruitSpecialist > 0 && (state.launches + 1) % 2 === 0 ? 1 : 0);
  const targetCount = Math.min(Math.max(3, baseCount), availableLessons(state).length);
  const guaranteedLesson = state.metaUpgrades.missionControl > 0 && outcome !== 'orbit' && failedStat
    ? lessonForFailedStat(failedStat)
    : undefined;
  return draftChoices(state, rng, targetCount, guaranteedLesson);
}

function draftChoices(state: GameState, rng: Rng, targetCount: number, guaranteedLesson?: LessonId): LessonId[] {
  const pool = availableLessons(state);
  const choices: LessonId[] = [];

  if (guaranteedLesson && pool.includes(guaranteedLesson)) {
    choices.push(guaranteedLesson);
    pool.splice(pool.indexOf(guaranteedLesson), 1);
  }

  while (choices.length < targetCount) {
    const index = clamp(Math.floor(rng.next() * pool.length), 0, pool.length - 1);
    const [choice] = pool.splice(index, 1);
    choices.push(choice);
  }

  return choices;
}

function lessonForFailedStat(statId: RocketStatId): LessonId | undefined {
  switch (statId) {
    case 'thrust':
      return 'tuneEngineMix';
    case 'fuel':
      return 'improveFuelFlow';
    case 'aerodynamics':
      return 'fairNoseCone';
    case 'lightness':
      return 'cutDeadWeight';
    case 'guidance':
      return 'stabilizeFins';
    case 'reliability':
      return 'reinforceFrame';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rollLaunchStats(
  stats: RocketStats,
  rng: Rng,
  variance: number,
): RolledRocketStats {
  return {
    thrust: rollStat(stats.thrust, variance, rng),
    fuel: rollStat(stats.fuel, variance, rng),
    aerodynamics: rollStat(stats.aerodynamics, variance, rng),
    lightness: rollStat(stats.lightness, variance, rng),
    guidance: rollStat(stats.guidance, variance, rng),
  };
}

function rollStat(baseValue: number, variance: number, rng: Rng): number {
  const spread = Math.round((rng.next() * 2 - 1) * variance);
  return clamp(baseValue + spread, 0, 99);
}

function failureChanceFor(statValue: number): number {
  return clamp(0.024 - statValue * 0.00019, 0.005, 0.024);
}

function failureAltitudeFactor(statId: PerformanceStatId): number {
  switch (statId) {
    case 'thrust':
      return 0.08;
    case 'fuel':
      return 0.24;
    case 'lightness':
      return 0.46;
    case 'aerodynamics':
      return 0.7;
    case 'guidance':
      return 0.88;
  }
}

function salvageRateFor(state: GameState): number {
  const salvageLessonRate = 0.07 + (state.metaUpgrades.recoveryProgram > 0 ? 0.03 : 0);
  let salvageRate = state.lessons.salvageUsefulParts * salvageLessonRate;
  if (state.metaUpgrades.scrapyardEngineering > 0) {
    salvageRate += 0.08;
  }
  if (state.metaUpgrades.recoveryProgram > 0) {
    salvageRate += 0.14;
  }
  return clamp(salvageRate, 0, 0.8);
}
