import type { MetaUpgradeId, RocketStatId, RocketStats } from './types';

export type PerformanceStatId = Exclude<RocketStatId, 'reliability'>;

export const performanceStatIds: PerformanceStatId[] = ['thrust', 'fuel', 'aerodynamics', 'lightness', 'guidance'];

const baseRocketStats: RocketStats = {
  thrust: 22,
  fuel: 24,
  aerodynamics: 16,
  lightness: 14,
  guidance: 12,
  reliability: 18,
};

export const orbitScoreThreshold = 280;

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
  return stats.thrust * 2.6 + stats.fuel * 2.4 + stats.aerodynamics * 2 + stats.lightness * 2.1 + stats.guidance * 1.5;
}

export function launchVariance(stats: RocketStats): number {
  return Math.max(5, 18 - Math.floor(stats.reliability / 8));
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
