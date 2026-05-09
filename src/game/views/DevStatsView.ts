import Phaser from 'phaser';
import { deriveRocketStats } from '../../sim/parts';
import type { GameState } from '../../sim/types';

export class DevStatsView {
  private readonly text: Phaser.GameObjects.Text;

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
    this.text.setDepth(30);
  }

  update(state: GameState): void {
    const stats = deriveRocketStats(state.parts);
    this.text.setText(
      [
        'DEV ROCKET STATS',
        `cost: $${Math.floor(stats.cost)}`,
        `mass: ${fmt(stats.mass)}`,
        `thrust: ${fmt(stats.thrust)}`,
        `t/w: ${fmt(stats.thrustToWeight)}`,
        `burn: ${fmt(stats.burnTime)}s`,
        `aero: ${pct(stats.aerodynamics)}`,
        `stability: ${pct(stats.stability)}`,
        `ignition: ${pct(stats.ignitionReliability)}`,
        `flight: ${pct(stats.flightReliability)}`,
        `structure: ${pct(stats.structuralReliability)}`,
        `heat: ${pct(stats.heatTolerance)}`,
        `salvage: ${pct(stats.salvageRate)}`,
      ].join('\n'),
    );
  }
}

function fmt(value: number): string {
  return `${Math.round(value * 100) / 100}`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
