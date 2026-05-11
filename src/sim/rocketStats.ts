import type { MetaUpgradeId, RocketStatId, RocketStats } from './types';

export type PerformanceStatId = Exclude<RocketStatId, 'reliability'>;

export const performanceStatIds: PerformanceStatId[] = ['thrust', 'fuel', 'aerodynamics', 'lightness', 'guidance'];

const baseRocketStats: RocketStats = {
  thrust: 0,
  fuel: 0,
  aerodynamics: 0,
  lightness: 0,
  guidance: 0,
  reliability: 0,
};

export const orbitScoreThreshold = 495;

export function createBaseRocketStats(metaUpgrades?: Record<MetaUpgradeId, number>): RocketStats {
  const stats = cloneRocketStats(baseRocketStats);

  if (!metaUpgrades) {
    return stats;
  }

  return stats;
}

export function cloneRocketStats(stats: RocketStats): RocketStats {
  return { ...stats };
}

export function improveRocketStat(stats: RocketStats, statId: RocketStatId, amount: number): RocketStats {
  return {
    ...stats,
    [statId]: clampRocketStat(stats[statId] + amount),
  };
}

export function rocketScore(stats: Pick<RocketStats, 'thrust' | 'fuel' | 'aerodynamics' | 'lightness' | 'guidance'>): number {
  return stats.thrust + stats.fuel + stats.aerodynamics + stats.lightness + stats.guidance;
}

export function statLabel(statId: RocketStatId): string {
  switch (statId) {
    case 'thrust':
      return 'Thrust';
    case 'fuel':
      return 'Fuel';
    case 'aerodynamics':
      return 'Aerodynamics';
    case 'lightness':
      return 'Lightness';
    case 'guidance':
      return 'Guidance';
    case 'reliability':
      return 'Reliability';
  }
}

export function clampRocketStat(value: number): number {
  return Math.min(99, Math.max(0, Math.round(value)));
}
