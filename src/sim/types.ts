export type LessonId =
  | 'reinforceFrame'
  | 'tuneEngineMix'
  | 'improveFuelFlow'
  | 'salvageUsefulParts'
  | 'stabilizeFins'
  | 'fairNoseCone'
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

export type RocketStatId = 'thrust' | 'fuel' | 'aerodynamics' | 'lightness' | 'guidance' | 'reliability';

export type FailurePhase = RocketStatId;

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
  score: number;
  rolledStats: RolledRocketStats;
  failurePhase?: FailurePhase;
  failedStat?: RocketStatId;
  message: string;
}

export interface RocketStats {
  thrust: number;
  fuel: number;
  aerodynamics: number;
  lightness: number;
  guidance: number;
  reliability: number;
}

export type RolledRocketStats = Pick<RocketStats, 'thrust' | 'fuel' | 'aerodynamics' | 'lightness' | 'guidance'>;

export interface GameState {
  version: 2;
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
  rocketStats: RocketStats;
  unlockedLayers: Record<LayerId, boolean>;
  seed: number;
}
