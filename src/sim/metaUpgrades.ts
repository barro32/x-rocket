import type { MetaUpgradeId, MetaUpgradeSpec } from './types';

export const metaUpgradeSpecs: MetaUpgradeSpec[] = [
  {
    id: 'blackBoxRecovery',
    name: 'Black Box Recovery',
    description: 'Recovered telemetry unlocks dangerous failure lessons.',
    cost: 1,
    maxLevel: 1,
    unlocks: 'Unlocks Improve Fuel Flow and Cut Dead Weight cards.',
  },
  {
    id: 'scrapyardEngineering',
    name: 'Scrapyard Engineering',
    description: 'Salvage crews recover value from failed launches.',
    cost: 1,
    maxLevel: 1,
    prerequisites: ['blackBoxRecovery'],
    unlocks: 'Unlocks Salvage Useful Parts, recovery hardware, and extra explosion salvage.',
  },
  {
    id: 'questionableInvestors',
    name: 'Questionable Investors',
    description: 'They ask no questions and expect fast launches.',
    cost: 1,
    maxLevel: 3,
    prerequisites: ['blackBoxRecovery'],
    unlocks: '+$180 starting money per level.',
  },
  {
    id: 'basicStabilizers',
    name: 'Basic Stabilizers',
    description: 'Someone finally invents fins.',
    cost: 2,
    maxLevel: 1,
    prerequisites: ['blackBoxRecovery'],
    unlocks: 'Unlocks fins and Stabilize the Fins card.',
  },
  {
    id: 'recoveryProgram',
    name: 'Recovery Program',
    description: 'Parachutes, trackers, and people willing to search fields.',
    cost: 2,
    maxLevel: 1,
    prerequisites: ['scrapyardEngineering'],
    unlocks: 'Improves recovery hardware and explosion salvage.',
  },
  {
    id: 'guidanceProgram',
    name: 'Guidance Program',
    description: 'Stop aiming rockets with vibes.',
    cost: 2,
    maxLevel: 1,
    prerequisites: ['basicStabilizers'],
    unlocks: 'Unlocks avionics and Recruit a Specialist card.',
  },
  {
    id: 'advancedAerodynamics',
    name: 'Advanced Aerodynamics',
    description: 'A pointy end is discovered.',
    cost: 3,
    maxLevel: 1,
    prerequisites: ['basicStabilizers'],
    unlocks: 'Unlocks nose cone and better upper-atmosphere performance.',
  },
  {
    id: 'failureReviewBoard',
    name: 'Failure Review Board',
    description: 'Bankruptcy becomes a structured learning event.',
    cost: 3,
    maxLevel: 3,
    prerequisites: ['questionableInvestors'],
    unlocks: '+1 meta knowledge per bankruptcy per level.',
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

export function buyMetaUpgrade<T extends { knowledge: number; metaUpgrades: Record<MetaUpgradeId, number> }>(
  state: T,
  id: MetaUpgradeId,
): T {
  const spec = metaUpgradeById[id];
  const level = state.metaUpgrades[id];

  if (level >= spec.maxLevel || state.knowledge < spec.cost || !isMetaUpgradeUnlocked(state.metaUpgrades, id)) {
    return state;
  }

  return {
    ...state,
    knowledge: state.knowledge - spec.cost,
    metaUpgrades: {
      ...state.metaUpgrades,
      [id]: level + 1,
    },
  };
}
