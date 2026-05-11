import Phaser from 'phaser';
import type { LaunchOutcome, LaunchPhysics, LaunchTrajectoryPoint } from '../../sim/types';

interface LaunchVisualProfile {
  thrust: number;
  fuel: number;
  aerodynamics: number;
  lightness: number;
  guidance: number;
  reliability: number;
  outcome?: LaunchOutcome;
  physics?: LaunchPhysics;
}

const ROCKET_ORIGIN_Y = 0.66;

export class RocketView {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly outerFlame: Phaser.GameObjects.Triangle;
  private readonly innerFlame: Phaser.GameObjects.Triangle;
  private readyAtPad = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hangarDoor: Phaser.Math.Vector2,
    private readonly launchPad: Phaser.Math.Vector2,
  ) {
    this.sprite = this.scene.add.image(hangarDoor.x, hangarDoor.y, 'rocket').setScale(3).setOrigin(0.5, ROCKET_ORIGIN_Y);
    this.outerFlame = this.scene.add.triangle(hangarDoor.x, hangarDoor.y + 18, 0, 0, 22, 58, 44, 0, 0xf15a24, 0.92);
    this.innerFlame = this.scene.add.triangle(hangarDoor.x, hangarDoor.y + 12, 0, 0, 12, 36, 24, 0, 0xffd166, 0.96);
    this.outerFlame.setDepth(this.sprite.depth - 1);
    this.innerFlame.setDepth(this.sprite.depth - 1);
    this.outerFlame.setOrigin(0.5, 0);
    this.innerFlame.setOrigin(0.5, 0);
    this.outerFlame.setVisible(false);
    this.innerFlame.setVisible(false);
  }

  resetToHangar(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.stopBurn();
    this.sprite.setTexture('rocket').setOrigin(0.5, ROCKET_ORIGIN_Y).setScale(3).setAlpha(1).setAngle(-90);
    this.setRocketBasePosition(this.hangarDoor.x, this.hangarDoor.y);
    this.syncFlamePosition();
    this.readyAtPad = false;
  }

  async rolloutToPad(): Promise<void> {
    if (this.readyAtPad) {
      return;
    }

    this.resetToHangar();
    await tweenProgress(this.scene, 850, (progress) => {
      const eased = Phaser.Math.Easing.Sine.InOut(progress);
      this.setRocketBasePosition(
        Phaser.Math.Linear(this.hangarDoor.x, this.launchPad.x, eased),
        Phaser.Math.Linear(this.hangarDoor.y, this.launchPad.y, eased),
      );
      this.syncFlamePosition();
    });
    await tween(this.scene, {
      targets: this.sprite,
      angle: 0,
      duration: 320,
      ease: 'Back.easeOut',
      onUpdate: () => {
        this.setRocketBasePosition(this.launchPad.x, this.launchPad.y);
        this.syncFlamePosition();
      },
    });
    this.readyAtPad = true;
  }

  async recycleToPad(): Promise<void> {
    this.scene.tweens.killTweensOf(this.sprite);
    this.stopBurn(140);

    await tween(this.scene, {
      targets: this.sprite,
      alpha: 0,
      duration: 260,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.syncFlamePosition(),
    });

    this.sprite
      .setTexture('rocket')
      .setOrigin(0.5, ROCKET_ORIGIN_Y)
      .setScale(3)
      .setAngle(-90)
      .setAlpha(0.2);
    this.setRocketBasePosition(this.hangarDoor.x, this.hangarDoor.y);
    this.syncFlamePosition();
    this.readyAtPad = false;

    await tween(this.scene, {
      targets: this.sprite,
      alpha: 1,
      duration: 180,
      ease: 'Sine.easeOut',
    });

    await tweenProgress(this.scene, 850, (progress) => {
      const eased = Phaser.Math.Easing.Sine.InOut(progress);
      this.setRocketBasePosition(
        Phaser.Math.Linear(this.hangarDoor.x, this.launchPad.x, eased),
        Phaser.Math.Linear(this.hangarDoor.y, this.launchPad.y, eased),
      );
      this.syncFlamePosition();
    });

    await tween(this.scene, {
      targets: this.sprite,
      angle: 0,
      duration: 320,
      ease: 'Back.easeOut',
      onUpdate: () => {
        this.setRocketBasePosition(this.launchPad.x, this.launchPad.y);
        this.syncFlamePosition();
      },
    });

    this.readyAtPad = true;
  }

  async ignite(profile: LaunchVisualProfile): Promise<void> {
    this.startBurn(profile, true);
    const shake = (1 - profile.reliability) * 1.8 + (1 - statRatio(profile.thrust)) * 1.2;
    await tween(this.scene, {
      targets: this.sprite,
      scaleX: 3.02 + profile.thrust / 450,
      scaleY: 2.86 + profile.thrust / 520,
      yoyo: true,
      repeat: 3,
      duration: this.ignitionDuration(profile),
      onUpdate: (tween) => {
        const progress = tween.progress;
        this.setRocketBasePosition(this.launchPad.x + Math.sin(progress * Math.PI * 18) * shake, this.launchPad.y);
        this.syncFlamePosition();
      },
    });
    this.setRocketBasePosition(this.launchPad.x, this.launchPad.y);
  }

  async flyTo(altitudeMeters: number, profile: LaunchVisualProfile): Promise<Phaser.Math.Vector2> {
    const trajectory = profile.physics?.trajectory ?? [];
    if (!profile.physics || trajectory.length < 2 || altitudeMeters <= 0) {
      this.stopBurn();
      this.sprite.setAngle(0);
      this.setRocketBasePosition(this.launchPad.x, this.launchPad.y);
      this.syncFlamePosition();
      return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
    }

    const physics = profile.physics;
    const duration = this.flightDuration(altitudeMeters, profile);

    this.startBurn(profile, false);

    await tweenProgress(this.scene, duration, (progress) => {
      const elapsedSeconds = progress * physics.totalTimeSeconds;
      const sample = sampleTrajectory(trajectory, elapsedSeconds);
      this.sprite.setAngle(Phaser.Math.Clamp(sample.angleDegrees, -160, 160));
      this.setRocketBasePosition(this.launchPad.x + horizontalMetersToPixels(sample.xMeters), this.launchPad.y - altitudeToPixels(sample.yMeters));
      this.updateFlightFlame(profile, elapsedSeconds, physics.burnTimeSeconds);
      this.syncFlamePosition();
    });

    this.stopBurn(220 + profile.fuel * 4);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  ignitionDuration(profile: LaunchVisualProfile): number {
    const thrust = statRatio(profile.thrust);
    const fuel = statRatio(profile.fuel);
    return Phaser.Math.Clamp(320 + (1 - thrust) * 260 + (1 - fuel) * 120, 320, 740);
  }

  flightDuration(altitudeMeters: number, profile: LaunchVisualProfile): number {
    const totalSeconds = profile.physics?.totalTimeSeconds ?? 1;
    const visualRise = altitudeToPixels(altitudeMeters);
    return Phaser.Math.Clamp(900 + Math.log10(totalSeconds + 1) * 1250 + visualRise * 0.36, 1000, profile.outcome === 'orbit' ? 5200 : 7200);
  }

  explode(): Phaser.Math.Vector2 {
    this.stopBurn();
    this.readyAtPad = false;
    this.sprite.setTexture('explosion').setOrigin(0.5, 0.5).setScale(4).setAlpha(1);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  fadeAway(): void {
    this.stopBurn(180);
    this.readyAtPad = false;
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.18,
      duration: 450,
      ease: 'Sine.easeOut',
    });
  }

  private startBurn(profile: LaunchVisualProfile, ignitionPhase: boolean): void {
    this.stopBurn();
    if (profile.thrust <= 0) {
      return;
    }

    const thrustScale = 0.55 + statRatio(profile.thrust) * 1.45;
    const fuelScale = 0.55 + statRatio(profile.fuel) * 1.1;
    this.outerFlame.setVisible(true);
    this.innerFlame.setVisible(true);
    this.outerFlame.setAlpha(0.92);
    this.innerFlame.setAlpha(0.96);
    this.outerFlame.setScale(thrustScale, fuelScale * (ignitionPhase ? 0.9 : 1.15));
    this.innerFlame.setScale(thrustScale * 0.68, fuelScale * (ignitionPhase ? 0.72 : 0.92));
    this.syncFlamePosition();
  }

  private updateFlightFlame(profile: LaunchVisualProfile, elapsedSeconds: number, burnSeconds: number): void {
    if (!this.outerFlame.visible || !this.innerFlame.visible) {
      return;
    }

    if (elapsedSeconds > burnSeconds) {
      const fade = Phaser.Math.Clamp(1 - (elapsedSeconds - burnSeconds) / 0.18, 0, 1);
      const thrust = statRatio(profile.thrust);
      const fuel = statRatio(profile.fuel);
      const fuelStretch = Phaser.Math.Clamp(0.7 + fuel * 0.72, 0.52, 1.42);
      this.outerFlame.setAlpha(0.72 * fade);
      this.innerFlame.setAlpha(0.88 * fade);
      this.outerFlame.setScale(0.72 + thrust * 1.35, Math.max(0.12, fuelStretch * fade));
      this.innerFlame.setScale(0.48 + thrust * 0.88, Math.max(0.1, fuelStretch * fade * 0.7));
      return;
    }

    const thrust = statRatio(profile.thrust);
    const fuel = statRatio(profile.fuel);
    const throttle = Phaser.Math.Clamp(0.78 + thrust * 0.48, 0.6, 1.28);
    const fuelStretch = Phaser.Math.Clamp(0.7 + fuel * 0.72, 0.52, 1.42);

    this.outerFlame.setAlpha(Phaser.Math.Clamp(0.62 + thrust * 0.28, 0.38, 0.94));
    this.innerFlame.setAlpha(0.9);
    this.outerFlame.setScale(0.72 + thrust * 1.35, fuelStretch * throttle);
    this.innerFlame.setScale(0.48 + thrust * 0.88, fuelStretch * throttle * 0.7);
  }

  private stopBurn(fadeDuration = 0): void {
    if (!this.outerFlame.visible && !this.innerFlame.visible) {
      return;
    }

    if (fadeDuration <= 0) {
      this.outerFlame.setVisible(false);
      this.innerFlame.setVisible(false);
      return;
    }

    this.scene.tweens.add({
      targets: [this.outerFlame, this.innerFlame],
      alpha: 0,
      scaleY: '*=0.72',
      duration: fadeDuration,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.outerFlame.setVisible(false).setAlpha(0.92);
        this.innerFlame.setVisible(false).setAlpha(0.96);
      },
    });
  }

  private syncFlamePosition(): void {
    const base = this.rocketBasePosition();
    const radians = Phaser.Math.DegToRad(this.sprite.angle);
    const downwardX = -Math.sin(radians);
    const downwardY = Math.cos(radians);
    this.outerFlame.setPosition(base.x + downwardX * 10, base.y + downwardY * 10).setAngle(this.sprite.angle);
    this.innerFlame.setPosition(base.x + downwardX * 12, base.y + downwardY * 12).setAngle(this.sprite.angle);
  }

  private setRocketBasePosition(baseX: number, baseY: number): void {
    const offset = this.rotatedBaseOffset();
    this.sprite.setPosition(baseX - offset.x, baseY - offset.y);
  }

  private rocketBasePosition(): Phaser.Math.Vector2 {
    const offset = this.rotatedBaseOffset();
    return new Phaser.Math.Vector2(this.sprite.x + offset.x, this.sprite.y + offset.y);
  }

  private rotatedBaseOffset(): Phaser.Math.Vector2 {
    const radians = Phaser.Math.DegToRad(this.sprite.angle);
    const localY = (1 - this.sprite.originY) * this.sprite.height * this.sprite.scaleY;
    return new Phaser.Math.Vector2(-Math.sin(radians) * localY, Math.cos(radians) * localY);
  }
}

function altitudeToPixels(altitudeMeters: number): number {
  if (altitudeMeters <= 100) {
    return altitudeMeters * 0.45;
  }

  return 45 + Math.log10(altitudeMeters / 100 + 1) * 520;
}

function statRatio(value: number): number {
  return Phaser.Math.Clamp(value / 99, 0, 1);
}

function horizontalMetersToPixels(meters: number): number {
  const sign = Math.sign(meters);
  const absMeters = Math.abs(meters);
  if (absMeters <= 100) {
    return meters * 0.35;
  }

  return sign * (35 + Math.log10(absMeters / 100 + 1) * 260);
}

function sampleTrajectory(trajectory: LaunchTrajectoryPoint[], elapsedSeconds: number): LaunchTrajectoryPoint {
  const first = trajectory[0];
  const last = trajectory[trajectory.length - 1];
  if (elapsedSeconds <= first.timeSeconds) {
    return first;
  }
  if (elapsedSeconds >= last.timeSeconds) {
    return last;
  }

  const nextIndex = trajectory.findIndex((point) => point.timeSeconds >= elapsedSeconds);
  const next = trajectory[Math.max(1, nextIndex)];
  const previous = trajectory[nextIndex - 1];
  const segmentProgress = (elapsedSeconds - previous.timeSeconds) / Math.max(0.001, next.timeSeconds - previous.timeSeconds);

  return {
    timeSeconds: elapsedSeconds,
    xMeters: Phaser.Math.Linear(previous.xMeters, next.xMeters, segmentProgress),
    yMeters: Phaser.Math.Linear(previous.yMeters, next.yMeters, segmentProgress),
    velocityX: Phaser.Math.Linear(previous.velocityX, next.velocityX, segmentProgress),
    velocityY: Phaser.Math.Linear(previous.velocityY, next.velocityY, segmentProgress),
    angleDegrees: normalizeDegrees(previous.angleDegrees + normalizeDegrees(next.angleDegrees - previous.angleDegrees) * segmentProgress),
    powered: previous.powered || next.powered,
  };
}

function normalizeDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({
      ...config,
      onComplete: () => resolve(),
    });
  });
}

function tweenProgress(
  scene: Phaser.Scene,
  duration: number,
  onUpdate: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Linear',
      onUpdate: (tween) => onUpdate(tween.getValue() ?? 0),
      onComplete: () => resolve(),
    });
  });
}
