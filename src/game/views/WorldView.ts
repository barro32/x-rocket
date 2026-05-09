import Phaser from 'phaser';
import { companyName } from '../../sim/name';

export class WorldView {
  readonly hangarDoor = new Phaser.Math.Vector2(270, 526);
  readonly launchPad = new Phaser.Math.Vector2(680, 526);

  private signText: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.draw();
    this.signText = this.scene.add.text(152, 366, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#1b1717',
      backgroundColor: '#f4c95d',
      padding: { x: 12, y: 5 },
    });
  }

  setCompany(index: number): void {
    this.signText.setText(companyName(index));
  }

  private draw(): void {
    const graphics = this.scene.add.graphics();

    graphics.fillGradientStyle(0x0b1024, 0x0b1024, 0x273f61, 0x273f61, 1);
    graphics.fillRect(0, -3200, 1280, 3920);

    for (let i = 0; i < 360; i += 1) {
      const x = (i * 83) % 1270;
      const y = -3150 + ((i * 47) % 3460);
      graphics.fillStyle(0xf6e7c7, 0.25 + ((i % 5) * 0.1));
      graphics.fillRect(x, y, i % 11 === 0 ? 3 : 2, 2);
    }

    graphics.fillStyle(0x3e2d22);
    graphics.fillRect(0, 545, 1280, 175);
    graphics.fillStyle(0x211a17);
    graphics.fillRect(0, 605, 1280, 115);

    this.drawHangar(graphics);
    this.drawLaunchPad(graphics);
    this.drawTrack(graphics);
  }

  private drawHangar(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x56616d);
    graphics.fillRect(95, 408, 355, 142);
    graphics.fillStyle(0x3c4652);
    graphics.fillTriangle(70, 408, 272, 318, 475, 408);
    graphics.fillStyle(0x252b33);
    graphics.fillRect(160, 452, 210, 98);

    graphics.lineStyle(4, 0x7f8a96, 0.8);
    for (let x = 112; x < 438; x += 32) {
      graphics.lineBetween(x, 414, x, 550);
    }
    for (let y = 430; y < 548; y += 24) {
      graphics.lineBetween(105, y, 445, y);
    }

    graphics.fillStyle(0xf4c95d);
    graphics.fillRect(145, 362, 255, 46);
  }

  private drawLaunchPad(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(6, 0xd4b26a);
    graphics.lineBetween(680, 350, 680, 550);
    graphics.lineBetween(635, 550, 725, 550);
    graphics.lineStyle(3, 0x8f7650);
    graphics.lineBetween(650, 390, 710, 430);
    graphics.lineBetween(710, 390, 650, 430);
    graphics.fillStyle(0x3b3b3b);
    graphics.fillRect(612, 548, 136, 16);
  }

  private drawTrack(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(3, 0x171717, 0.85);
    graphics.lineBetween(225, 550, 700, 550);
    graphics.lineBetween(225, 560, 700, 560);
    for (let x = 232; x < 695; x += 26) {
      graphics.lineBetween(x, 548, x + 10, 562);
    }
  }
}
