import type { MetaUpgradeId, MetaUpgradeSpec } from './types';

export const metaUpgradeSpecs: MetaUpgradeSpec[] = [
  {
    id: 'blackBoxRecovery',
    name: 'Black Box Recovery',
    description: 'Recovered telemetry unlocks dangerous failure lessons.',
    baseCost: 1,
    costGrowth: 1,
    maxLevel: 1,
    unlocks: 'Unlocks Improve Fuel Flow and Cut Dead Weight cards.',
  },
  {
    id: 'scrapyardEngineering',
    name: 'Scrapyard Engineering',
    description: 'Salvage crews recover value from failed launches.',
    baseCost: 2,
    costGrowth: 1,
    maxLevel: 1,
    prerequisites: ['blackBoxRecovery'],
    unlocks: 'Unlocks Salvage Useful Parts, recovery hardware, and extra explosion salvage.',
  },
  {
    id: 'questionableInvestors',
    name: 'Questionable Investors',
    description: 'They ask no questions and expect fast launches.',
    baseCost: 1,
    costGrowth: 2.2,
    maxLevel: 5,
    prerequisites: ['blackBoxRecovery'],
    unlocks: '+$180 starting and restart money per level.',
  },
  {
    id: 'basicStabilizers',
    name: 'Basic Stabilizers',
    description: 'Someone finally invents fins.',
    baseCost: 2,
    costGrowth: 1,
    maxLevel: 1,
    prerequisites: ['blackBoxRecovery'],
    unlocks: 'Unlocks fins and Stabilize the Fins card.',
  },
  {
    id: 'recoveryProgram',
    name: 'Recovery Program',
    description: 'Parachutes, trackers, and people willing to search fields.',
    baseCost: 2,
    costGrowth: 1,
    maxLevel: 1,
    prerequisites: ['scrapyardEngineering'],
    unlocks: 'Improves recovery hardware and explosion salvage.',
  },
  {
    id: 'supplierContracts',
    name: 'Supplier Contracts',
    description: 'Bulk rates and better procurement keep launch costs under control.',
    baseCost: 2,
    costGrowth: 1.85,
    maxLevel: 4,
    prerequisites: ['scrapyardEngineering'],
    unlocks: 'Launch cost -6% per level.',
  },
  {
    id: 'failureReviewBoard',
    name: 'Failure Review Board',
    description: 'Bankruptcy becomes a structured learning event.',
    baseCost: 3,
    costGrowth: 1.95,
    maxLevel: 5,
    prerequisites: ['questionableInvestors'],
    unlocks: '+1 meta knowledge per bankruptcy per level.',
  },
  {
    id: 'prototypeArchive',
    name: 'Prototype Archive',
    description: 'New companies begin with archived lesson drafts.',
    baseCost: 2,
    costGrowth: 1.9,
    maxLevel: 3,
    prerequisites: ['failureReviewBoard'],
    unlocks: 'New companies start with 1 additional lesson choice per level.',
  },
  {
    id: 'safetyReviewBoard',
    name: 'Safety Review Board',
    description: 'A single catastrophic failure can be vetoed each company.',
    baseCost: 3,
    costGrowth: 2.1,
    maxLevel: 2,
    prerequisites: ['failureReviewBoard'],
    unlocks: 'Each level grants one explosion shield per company.',
  },
  {
    id: 'missionControl',
    name: 'Mission Control',
    description: 'Better flight controllers keep the crew ahead of the rocket.',
    baseCost: 3,
    costGrowth: 2,
    maxLevel: 3,
    prerequisites: ['prototypeArchive'],
    unlocks: 'Every post-launch lesson draft gains +1 choice per level.',
  },
  {
    id: 'crashLab',
    name: 'Crash Lab',
    description: 'Explosions now generate much better follow-up questions.',
    baseCost: 3,
    costGrowth: 2.15,
    maxLevel: 3,
    prerequisites: ['safetyReviewBoard'],
    unlocks: 'Exploded launches add +1 lesson choice per level.',
  },
  {
    id: 'guidanceProgram',
    name: 'Guidance Program',
    description: 'Stop aiming rockets with vibes.',
    baseCost: 2,
    costGrowth: 1,
    maxLevel: 1,
    prerequisites: ['basicStabilizers'],
    unlocks: 'Unlocks avionics and Recruit a Specialist card.',
  },
  {
    id: 'advancedAerodynamics',
    name: 'Advanced Aerodynamics',
    description: 'A pointy end is discovered.',
    baseCost: 3,
    costGrowth: 1,
    maxLevel: 1,
    prerequisites: ['basicStabilizers'],
    unlocks: 'Unlocks nose cone and better upper-atmosphere performance.',
  },
];

export const metaUpgradeById = Object.fromEntries(
  metaUpgradeSpecs.map((spec) => [spec.id, spec]),
) as Record<MetaUpgradeId, MetaUpgradeSpec>;

export const defaultMetaUpgrades: Record<MetaUpgradeId, number> = {
  blackBoxRecovery: 0,
  scrapyardEngineering: 0,
  questionableInvestors: 0,
  basicStabilizers: 0,
  recoveryProgram: 0,
  supplierContracts: 0,
  prototypeArchive: 0,
  safetyReviewBoard: 0,
  missionControl: 0,
  crashLab: 0,
  guidanceProgram: 0,
  advancedAerodynamics: 0,
  failureReviewBoard: 0,
};

export function hasMetaUpgrade(metaUpgrades: Record<MetaUpgradeId, number>, id: MetaUpgradeId): boolean {
  return metaUpgrades[id] > 0;
}

export function isMetaUpgradeUnlocked(metaUpgrades: Record<MetaUpgradeId, number>, id: MetaUpgradeId): boolean {
  const prerequisites = metaUpgradeById[id].prerequisites ?? [];
  return prerequisites.every((prerequisite) => hasMetaUpgrade(metaUpgrades, prerequisite));
}

export function metaUpgradeCost(spec: MetaUpgradeSpec, currentLevel: number): number {
  return Math.max(1, Math.ceil(spec.baseCost * Math.pow(spec.costGrowth, currentLevel)));
}

export function buyMetaUpgrade<T extends { knowledge: number; metaUpgrades: Record<MetaUpgradeId, number> }>(
  state: T,
  id: MetaUpgradeId,
): T {
  const spec = metaUpgradeById[id];
  const level = state.metaUpgrades[id];
  const cost = metaUpgradeCost(spec, level);

  if (level >= spec.maxLevel || state.knowledge < cost || !isMetaUpgradeUnlocked(state.metaUpgrades, id)) {
    return state;
  }

  return {
    ...state,
    knowledge: state.knowledge - cost,
    metaUpgrades: {
      ...state.metaUpgrades,
      [id]: level + 1,
    },
  };
}
