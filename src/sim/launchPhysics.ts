import type { LaunchPhysics, LaunchRocketStats, LaunchTrajectoryPoint } from './types';

export const maxLaunchAltitudeMeters = 500_000;

const gravityMetersPerSecondSquared = 9.81;
const simulationStepSeconds = 0.05;
const sampleStepSeconds = 0.2;
const maxSimulationSeconds = 900;

export function simulateLaunchPhysics(
  stats: LaunchRocketStats,
  reliability: number,
  burnScale = 1,
): LaunchPhysics {
  const thrustRatio = statRatio(stats.thrust);
  const fuelRatio = statRatio(stats.fuel);
  const aeroRatio = statRatio(stats.aerodynamics);
  const lightnessRatio = statRatio(stats.lightness);
  const guidanceRatio = statRatio(stats.guidance);

  const massKg = lerp(120_000, 28_000, lightnessRatio);
  const massFactor = massKg / 70_000;
  const thrustAcceleration = thrustRatio <= 0 ? 0 : (40 + thrustRatio * 260) / massFactor;
  const burnTimeSeconds = thrustRatio <= 0 ? 0 : (1.1 + fuelRatio * 17.8) * clamp(burnScale, 0, 1);
  const launchAngleDegrees = (1 - guidanceRatio) * 35;
  const launchAngleRadians = degreesToRadians(launchAngleDegrees);
  const thrustX = Math.sin(launchAngleRadians);
  const thrustY = Math.cos(launchAngleRadians);
  const aeroDragCoefficient = lerp(0.000026, 0.000002, aeroRatio) / massFactor;
  const poweredAeroPenaltyRatio = (1 - aeroRatio) * 0.22;

  let timeSeconds = 0;
  let xMeters = 0;
  let yMeters = 0;
  let velocityX = 0;
  let velocityY = 0;
  let maxAltitudeMeters = 0;
  let peakVelocityMetersPerSecond = 0;
  let impactVelocityMetersPerSecond = 0;
  let nextSampleSeconds = 0;
  const trajectory: LaunchTrajectoryPoint[] = [];

  const pushSample = (powered: boolean): void => {
    const speed = Math.hypot(velocityX, velocityY);
    trajectory.push({
      timeSeconds,
      xMeters,
      yMeters: Math.max(0, yMeters),
      velocityX,
      velocityY,
      angleDegrees: speed > 0.01 ? radiansToDegrees(Math.atan2(velocityX, velocityY)) : launchAngleDegrees,
      powered,
    });
  };

  pushSample(false);

  while (timeSeconds < maxSimulationSeconds) {
    const powered = timeSeconds < burnTimeSeconds;
    const speed = Math.hypot(velocityX, velocityY);
    peakVelocityMetersPerSecond = Math.max(peakVelocityMetersPerSecond, speed);

    let accelerationX = 0;
    let accelerationY = -gravityMetersPerSecondSquared;

    if (powered) {
      const effectiveThrustAcceleration = thrustAcceleration * (1 - poweredAeroPenaltyRatio);
      accelerationX += effectiveThrustAcceleration * thrustX;
      accelerationY += effectiveThrustAcceleration * thrustY;
    }

    if (speed > 0.01) {
      const dragAcceleration = aeroDragCoefficient * speed * speed;
      accelerationX -= (velocityX / speed) * dragAcceleration;
      accelerationY -= (velocityY / speed) * dragAcceleration;
    }

    velocityX += accelerationX * simulationStepSeconds;
    velocityY += accelerationY * simulationStepSeconds;
    xMeters += velocityX * simulationStepSeconds;
    yMeters += velocityY * simulationStepSeconds;
    timeSeconds += simulationStepSeconds;
    maxAltitudeMeters = Math.max(maxAltitudeMeters, yMeters);

    if (timeSeconds >= nextSampleSeconds) {
      pushSample(powered);
      nextSampleSeconds += sampleStepSeconds;
    }

    if (maxAltitudeMeters >= maxLaunchAltitudeMeters) {
      yMeters = maxLaunchAltitudeMeters;
      maxAltitudeMeters = maxLaunchAltitudeMeters;
      pushSample(powered);
      break;
    }

    if (yMeters <= 0 && timeSeconds > 0.2 && velocityY <= 0) {
      yMeters = 0;
      impactVelocityMetersPerSecond = Math.hypot(velocityX, velocityY);
      pushSample(false);
      break;
    }
  }

  const last = trajectory[trajectory.length - 1];
  const totalTimeSeconds = last?.timeSeconds ?? timeSeconds;
  const orbitProgress = clamp(maxAltitudeMeters / maxLaunchAltitudeMeters, 0, 1);

  return {
    orbitProgress,
    maxAltitudeMeters: Math.floor(maxAltitudeMeters),
    downrangeMeters: Math.round(Math.abs(xMeters)),
    burnTimeSeconds,
    totalTimeSeconds,
    launchAngleDegrees,
    massKg,
    thrustAccelerationMetersPerSecondSquared: thrustAcceleration,
    peakVelocityMetersPerSecond,
    impactVelocityMetersPerSecond,
    trajectory,
  };
}

function statRatio(value: number): number {
  return clamp(value / 99, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function radiansToDegrees(value: number): number {
  return value * 180 / Math.PI;
}
