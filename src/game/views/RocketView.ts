import Phaser from 'phaser';
import type { LaunchOutcome, RocketStatId } from '../../sim/types';

interface LaunchVisualProfile {
  thrust: number;
  fuel: number;
  aerodynamics: number;
  lightness: number;
  guidance: number;
  reliability: number;
  outcome?: LaunchOutcome;
  failedStat?: RocketStatId;
}

export class RocketView {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly outerFlame: Phaser.GameObjects.Triangle;
  private readonly innerFlame: Phaser.GameObjects.Triangle;
  private burnTween?: Phaser.Tweens.Tween;
  private readyAtPad = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hangarDoor: Phaser.Math.Vector2,
    private readonly launchPad: Phaser.Math.Vector2,
  ) {
    this.sprite = this.scene.add.image(hangarDoor.x, hangarDoor.y, 'rocket').setScale(3).setOrigin(0.5, 1);
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
    this.sprite.setTexture('rocket').setScale(3).setAlpha(1).setAngle(-90).setPosition(this.hangarDoor.x, this.hangarDoor.y);
    this.syncFlamePosition();
    this.readyAtPad = false;
  }

  async rolloutToPad(): Promise<void> {
    if (this.readyAtPad) {
      return;
    }

    this.resetToHangar();
    await tween(this.scene, {
      targets: this.sprite,
      x: this.launchPad.x,
      duration: 850,
      ease: 'Sine.easeInOut',
    });
    await tween(this.scene, {
      targets: this.sprite,
      angle: 0,
      duration: 320,
      ease: 'Back.easeOut',
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
      .setScale(3)
      .setAngle(-90)
      .setPosition(this.hangarDoor.x, this.hangarDoor.y)
      .setAlpha(0.2);
    this.syncFlamePosition();
    this.readyAtPad = false;

    await tween(this.scene, {
      targets: this.sprite,
      alpha: 1,
      duration: 180,
      ease: 'Sine.easeOut',
    });

    await tween(this.scene, {
      targets: this.sprite,
      x: this.launchPad.x,
      duration: 850,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.syncFlamePosition(),
    });

    await tween(this.scene, {
      targets: this.sprite,
      angle: 0,
      duration: 320,
      ease: 'Back.easeOut',
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
        this.sprite.setX(this.launchPad.x + Math.sin(progress * Math.PI * 18) * shake);
        this.syncFlamePosition();
      },
    });
    this.sprite.setX(this.launchPad.x);
  }

  async flyTo(altitudeMeters: number, profile: LaunchVisualProfile): Promise<Phaser.Math.Vector2> {
    const visualRise = altitudeToPixels(altitudeMeters);
    if (visualRise <= 0) {
      this.stopBurn();
      this.sprite.setPosition(this.launchPad.x, this.launchPad.y);
      this.sprite.setAngle(0);
      this.syncFlamePosition();
      return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
    }

    const targetY = this.launchPad.y - visualRise;
    const thrust = statRatio(profile.thrust);
    const fuel = statRatio(profile.fuel);
    const aerodynamics = statRatio(profile.aerodynamics);
    const lightness = statRatio(profile.lightness);
    const guidance = statRatio(profile.guidance);
    const stability = guidance * 0.52 + aerodynamics * 0.28 + profile.reliability * 0.2;
    const horizontalBias = profile.guidance >= profile.aerodynamics ? 1 : -1;
    const driftMagnitude = (1 - guidance) * 95 + (1 - aerodynamics) * 58 + lightness * 34 + (1 - profile.reliability) * 42;
    const driftX = horizontalBias * driftMagnitude;
    const wobble = (1 - stability) * 28;
    const buffeting = (1 - aerodynamics) * 22 + (1 - profile.reliability) * 14;
    const poweredEnd = Phaser.Math.Clamp(0.28 + fuel * 0.48 + thrust * 0.12, 0.26, 0.86);
    const duration = this.flightDuration(altitudeMeters, profile);

    this.startBurn(profile, false);

    await tweenProgress(this.scene, duration, (progress) => {
      const eased = ascentProgress(progress, poweredEnd);
      const aeroFlutter = Math.sin(progress * Math.PI * (7 + (1 - aerodynamics) * 8)) * buffeting * Math.sin(progress * Math.PI);
      const guidanceWander = Math.sin(progress * Math.PI * 2.3) * wobble * (1 - eased * 0.48);
      const failurePull = failureDrift(profile.failedStat, progress);
      const driftWave = guidanceWander + aeroFlutter + failurePull;
      this.sprite.setPosition(
        this.launchPad.x + driftX * eased + driftWave,
        Phaser.Math.Linear(this.launchPad.y, targetY, eased),
      );
      this.sprite.setAngle(Phaser.Math.Clamp(driftWave * 0.75 + driftX * 0.026 + failureAngle(profile.failedStat, progress), -48, 48));
      this.updateFlightFlame(profile, progress, poweredEnd);
      this.syncFlamePosition();
    });

    this.stopBurn(220 + profile.fuel * 4);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  ignitionDuration(profile: LaunchVisualProfile): number {
    return Phaser.Math.Clamp(55 + profile.fuel * 2, 70, 250);
  }

  flightDuration(altitudeMeters: number, profile: LaunchVisualProfile): number {
    const visualRise = altitudeToPixels(altitudeMeters);
    const thrust = statRatio(profile.thrust);
    const fuel = statRatio(profile.fuel);
    const aerodynamics = statRatio(profile.aerodynamics);
    const lightness = statRatio(profile.lightness);
    return Phaser.Math.Clamp(
      760 + visualRise * (1.95 - thrust * 0.32 - lightness * 0.28 - aerodynamics * 0.22) + fuel * 260,
      820,
      3200,
    );
  }

  explode(): Phaser.Math.Vector2 {
    this.stopBurn();
    this.readyAtPad = false;
    this.sprite.setTexture('explosion').setScale(4).setAlpha(1);
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
    if (profile.thrust <= 0 || profile.fuel <= 0) {
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
    this.burnTween = this.scene.tweens.add({
      targets: [this.outerFlame, this.innerFlame],
      scaleY: `*=${ignitionPhase ? 1.08 : 1.16}`,
      yoyo: true,
      repeat: -1,
      duration: Phaser.Math.Clamp(70 + (99 - profile.fuel) * 2, 80, 220),
      onUpdate: () => this.syncFlamePosition(),
    });
  }

  private updateFlightFlame(profile: LaunchVisualProfile, progress: number, poweredEnd: number): void {
    if (!this.outerFlame.visible || !this.innerFlame.visible) {
      return;
    }

    if (progress > poweredEnd) {
      const fade = Phaser.Math.Clamp(1 - (progress - poweredEnd) / 0.12, 0, 1);
      this.outerFlame.setAlpha(0.72 * fade);
      this.innerFlame.setAlpha(0.88 * fade);
      this.outerFlame.setScale(this.outerFlame.scaleX, Math.max(0.12, this.outerFlame.scaleY * (0.94 + fade * 0.04)));
      this.innerFlame.setScale(this.innerFlame.scaleX, Math.max(0.1, this.innerFlame.scaleY * (0.94 + fade * 0.04)));
      return;
    }

    const thrust = statRatio(profile.thrust);
    const fuel = statRatio(profile.fuel);
    const reliability = profile.reliability;
    const sputter = 0.72 + reliability * 0.28 + Math.sin(progress * Math.PI * (12 + fuel * 18)) * (0.06 + (1 - reliability) * 0.18);
    const throttle = Phaser.Math.Clamp(0.72 + thrust * 0.55, 0.6, 1.35) * Phaser.Math.Clamp(sputter, 0.35, 1.15);
    const fuelStretch = Phaser.Math.Clamp(0.75 + fuel * 0.7, 0.55, 1.45);

    this.outerFlame.setAlpha(Phaser.Math.Clamp(0.58 + throttle * 0.26, 0.35, 0.95));
    this.innerFlame.setAlpha(Phaser.Math.Clamp(0.72 + reliability * 0.24, 0.5, 0.98));
    this.outerFlame.setScale(0.72 + thrust * 1.35, fuelStretch * throttle);
    this.innerFlame.setScale(0.48 + thrust * 0.88, fuelStretch * throttle * 0.72);
  }

  private stopBurn(fadeDuration = 0): void {
    this.burnTween?.stop();
    this.burnTween = undefined;

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
    this.outerFlame.setPosition(this.sprite.x, this.sprite.y + 10);
    this.innerFlame.setPosition(this.sprite.x, this.sprite.y + 12);
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

function ascentProgress(progress: number, poweredEnd: number): number {
  if (progress <= poweredEnd) {
    const poweredProgress = progress / poweredEnd;
    return 0.66 * Math.pow(poweredProgress, 1.55);
  }

  const coastProgress = (progress - poweredEnd) / Math.max(0.01, 1 - poweredEnd);
  return 0.66 + 0.34 * Phaser.Math.Easing.Quadratic.Out(coastProgress);
}

function failureDrift(statId: RocketStatId | undefined, progress: number): number {
  if (!statId) {
    return 0;
  }

  const failureRamp = Phaser.Math.Easing.Cubic.In(Phaser.Math.Clamp(progress, 0, 1));
  switch (statId) {
    case 'guidance':
      return Math.sin(progress * Math.PI * 5.5) * 90 * failureRamp;
    case 'aerodynamics':
      return Math.sin(progress * Math.PI * 12) * 42 * Math.sin(progress * Math.PI);
    case 'lightness':
      return Math.sin(progress * Math.PI * 8) * 28 * failureRamp;
    case 'fuel':
      return Math.sin(progress * Math.PI * 3) * 18 * failureRamp;
    case 'thrust':
    case 'reliability':
      return Math.sin(progress * Math.PI * 18) * 14 * (1 - progress);
  }
}

function failureAngle(statId: RocketStatId | undefined, progress: number): number {
  if (!statId) {
    return 0;
  }

  const ramp = Phaser.Math.Easing.Cubic.In(Phaser.Math.Clamp(progress, 0, 1));
  switch (statId) {
    case 'guidance':
      return 30 * ramp;
    case 'aerodynamics':
      return Math.sin(progress * Math.PI * 10) * 22 * Math.sin(progress * Math.PI);
    case 'lightness':
      return -20 * ramp;
    case 'fuel':
      return 8 * ramp;
    case 'thrust':
    case 'reliability':
      return Math.sin(progress * Math.PI * 20) * 7 * (1 - progress);
  }
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
