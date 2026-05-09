import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.createPixelTextures();
    this.scene.start('GameScene');
  }

  private createPixelTextures(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0xf6e7c7);
    graphics.fillRect(14, 0, 4, 6);
    graphics.fillStyle(0xc94438);
    graphics.fillRect(10, 6, 12, 28);
    graphics.fillStyle(0xf6e7c7);
    graphics.fillRect(12, 10, 8, 16);
    graphics.fillStyle(0x2f4f4f);
    graphics.fillTriangle(10, 28, 4, 38, 10, 34);
    graphics.fillTriangle(22, 28, 28, 38, 22, 34);
    graphics.generateTexture('rocket', 32, 44);
    graphics.clear();

    graphics.fillStyle(0xffc857);
    graphics.fillCircle(16, 16, 10);
    graphics.fillStyle(0xf15a24);
    graphics.fillCircle(16, 16, 6);
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(12, 11, 3);
    graphics.generateTexture('explosion', 32, 32);
    graphics.clear();

    graphics.destroy();
  }
}
