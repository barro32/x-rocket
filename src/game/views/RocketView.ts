import Phaser from 'phaser';

export class RocketView {
  readonly sprite: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hangarDoor: Phaser.Math.Vector2,
    private readonly launchPad: Phaser.Math.Vector2,
  ) {
    this.sprite = this.scene.add.image(hangarDoor.x, hangarDoor.y, 'rocket').setScale(3).setOrigin(0.5, 1);
  }

  resetToHangar(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setTexture('rocket').setScale(3).setAlpha(1).setAngle(-90).setPosition(this.hangarDoor.x, this.hangarDoor.y);
  }

  async rolloutToPad(): Promise<void> {
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
  }

  async ignite(): Promise<void> {
    await tween(this.scene, {
      targets: this.sprite,
      scaleX: 3.12,
      scaleY: 2.92,
      yoyo: true,
      repeat: 3,
      duration: 70,
    });
  }

  async flyTo(altitudeMeters: number): Promise<Phaser.Math.Vector2> {
    const visualRise = altitudeToPixels(altitudeMeters);
    const targetY = this.launchPad.y - visualRise;
    await tween(this.scene, {
      targets: this.sprite,
      y: targetY,
      duration: Phaser.Math.Clamp(620 + visualRise * 1.4, 760, 2400),
      ease: 'Cubic.easeOut',
    });
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  explode(): Phaser.Math.Vector2 {
    this.sprite.setTexture('explosion').setScale(4).setAlpha(1);
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  fadeAway(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.18,
      duration: 450,
      ease: 'Sine.easeOut',
    });
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
