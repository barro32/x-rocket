import Phaser from 'phaser';
import { launchVariance, orbitScoreThreshold, rocketScore } from '../../sim/rocketStats';
import type { GameState } from '../../sim/types';

export class DevStatsView {
  private readonly text: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(1252, 24, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#8ef6c5',
      backgroundColor: 'rgba(5, 7, 17, 0.76)',
      padding: { x: 10, y: 8 },
      align: 'right',
    });
    this.text.setOrigin(1, 0);
    this.text.setScrollFactor(0);
    this.text.setDepth(30);
    this.text.setVisible(false);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
  }

  update(state: GameState): void {
    if (!this.visible) {
      return;
    }

    const stats = state.rocketStats;
    this.text.setText(
      [
        'DEV ROCKET STATS',
        `thrust: ${fmt(stats.thrust)}`,
        `fuel: ${fmt(stats.fuel)}`,
        `aero: ${fmt(stats.aerodynamics)}`,
        `lightness: ${fmt(stats.lightness)}`,
        `guidance: ${fmt(stats.guidance)}`,
        `reliability: ${fmt(stats.reliability)}`,
        `variance: +/-${launchVariance(stats)}`,
        `score: ${fmt(rocketScore(stats))}`,
        `orbit: ${orbitScoreThreshold}`,
      ].join('\n'),
    );
  }
}

function fmt(value: number): string {
  return `${Math.round(value * 100) / 100}`;
}
