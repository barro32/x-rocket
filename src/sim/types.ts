export type LessonId =
  | 'reinforceFrame'
  | 'tuneEngineMix'
  | 'improveFuelFlow'
  | 'salvageUsefulParts'
  | 'stabilizeFins'
  | 'cutDeadWeight'
  | 'standardizeAssembly'
  | 'recruitSpecialist'
  | 'documentEverything';

export type LayerId = 'ground' | 'orbit' | 'station' | 'moon' | 'mars' | 'solar';

export type MetaUpgradeId =
  | 'blackBoxRecovery'
  | 'scrapyardEngineering'
  | 'questionableInvestors'
  | 'basicStabilizers'
  | 'recoveryProgram'
  | 'supplierContracts'
  | 'prototypeArchive'
  | 'safetyReviewBoard'
  | 'missionControl'
  | 'crashLab'
  | 'guidanceProgram'
  | 'advancedAerodynamics'
  | 'failureReviewBoard';

export type RocketPartId =
  | 'engine'
  | 'fuelTank'
  | 'body'
  | 'noseCone'
  | 'fins'
  | 'avionics'
  | 'launchMount'
  | 'recovery';

export type FailurePhase = 'ignition' | 'liftoff' | 'ascent' | 'upperAtmosphere' | 'orbitInsertion';

export type LaunchOutcome = 'exploded' | 'failed' | 'orbit';

export interface LessonSpec {
  id: LessonId;
  name: string;
  description: string;
  effect: string;
  maxStacks: number;
  unlock?: MetaUpgradeId;
}

export interface MetaUpgradeSpec {
  id: MetaUpgradeId;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  prerequisites?: MetaUpgradeId[];
  unlocks: string;
}

export interface LaunchResult {
  outcome: LaunchOutcome;
  altitudeMeters: number;
  moneyDelta: number;
  reliability: number;
  failurePhase?: FailurePhase;
  failedPart?: RocketPartId;
  message: string;
}

export interface PartStats {
  unlocked: boolean;
  reliability: number;
  mass: number;
  cost: number;
  thrust: number;
  burnTime: number;
  fuelCapacity: number;
  aerodynamics: number;
  stability: number;
  heatTolerance: number;
  salvageRate: number;
}

export type RocketParts = Record<RocketPartId, PartStats>;

export interface DerivedRocketStats {
  thrust: number;
  burnTime: number;
  fuelCapacity: number;
  mass: number;
  cost: number;
  thrustToWeight: number;
  aerodynamics: number;
  stability: number;
  structuralReliability: number;
  ignitionReliability: number;
  flightReliability: number;
  heatTolerance: number;
  salvageRate: number;
}

export interface GameState {
  version: 1;
  money: number;
  knowledge: number;
  metaUpgrades: Record<MetaUpgradeId, number>;
  safetyReviewUses: number;
  companyIndex: number;
  launches: number;
  bankruptcies: number;
  bankruptcyRewardClaimed: boolean;
  highestAltitudeMeters: number;
  lastLaunch?: LaunchResult;
  lessons: Record<LessonId, number>;
  pendingLessonChoices: LessonId[];
  parts: RocketParts;
  unlockedLayers: Record<LayerId, boolean>;
  seed: number;
}
