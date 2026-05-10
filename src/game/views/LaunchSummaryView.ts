import Phaser from 'phaser';
import type { LaunchResult } from '../../sim/types';

export class LaunchSummaryView {
  readonly container: Phaser.GameObjects.Container;

  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly altitude: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private targetY = 178;

  constructor(
    private readonly scene: Phaser.Scene,
    result: LaunchResult,
  ) {
    this.container = scene.add.container(scene.scale.width / 2, 190).setDepth(19).setAlpha(0).setScale(0.92);
    this.container.setScrollFactor(0);

    this.panel = scene.add.rectangle(0, 0, 560, 118, 0x0b1024, 0.82);
    this.panel.setStrokeStyle(4, summaryColor(result), 1);

    this.title = scene.add.text(-250, -46, titleFor(result), {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f6e7c7',
    });

    this.altitude = scene.add.text(-250, -8, `Altitude: ${formatAltitude(result.altitudeMeters)}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffd166',
    });

    this.detail = scene.add.text(-250, 24, result.message, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#d8e2dc',
      wordWrap: { width: 500 },
    });

    this.container.add([this.panel, this.title, this.altitude, this.detail]);
    this.layout(scene.scale.width, scene.scale.height);
  }

  layout(width: number, height: number): void {
    const compact = width < 760;
    const panelWidth = Math.min(560, Math.max(300, width - 28));
    const detailWidth = panelWidth - 60;

    this.targetY = compact ? 118 : 178;
    this.container.setX(width / 2);
    this.panel.setSize(panelWidth, compact ? 136 : 118);
    this.title.setPosition(-(panelWidth / 2) + 26, compact ? -50 : -46);
    this.title.setStyle({ fontSize: compact ? '19px' : '24px' });
    this.altitude.setPosition(-(panelWidth / 2) + 26, compact ? -18 : -8);
    this.altitude.setStyle({ fontSize: compact ? '15px' : '18px' });
    this.detail.setPosition(-(panelWidth / 2) + 26, compact ? 14 : 24);
    this.detail.setWordWrapWidth(detailWidth);
    this.detail.setStyle({ fontSize: compact ? '13px' : '16px' });

    if (this.container.alpha > 0) {
      this.container.setY(this.targetY);
    }
  }

  enter(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        scale: 1,
        y: this.targetY,
        duration: 260,
        ease: 'Back.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  exit(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        y: this.container.y - 24,
        duration: 180,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.container.destroy();
          resolve();
        },
      });
    });
  }
}

function titleFor(result: LaunchResult): string {
  if (result.outcome === 'orbit') {
    return 'ORBIT REACHED';
  }

  if (result.outcome === 'exploded') {
    return result.failurePhase ? `EXPLOSION: ${result.failurePhase.toUpperCase()}` : 'EXPLOSION';
  }

  return result.failurePhase ? `FAILED: ${result.failurePhase.toUpperCase()}` : 'FLIGHT COMPLETE';
}

function summaryColor(result: LaunchResult): number {
  if (result.outcome === 'orbit') {
    return 0x8ef6c5;
  }

  if (result.outcome === 'exploded') {
    return 0xff6b35;
  }

  return 0xffd166;
}

function formatAltitude(meters: number): string {
  return `${Math.max(0, Math.floor(meters))} m`;
}
