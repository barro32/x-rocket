import Phaser from 'phaser';

interface IgnitionEffectConfig {
  thrust: number;
  fuel: number;
}

export class EffectsView {
  constructor(private readonly scene: Phaser.Scene) {}

  ignition(x: number, y: number, config?: IgnitionEffectConfig): void {
    const thrust = config?.thrust ?? 40;
    const fuel = config?.fuel ?? 40;
    const intensity = Math.max(12, Math.round(12 + thrust / 5));
    const spread = 24 + thrust * 0.45;
    const length = 42 + fuel * 0.5;

    for (let i = 0; i < intensity; i += 1) {
      const spark = this.scene.add.rectangle(x, y + 10, 4, 4, 0xffc857, 1);
      this.scene.tweens.add({
        targets: spark,
        x: x + Phaser.Math.Between(-spread, spread),
        y: y + Phaser.Math.Between(28, length),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(280, 480 + fuel * 4),
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  explosion(origin: Phaser.Math.Vector2): void {
    this.scene.cameras.main.shake(300, 0.01);
    for (let i = 0; i < 42; i += 1) {
      const color = i % 3 === 0 ? 0xffc857 : i % 3 === 1 ? 0xf15a24 : 0xf6e7c7;
      const debris = this.scene.add.rectangle(origin.x, origin.y, 5, 5, color, 1);
      this.scene.tweens.add({
        targets: debris,
        x: origin.x + Phaser.Math.Between(-150, 150),
        y: origin.y + Phaser.Math.Between(-95, 125),
        angle: Phaser.Math.Between(-360, 360),
        alpha: 0,
        duration: Phaser.Math.Between(500, 950),
        ease: 'Cubic.easeOut',
        onComplete: () => debris.destroy(),
      });
    }
  }

  floatingText(text: string, x: number, y: number, color = '#ffd166'): void {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '30px',
      color,
      stroke: '#101828',
      strokeThickness: 5,
    });
    label.setOrigin(0.5);
    this.scene.tweens.add({
      targets: label,
      y: y - 54,
      alpha: 0,
      scale: 1.18,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}
