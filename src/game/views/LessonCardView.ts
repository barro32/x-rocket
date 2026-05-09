import Phaser from 'phaser';
import type { LessonSpec } from '../../sim/types';

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

    const shadow = scene.add.rectangle(8, 10, 250, 172, 0x050711, 0.55);
    this.panel = scene.add.rectangle(0, 0, 250, 172, 0xf6e7c7, 1);
    this.panel.setStrokeStyle(5, 0xf4c95d, 1);

    const title = scene.add.text(-106, -68, config.spec.name, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#101828',
      wordWrap: { width: 212 },
    });

    const description = scene.add.text(-106, -10, config.spec.description, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#293241',
      wordWrap: { width: 212 },
      lineSpacing: 3,
    });

    const effect = scene.add.text(-106, 50, config.spec.effect, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#9b3d2e',
      wordWrap: { width: 212 },
      lineSpacing: 2,
    });

    this.container.add([shadow, this.panel, title, description, effect]);
    this.container.setScale(0.2);
    this.container.setAlpha(0);
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(-125, -86, 250, 172),
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
}
