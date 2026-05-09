import { Mulberry32, type Rng } from './rng';
import { applyLessonToParts, availableLessons, defaultLessons } from './lessons';
import { buyMetaUpgrade as buyMetaUpgradeCore, defaultMetaUpgrades } from './metaUpgrades';
import { createBaseParts, deriveRocketStats } from './parts';
import type { FailurePhase, GameState, LaunchResult, RocketPartId, LessonId, MetaUpgradeId } from './types';

const orbitAltitudeMeters = 100_000;
const startingMoney = 120;
const restartLoan = 100;

export function createInitialState(seed = Date.now(), metaUpgrades = defaultMetaUpgrades): GameState {
  return {
    version: 1,
    money: startingMoneyFor(metaUpgrades),
    knowledge: 0,
    metaUpgrades: { ...defaultMetaUpgrades, ...metaUpgrades },
    companyIndex: 23,
    launches: 0,
    bankruptcies: 0,
    highestAltitudeMeters: 0,
    lessons: { ...defaultLessons },
    pendingLessonChoices: [],
    parts: createBaseParts(metaUpgrades),
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
    parts: createBaseParts(next.metaUpgrades),
    pendingLessonChoices: [],
  };
}

export function launchCost(state: GameState): number {
  const stats = deriveRocketStats(state.parts);
  const assemblyDiscount = Math.min(0.64, state.lessons.standardizeAssembly * 0.08);
  return Math.max(6, Math.floor(stats.cost * (1 - assemblyDiscount)));
}

export function isBankrupt(state: GameState): boolean {
  return state.money < launchCost(state);
}

export function chooseLesson(state: GameState, id: LessonId): GameState {
  if (!state.pendingLessonChoices.includes(id)) {
    return state;
  }

  return {
    ...state,
    lessons: {
      ...state.lessons,
      [id]: state.lessons[id] + 1,
    },
    parts: applyLessonToParts(state.parts, id),
    pendingLessonChoices: [],
  };
}

export function restartCompany(state: GameState): GameState {
  const metaKnowledgeGained = 1 + state.lessons.documentEverything + state.metaUpgrades.failureReviewBoard;

  return {
    ...createInitialState(state.seed + 1, state.metaUpgrades),
    money: restartMoneyFor(state.metaUpgrades),
    knowledge: state.knowledge + metaKnowledgeGained,
    companyIndex: state.companyIndex + 1,
    bankruptcies: state.bankruptcies + 1,
    highestAltitudeMeters: state.highestAltitudeMeters,
    unlockedLayers: { ...state.unlockedLayers },
  };
}

function startingMoneyFor(metaUpgrades: Record<MetaUpgradeId, number>): number {
  return startingMoney + metaUpgrades.questionableInvestors * 180;
}

function restartMoneyFor(metaUpgrades: Record<MetaUpgradeId, number>): number {
  return restartLoan + metaUpgrades.questionableInvestors * 180;
}

export function simulateLaunch(state: GameState, rng: Rng = new Mulberry32(state.seed + state.launches)): GameState {
  if (state.pendingLessonChoices.length > 0) {
    return state;
  }

  const cost = launchCost(state);
  if (state.money < cost) {
    return state;
  }

  const stats = deriveRocketStats(state.parts);
  const failure = rollFailure(stats, rng);
  const reliability = clamp(
    (stats.ignitionReliability + stats.flightReliability + stats.structuralReliability + stats.stability) / 4,
    0.05,
    0.96,
  );
  const volatilityFloor = 0.48 + stats.stability * 0.18;
  const volatilityRange = Math.max(0.34, 0.98 - stats.stability * 0.32);
  const volatility = volatilityFloor + rng.next() * volatilityRange;
  const flightScore = stats.thrustToWeight * stats.burnTime * (0.72 + stats.aerodynamics) * (0.7 + stats.stability);
  const nominalAltitudeMeters = Math.floor(14_000 * flightScore * volatility);
  const altitudeMeters = failure
    ? Math.floor(nominalAltitudeMeters * failure.altitudeFactor)
    : nominalAltitudeMeters;
  const orbitRoll = rng.next();

  let outcome: LaunchResult['outcome'] = 'failed';
  if (failure?.explodes) {
    outcome = 'exploded';
  } else if (altitudeMeters >= orbitAltitudeMeters && orbitRoll < reliability) {
    outcome = 'orbit';
  }

  const contractPayout = outcome === 'orbit' ? 220 : 0;
  const salvage = outcome === 'exploded' ? Math.floor(cost * stats.salvageRate) : 0;
  const moneyDelta = contractPayout + salvage - cost;
  const highestAltitudeMeters = Math.max(state.highestAltitudeMeters, altitudeMeters);

  const result: LaunchResult = {
    outcome,
    altitudeMeters,
    moneyDelta,
    reliability,
    failurePhase: failure?.phase,
    failedPart: failure?.part,
    message: launchMessage(outcome, altitudeMeters, failure),
  };

  return {
    ...state,
    money: state.money + moneyDelta,
    launches: state.launches + 1,
    highestAltitudeMeters,
    lastLaunch: result,
    pendingLessonChoices: draftLessonChoices(state, rng),
    unlockedLayers: {
      ...state.unlockedLayers,
      orbit: state.unlockedLayers.orbit || outcome === 'orbit',
    },
  };
}

interface FailureResult {
  phase: FailurePhase;
  part: RocketPartId;
  explodes: boolean;
  altitudeFactor: number;
}

function rollFailure(stats: ReturnType<typeof deriveRocketStats>, rng: Rng): FailureResult | undefined {
  const checks: Array<FailureResult & { chance: number }> = [
    {
      phase: 'ignition',
      part: 'engine',
      explodes: true,
      altitudeFactor: 0,
      chance: 1 - stats.ignitionReliability,
    },
    {
      phase: 'liftoff',
      part: 'launchMount',
      explodes: true,
      altitudeFactor: 0.08,
      chance: 1 - clamp((stats.ignitionReliability + stats.stability) / 2, 0, 1),
    },
    {
      phase: 'ascent',
      part: 'body',
      explodes: true,
      altitudeFactor: 0.42,
      chance: 1 - stats.structuralReliability,
    },
    {
      phase: 'upperAtmosphere',
      part: 'noseCone',
      explodes: false,
      altitudeFactor: 0.72,
      chance: 1 - clamp((stats.heatTolerance + stats.aerodynamics) / 2, 0, 1),
    },
    {
      phase: 'orbitInsertion',
      part: 'avionics',
      explodes: false,
      altitudeFactor: 0.9,
      chance: 1 - clamp((stats.flightReliability + stats.stability) / 2, 0, 1),
    },
  ];

  for (const check of checks) {
    if (rng.next() < check.chance) {
      return check;
    }
  }

  return undefined;
}

function launchMessage(
  outcome: LaunchResult['outcome'],
  altitudeMeters: number,
  failure?: FailureResult,
): string {
  const altitudeKm = Math.floor(altitudeMeters / 1_000);

  if (failure) {
    const partName = partLabel(failure.part);
    if (failure.phase === 'ignition') {
      return `${partName} failed during ignition. The pad crew ducked.`;
    }
    if (failure.explodes) {
      return `${partName} failed at ${altitudeKm} km. Vehicle destroyed.`;
    }
    return `${partName} failed at ${altitudeKm} km. Flight ended early.`;
  }

  if (outcome === 'orbit') {
    return `Stable orbit reached at ${altitudeKm} km. Contracts unlocked.`;
  }

  if (outcome === 'exploded') {
    return `Vehicle exploded at ${altitudeKm} km. The engineers learned something.`;
  }

  return `Flight topped out at ${altitudeKm} km. Iterate and launch again.`;
}

function partLabel(part: RocketPartId): string {
  switch (part) {
    case 'engine':
      return 'Engine';
    case 'fuelTank':
      return 'Fuel tank';
    case 'body':
      return 'Hull';
    case 'noseCone':
      return 'Nose cone';
    case 'fins':
      return 'Fins';
    case 'avionics':
      return 'Avionics';
    case 'launchMount':
      return 'Launch mount';
    case 'recovery':
      return 'Recovery system';
  }
}

function draftLessonChoices(state: GameState, rng: Rng): LessonId[] {
  const pool = availableLessons(state);
  const choiceCount = state.lessons.recruitSpecialist > 0 && (state.launches + 1) % 3 === 0 ? 4 : 3;
  const choices: LessonId[] = [];

  while (choices.length < Math.min(choiceCount, pool.length)) {
    const index = Math.floor(rng.next() * pool.length);
    const [choice] = pool.splice(index, 1);
    choices.push(choice);
  }

  return choices;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
