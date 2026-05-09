import Phaser from 'phaser';
import type { LaunchResult } from '../../sim/types';

export class LaunchSummaryView {
  readonly container: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    result: LaunchResult,
  ) {
    this.container = scene.add.container(640, 190).setDepth(19).setAlpha(0).setScale(0.92);
    this.container.setScrollFactor(0);

    const panel = scene.add.rectangle(0, 0, 560, 118, 0x0b1024, 0.82);
    panel.setStrokeStyle(4, summaryColor(result), 1);

    const title = scene.add.text(-250, -46, titleFor(result), {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f6e7c7',
    });

    const altitude = scene.add.text(-250, -8, `Altitude: ${formatAltitude(result.altitudeMeters)}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffd166',
    });

    const detail = scene.add.text(-250, 24, result.message, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#d8e2dc',
      wordWrap: { width: 500 },
    });

    this.container.add([panel, title, altitude, detail]);
  }

  enter(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        scale: 1,
        y: 178,
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
