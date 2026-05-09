import Phaser from 'phaser';

interface LaunchVisualProfile {
  thrust: number;
  fuel: number;
  aerodynamics: number;
  lightness: number;
  guidance: number;
  reliability: number;
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
    await tween(this.scene, {
      targets: this.sprite,
      scaleX: 3.02 + profile.thrust / 450,
      scaleY: 2.86 + profile.thrust / 520,
      yoyo: true,
      repeat: 3,
      duration: this.ignitionDuration(profile),
      onUpdate: () => this.syncFlamePosition(),
    });
  }

  async flyTo(altitudeMeters: number, profile: LaunchVisualProfile): Promise<Phaser.Math.Vector2> {
    const visualRise = altitudeToPixels(altitudeMeters);
    const targetY = this.launchPad.y - visualRise;
    const horizontalBias = profile.guidance >= profile.aerodynamics ? 1 : -1;
    const driftMagnitude = (1 - profile.guidance / 99) * 90 + (1 - profile.reliability) * 65;
    const driftX = horizontalBias * driftMagnitude;
    const wobble = (1 - ((profile.guidance / 99) * 0.6 + profile.reliability * 0.4)) * 16;
    const duration = this.flightDuration(altitudeMeters, profile);

    this.startBurn(profile, false);

    await tweenProgress(this.scene, duration, (progress) => {
      const eased = Phaser.Math.Easing.Cubic.Out(progress);
      const driftWave = Math.sin(progress * Math.PI * 2.3) * wobble * (1 - eased * 0.55);
      this.sprite.setPosition(
        this.launchPad.x + driftX * eased + driftWave,
        Phaser.Math.Linear(this.launchPad.y, targetY, eased),
      );
      this.sprite.setAngle(driftWave * 0.9 + driftX * 0.025);
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
    return Phaser.Math.Clamp(
      720 + visualRise * (1.65 - profile.lightness / 180 - profile.aerodynamics / 260) + profile.fuel * 4,
      820,
      2900,
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
    const thrustScale = 0.75 + profile.thrust / 90;
    const fuelScale = 0.7 + profile.fuel / 120;
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
