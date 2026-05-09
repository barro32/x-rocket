import type { DerivedRocketStats, PartStats, RocketPartId, RocketParts } from './types';
import type { MetaUpgradeId } from './types';
import { hasMetaUpgrade } from './metaUpgrades';

const emptyStats: PartStats = {
  reliability: 0,
  mass: 0,
  cost: 0,
  thrust: 0,
  burnTime: 0,
  fuelCapacity: 0,
  aerodynamics: 0,
  stability: 0,
  heatTolerance: 0,
  salvageRate: 0,
};

export const baseParts: RocketParts = {
  engine: part({
    reliability: 0.18,
    mass: 18,
    cost: 8,
    thrust: 28,
    burnTime: 0.65,
  }),
  fuelTank: part({
    reliability: 0.22,
    mass: 14,
    cost: 4,
    fuelCapacity: 16,
  }),
  body: part({
    reliability: 0.2,
    mass: 16,
    cost: 3,
    aerodynamics: 0.08,
    heatTolerance: 0.1,
  }),
  noseCone: part({
    reliability: 0,
    mass: 4,
    cost: 0,
    aerodynamics: 0,
    heatTolerance: 0,
  }),
  fins: part({
    reliability: 0,
    mass: 0,
    cost: 0,
    aerodynamics: 0,
    stability: 0,
  }),
  avionics: part({
    reliability: 0,
    mass: 0,
    cost: 0,
    stability: 0,
  }),
  launchMount: part({
    reliability: 0.2,
    mass: 0,
    cost: 3,
    stability: 0.08,
  }),
  recovery: part({
    reliability: 0,
    mass: 0,
    cost: 0,
    salvageRate: 0,
  }),
};

export function createBaseParts(metaUpgrades?: Record<MetaUpgradeId, number>): RocketParts {
  const parts = cloneParts(baseParts);

  if (!metaUpgrades) {
    return parts;
  }

  if (hasMetaUpgrade(metaUpgrades, 'basicStabilizers')) {
    parts.fins = part({
      reliability: 0.28,
      mass: 5,
      cost: 2,
      aerodynamics: 0.12,
      stability: 0.24,
    });
  }

  if (hasMetaUpgrade(metaUpgrades, 'guidanceProgram')) {
    parts.avionics = part({
      reliability: 0.2,
      mass: 3,
      cost: 5,
      stability: 0.18,
    });
  }

  if (hasMetaUpgrade(metaUpgrades, 'advancedAerodynamics')) {
    parts.noseCone = part({
      reliability: 0.32,
      mass: 4,
      cost: 2,
      aerodynamics: 0.26,
      heatTolerance: 0.22,
    });
  }

  if (hasMetaUpgrade(metaUpgrades, 'recoveryProgram') || hasMetaUpgrade(metaUpgrades, 'scrapyardEngineering')) {
    parts.recovery = part({
      reliability: 0.24,
      mass: 4,
      cost: 2,
      salvageRate: hasMetaUpgrade(metaUpgrades, 'recoveryProgram') ? 0.14 : 0.06,
    });
  }

  return parts;
}

export function cloneParts(parts: RocketParts): RocketParts {
  return Object.fromEntries(
    Object.entries(parts).map(([id, stats]) => [id, { ...stats }]),
  ) as RocketParts;
}

export function deriveRocketStats(parts: RocketParts): DerivedRocketStats {
  const mass = sumParts(parts, 'mass');
  const thrust = parts.engine.thrust;
  const burnTime = parts.engine.burnTime * (0.75 + parts.fuelTank.fuelCapacity / 40);
  const fuelCapacity = parts.fuelTank.fuelCapacity;
  const cost = sumParts(parts, 'cost');
  const thrustToWeight = thrust / Math.max(1, mass);
  const aerodynamics = weightedAverage([
    [parts.noseCone.aerodynamics, 0.36],
    [parts.fins.aerodynamics, 0.24],
    [parts.body.aerodynamics, 0.24],
    [parts.fuelTank.reliability, 0.08],
    [parts.recovery.reliability, 0.08],
  ]);
  const stability = weightedAverage([
    [parts.fins.stability, 0.36],
    [parts.avionics.stability, 0.28],
    [parts.launchMount.stability, 0.2],
    [parts.body.reliability, 0.16],
  ]);
  const structuralReliability = weightedAverage([
    [parts.body.reliability, 0.38],
    [parts.fuelTank.reliability, 0.3],
    [parts.noseCone.reliability, 0.18],
    [parts.recovery.reliability, 0.14],
  ]);
  const ignitionReliability = weightedAverage([
    [parts.engine.reliability, 0.5],
    [parts.launchMount.reliability, 0.32],
    [parts.fuelTank.reliability, 0.18],
  ]);
  const flightReliability = weightedAverage([
    [parts.engine.reliability, 0.24],
    [parts.body.reliability, 0.24],
    [parts.fins.reliability, 0.18],
    [parts.avionics.reliability, 0.2],
    [parts.fuelTank.reliability, 0.14],
  ]);
  const heatTolerance = weightedAverage([
    [parts.noseCone.heatTolerance, 0.45],
    [parts.body.heatTolerance, 0.35],
    [parts.fins.reliability, 0.12],
    [parts.avionics.reliability, 0.08],
  ]);
  const salvageRate = clamp(parts.recovery.salvageRate + parts.launchMount.reliability * 0.08, 0, 0.75);

  return {
    thrust,
    burnTime,
    fuelCapacity,
    mass,
    cost,
    thrustToWeight,
    aerodynamics,
    stability,
    structuralReliability,
    ignitionReliability,
    flightReliability,
    heatTolerance,
    salvageRate,
  };
}

export function part(overrides: Partial<PartStats>): PartStats {
  return { ...emptyStats, ...overrides };
}

export function improvePartStat(
  parts: RocketParts,
  partId: RocketPartId,
  stat: keyof PartStats,
  amount: number,
): RocketParts {
  const next = cloneParts(parts);
  const current = next[partId][stat];
  const upperBound = stat === 'reliability' || stat === 'aerodynamics' || stat === 'stability' || stat === 'heatTolerance' || stat === 'salvageRate'
    ? 0.98
    : Number.POSITIVE_INFINITY;
  next[partId][stat] = clamp(current + amount, 0, upperBound);
  return next;
}

function sumParts(parts: RocketParts, stat: keyof PartStats): number {
  return (Object.keys(parts) as RocketPartId[]).reduce((sum, partId) => sum + parts[partId][stat], 0);
}

function weightedAverage(values: Array<[number, number]>): number {
  const totalWeight = values.reduce((sum, [, weight]) => sum + weight, 0);
  return values.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
