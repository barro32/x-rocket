import Phaser from 'phaser';

export class EffectsView {
  constructor(private readonly scene: Phaser.Scene) {}

  ignition(x: number, y: number): void {
    for (let i = 0; i < 18; i += 1) {
      const spark = this.scene.add.rectangle(x, y + 10, 4, 4, 0xffc857, 1);
      this.scene.tweens.add({
        targets: spark,
        x: x + Phaser.Math.Between(-35, 35),
        y: y + Phaser.Math.Between(28, 72),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(280, 520),
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
