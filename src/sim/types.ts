export type DiceCategory = 'thrusters' | 'fuel' | 'aerodynamics' | 'guidance' | 'weight';

export type CardRarity = 'common' | 'uncommon' | 'rare';

export type MetaNodeId = string;

export interface CategoryDie {
  id: string;
  category: DiceCategory;
  faces: number[];
}

export interface DieRoll {
  dieId: string;
  category: DiceCategory;
  initialValue: number;
  initialFaceIndex: number;
  value: number;
  faces: number[];
  rerolledFrom?: number;
  rerolledFaceIndex?: number;
  modifiers: RollModifier[];
}

export interface RollModifier {
  label: string;
  before: number;
  after: number;
}

export interface LaunchRoll {
  rolls: DieRoll[];
  events: RollEvent[];
  score: number;
  exploded: boolean;
}

export type RollEvent =
  | { type: 'initialRoll'; category: DiceCategory; value: number; faceIndex: number }
  | { type: 'reroll'; category: DiceCategory; before: number; after: number; faceIndex: number }
  | { type: 'cardModifier'; cardId: string; cardName: string; label: string; category: DiceCategory; before: number; after: number };

export type CardEffect =
  | { type: 'addFaceValue'; category: DiceCategory; faceIndex: number; amount: number }
  | { type: 'addRandomFaceValue'; category: DiceCategory; faceIndexes: number[]; amount: number }
  | { type: 'addFaceValueToCategories'; categories: DiceCategory[]; faceIndex: number; amount: number }
  | { type: 'addAllFaces'; category: DiceCategory; amount: number }
  | { type: 'multiplyStat'; category: DiceCategory; multiplier: number }
  | { type: 'autoRerollLowest'; amount: number }
  | { type: 'doubleHighestRoll' }
  | { type: 'categoryDelta'; category: DiceCategory; amount: number; penaltyCategory?: DiceCategory; penaltyAmount?: number }
  | { type: 'topBottomDelta'; topAmount: number; bottomAmount: number };

export interface CardSpec {
  id: string;
  name: string;
  rarity: CardRarity;
  description: string;
  affectedCategories?: DiceCategory[];
  effect: CardEffect;
}

export interface LaunchResult {
  roll: LaunchRoll;
  heightMeters: number;
  moneyDelta: number;
  reachedRunMilestones: number[];
  reachedAllTimeMilestones: number[];
  message: string;
}

export type MetaNodeEffect =
  | { type: 'startingMoney' }
  | { type: 'addFaceValue'; category: DiceCategory; faceIndex: number; amount: number }
  | { type: 'addWeakestFace'; amount: number }
  | { type: 'autoRerollLowest'; amount: number }
  | { type: 'upgradeRandomFaceCard'; category: DiceCategory; amount: number }
  | { type: 'unlockCard'; cardId: string };

export interface MetaNodeSpec {
  id: MetaNodeId;
  label: string;
  cost: number;
  effect: MetaNodeEffect;
}

export interface GameState {
  version: 3;
  money: number;
  metaCurrency: number;
  boughtMetaNodes: MetaNodeId[];
  dice: Record<DiceCategory, CategoryDie>;
  runCards: CardSpec[];
  autoRerollLowest: number;
  temporaryAutoRerollLowest: number;
  launchCount: number;
  bankruptcies: number;
  bankruptcyRewardClaimed: boolean;
  highestAltitudeMeters: number;
  allTimeMilestoneClaims: number[];
  runMilestoneClaims: number[];
  pendingCardAwards: number;
  pendingCardChoices: CardSpec[];
  lastLaunch?: LaunchResult;
  seed: number;
}
