import Phaser from 'phaser';
import type { DiceCategory, LaunchResult } from '../sim/types';
import { categoryLabels } from '../sim/categories';

export class RocketView {
  private rocket!: Phaser.GameObjects.Container;
  private flame!: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene) {}

  createWorld(): void {
    this.scene.add.rectangle(640, 680, 1280, 90, 0x25334f);
    this.scene.add.rectangle(640, 638, 180, 16, 0x576981);
    this.scene.add.rectangle(640, 610, 84, 44, 0x2f3c53);
    this.scene.add.text(34, 42, 'X ROCKET', {
      color: '#e8f3ff',
      fontFamily: 'monospace',
      fontSize: '34px',
      fontStyle: 'bold',
    });

    for (let i = 0; i <= 10; i += 1) {
      const y = 610 - i * 54;
      const meters = i * 10;
      this.scene.add.rectangle(90, y, i % 5 === 0 ? 42 : 24, 2, 0x7c8fab);
      this.scene.add.text(114, y - 9, `${meters}m`, {
        color: '#8fa6c4',
        fontFamily: 'monospace',
        fontSize: '14px',
      });
    }

    const body = this.scene.add.rectangle(0, -28, 30, 58, 0xdfe7f0);
    const nose = this.scene.add.triangle(0, -70, -18, -28, 18, -28, 0, -74, 0xef6b5a);
    const finLeft = this.scene.add.triangle(-15, 0, -15, 18, -38, 28, -15, 42, 0x5fb3b3);
    const finRight = this.scene.add.triangle(15, 0, 15, 18, 38, 28, 15, 42, 0x5fb3b3);
    this.flame = this.scene.add.rectangle(0, 20, 16, 28, 0xffc857).setVisible(false);
    this.rocket = this.scene.add.container(640, 610, [this.flame, finLeft, finRight, body, nose]);
  }

  async animateLaunch(result?: LaunchResult): Promise<void> {
    if (!result) {
      return;
    }

    this.rocket.setPosition(640, 610);
    this.rocket.setRotation(0);
    this.rocket.setAlpha(1);
    this.flame.setVisible(true);

    const categoryScores = Object.fromEntries(Object.keys(categoryLabels).map((category) => [category, 0])) as Record<DiceCategory, number>;
    for (const roll of result.roll.rolls) {
      categoryScores[roll.category] += roll.value;
    }

    const travel = Math.min(520, result.heightMeters * 9);
    const drift = (3 - categoryScores.guidance) * 18;
    const duration = Math.max(520, 1350 - categoryScores.thrusters * 80 + categoryScores.fuel * 35);
    const angle = Phaser.Math.Clamp(drift / 360, -0.18, 0.18);

    await this.tween({
      targets: this.rocket,
      y: 610 - travel,
      x: 640 + drift,
      rotation: angle,
      duration,
      ease: 'Quad.easeOut',
    });

    this.flame.setVisible(false);

    if (result.roll.exploded) {
      this.addExplosion(this.rocket.x, this.rocket.y);
      await this.tween({
        targets: this.rocket,
        alpha: 0,
        duration: 180,
      });
    }

    await this.tween({
      targets: this.rocket,
      x: 640,
      y: 610,
      rotation: 0,
      alpha: 1,
      delay: 320,
      duration: 300,
      ease: 'Sine.easeInOut',
    });
  }

  private addExplosion(x: number, y: number): void {
    const flash = this.scene.add.circle(x, y, 12, 0xff5f49, 0.9);
    this.scene.tweens.add({
      targets: flash,
      scale: 5,
      alpha: 0,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        ...config,
        onComplete: () => resolve(),
      });
    });
  }
}
