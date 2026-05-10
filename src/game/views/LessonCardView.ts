import Phaser from 'phaser';
import type { LessonId, LessonSpec } from '../../sim/types';

interface LessonCardConfig {
  spec: LessonSpec;
  origin: Phaser.Math.Vector2;
  target: Phaser.Math.Vector2;
  index: number;
  onSelect: () => void;
}

export class LessonCardView {
  readonly container: Phaser.GameObjects.Container;

  private readonly panel: Phaser.GameObjects.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: LessonCardConfig,
  ) {
    this.container = scene.add.container(config.origin.x, config.origin.y);
    this.container.setDepth(20);
    this.container.setScrollFactor(0);

    const shadow = scene.add.rectangle(8, 10, 270, 220, 0x050711, 0.55);
    this.panel = scene.add.rectangle(0, 0, 270, 220, 0xf6e7c7, 1);
    this.panel.setStrokeStyle(5, 0xf4c95d, 1);

    const artBackground = scene.add.rectangle(0, -68, 238, 66, 0x293241, 1);
    artBackground.setStrokeStyle(2, 0x101828, 0.55);
    const art = this.createCardArt(config.spec.id, 0, -68);

    const title = scene.add.text(-110, -101, config.spec.name, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#101828',
      wordWrap: { width: 220 },
    });
    title.setResolution(2);

    const description = scene.add.text(-110, -27, config.spec.description, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#293241',
      wordWrap: { width: 220 },
      lineSpacing: 2,
    });
    description.setResolution(2);

    const effectBackground = scene.add.rectangle(0, 78, 238, 44, 0xfff4d6, 1);
    effectBackground.setStrokeStyle(2, 0xf4c95d, 0.9);
    const effect = scene.add.text(-110, 61, config.spec.effect, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#9b3d2e',
      wordWrap: { width: 220 },
      lineSpacing: 1,
    });
    effect.setResolution(2);

    this.container.add([shadow, this.panel, artBackground, art, title, description, effectBackground, effect]);
    this.container.setScale(0.2);
    this.container.setAlpha(0);
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(-135, -110, 270, 220),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.on('pointerover', () => this.hover(true));
    this.container.on('pointerout', () => this.hover(false));
    this.container.on('pointerdown', config.onSelect);
  }

  enter(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        x: this.config.target.x,
        y: this.config.target.y,
        alpha: 1,
        scale: 1,
        angle: 0,
        delay: this.config.index * 90,
        duration: 560,
        ease: 'Back.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  selectAndDestroy(): Promise<void> {
    this.container.disableInteractive();
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        y: this.container.y - 35,
        scale: 1.16,
        alpha: 0,
        duration: 260,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.container.destroy();
          resolve();
        },
      });
    });
  }

  rejectAndDestroy(direction: number): Promise<void> {
    this.container.disableInteractive();
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        x: this.container.x + direction * 260,
        y: this.container.y + 80,
        angle: direction * 18,
        alpha: 0,
        duration: 320,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.container.destroy();
          resolve();
        },
      });
    });
  }

  private hover(active: boolean): void {
    this.scene.tweens.add({
      targets: this.container,
      scale: active ? 1.06 : 1,
      duration: 120,
      ease: 'Sine.easeOut',
    });
    this.panel.setStrokeStyle(5, active ? 0xff6b35 : 0xf4c95d, 1);
  }

  private createCardArt(id: LessonId, x: number, y: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    const palette = cardPalette(id);

    graphics.fillStyle(palette.background, 1);
    graphics.fillRoundedRect(x - 119, y - 33, 238, 66, 8);
    graphics.lineStyle(2, palette.accent, 0.9);
    graphics.strokeRoundedRect(x - 118, y - 32, 236, 64, 8);

    graphics.fillStyle(0xf6e7c7, 0.16);
    graphics.fillCircle(x + 82, y - 18, 28);
    graphics.fillCircle(x - 86, y + 22, 20);

    switch (id) {
      case 'tuneEngineMix':
        graphics.fillStyle(palette.accent, 1);
        graphics.fillTriangle(x - 18, y + 22, x, y - 22, x + 18, y + 22);
        graphics.fillStyle(0xffd166, 1);
        graphics.fillTriangle(x - 8, y + 25, x, y + 43, x + 8, y + 25);
        graphics.lineStyle(4, 0xf6e7c7, 0.9);
        graphics.lineBetween(x - 28, y + 4, x - 52, y + 18);
        graphics.lineBetween(x + 28, y + 4, x + 52, y + 18);
        break;
      case 'improveFuelFlow':
        graphics.lineStyle(8, palette.accent, 1);
        graphics.beginPath();
        graphics.moveTo(x - 62, y + 16);
        graphics.lineTo(x - 20, y - 10);
        graphics.lineTo(x + 24, y + 8);
        graphics.lineTo(x + 62, y - 18);
        graphics.strokePath();
        graphics.fillStyle(0x8ef6c5, 1);
        graphics.fillCircle(x + 62, y - 18, 8);
        break;
      case 'salvageUsefulParts':
        graphics.fillStyle(palette.accent, 1);
        graphics.fillRect(x - 58, y + 4, 116, 15);
        graphics.fillRect(x - 42, y - 13, 84, 17);
        graphics.fillStyle(0xf6e7c7, 1);
        graphics.fillCircle(x - 34, y + 27, 9);
        graphics.fillCircle(x + 34, y + 27, 9);
        break;
      case 'stabilizeFins':
        graphics.fillStyle(palette.accent, 1);
        graphics.fillTriangle(x - 11, y - 24, x + 11, y - 24, x, y + 23);
        graphics.fillTriangle(x - 11, y + 5, x - 45, y + 29, x - 9, y + 22);
        graphics.fillTriangle(x + 11, y + 5, x + 45, y + 29, x + 9, y + 22);
        break;
      case 'fairNoseCone':
        graphics.fillStyle(palette.accent, 1);
        graphics.fillTriangle(x - 68, y + 10, x - 18, y - 22, x + 72, y + 10);
        graphics.fillStyle(0xf6e7c7, 0.86);
        graphics.fillEllipse(x + 10, y + 11, 118, 22);
        break;
      case 'cutDeadWeight':
        graphics.fillStyle(palette.accent, 1);
        graphics.fillRect(x - 38, y - 22, 76, 42);
        graphics.fillStyle(0x293241, 1);
        graphics.fillCircle(x - 14, y - 2, 10);
        graphics.fillCircle(x + 18, y + 6, 13);
        graphics.lineStyle(4, 0xff6b35, 1);
        graphics.lineBetween(x - 58, y + 27, x + 58, y - 27);
        break;
      case 'standardizeAssembly':
        graphics.fillStyle(palette.accent, 1);
        for (let index = 0; index < 4; index += 1) {
          graphics.fillRoundedRect(x - 72 + index * 45, y - 20 + (index % 2) * 18, 28, 28, 5);
        }
        graphics.lineStyle(4, 0xf6e7c7, 0.9);
        graphics.strokeCircle(x + 62, y + 12, 18);
        break;
      case 'recruitSpecialist':
        graphics.fillStyle(palette.accent, 1);
        graphics.fillCircle(x, y - 10, 16);
        graphics.fillRoundedRect(x - 32, y + 10, 64, 26, 9);
        graphics.lineStyle(4, 0xf6e7c7, 0.95);
        graphics.strokeCircle(x + 48, y - 13, 13);
        graphics.lineBetween(x + 57, y - 3, x + 72, y + 13);
        break;
      case 'documentEverything':
        graphics.fillStyle(0xf6e7c7, 1);
        graphics.fillRoundedRect(x - 38, y - 27, 76, 54, 4);
        graphics.lineStyle(3, palette.accent, 1);
        graphics.lineBetween(x - 22, y - 10, x + 22, y - 10);
        graphics.lineBetween(x - 22, y + 3, x + 22, y + 3);
        graphics.lineBetween(x - 22, y + 16, x + 8, y + 16);
        break;
      case 'reinforceFrame':
        graphics.lineStyle(6, palette.accent, 1);
        graphics.strokeTriangle(x, y - 28, x - 58, y + 26, x + 58, y + 26);
        graphics.lineBetween(x, y - 28, x, y + 26);
        graphics.lineBetween(x - 58, y + 26, x + 58, y + 26);
        break;
    }

    return graphics;
  }
}

function cardPalette(id: LessonId): { background: number; accent: number } {
  switch (id) {
    case 'tuneEngineMix':
      return { background: 0x3a1f36, accent: 0xff6b35 };
    case 'improveFuelFlow':
      return { background: 0x17324a, accent: 0x5ac8fa };
    case 'salvageUsefulParts':
      return { background: 0x24351f, accent: 0x8ef6c5 };
    case 'stabilizeFins':
      return { background: 0x1f2d4a, accent: 0x7aa2ff };
    case 'fairNoseCone':
      return { background: 0x233844, accent: 0xa8ffd9 };
    case 'cutDeadWeight':
      return { background: 0x3b2c1f, accent: 0xffd166 };
    case 'standardizeAssembly':
      return { background: 0x2b3242, accent: 0xf4c95d };
    case 'recruitSpecialist':
      return { background: 0x2b2746, accent: 0xcdb4ff };
    case 'documentEverything':
      return { background: 0x352b22, accent: 0xf4c95d };
    case 'reinforceFrame':
      return { background: 0x332732, accent: 0xff9f9f };
  }
}
