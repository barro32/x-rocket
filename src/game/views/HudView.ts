import Phaser from 'phaser';
import type { RolledRocketStats, RocketStats } from '../../sim/types';

interface HudViewConfig {
  onPrimary: () => void;
  onMeta: () => void;
  onMenu: () => void;
}

export class HudView {
  private moneyText: Phaser.GameObjects.Text;
  private statsText: Phaser.GameObjects.Text;
  private primaryButton: Phaser.GameObjects.Text;
  private metaButton: Phaser.GameObjects.Text;
  private menuButton: Phaser.GameObjects.Text;
  private launchRollTween?: Phaser.Tweens.Tween;
  private launchRollActive = false;

  constructor(
    private readonly scene: Phaser.Scene,
    config: HudViewConfig,
  ) {
    this.moneyText = scene.add.text(28, 24, '', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#f6e7c7',
      backgroundColor: 'rgba(11, 16, 36, 0.72)',
      padding: { x: 14, y: 8 },
    });
    this.moneyText.setScrollFactor(0);

    this.statsText = scene.add.text(640, 24, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#8ef6c5',
      backgroundColor: 'rgba(11, 16, 36, 0.72)',
      padding: { x: 12, y: 8 },
      align: 'center',
    });
    this.statsText.setScrollFactor(0);
    this.statsText.setOrigin(0.5, 0);

    this.primaryButton = scene.add.text(640, 660, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#101828',
      backgroundColor: '#f4c95d',
      padding: { x: 22, y: 12 },
    });
    this.primaryButton.setScrollFactor(0);
    this.primaryButton.setOrigin(0.5);
    this.primaryButton.setInteractive({ useHandCursor: true });
    this.primaryButton.on('pointerdown', config.onPrimary);
    this.primaryButton.on('pointerover', () => {
      this.primaryButton.setScale(1.05);
      this.primaryButton.setStyle({ backgroundColor: '#ffd166' });
    });
    this.primaryButton.on('pointerout', () => {
      this.primaryButton.setScale(1);
      this.primaryButton.setStyle({ backgroundColor: '#f4c95d' });
    });

    this.metaButton = scene.add.text(1128, 24, 'Meta', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#101828',
      backgroundColor: '#8ef6c5',
      padding: { x: 10, y: 7 },
    });
    this.metaButton.setScrollFactor(0);
    this.metaButton.setOrigin(1, 0);
    this.metaButton.setDepth(40);
    this.metaButton.setInteractive({ useHandCursor: true });
    this.metaButton.on('pointerdown', config.onMeta);
    this.metaButton.on('pointerover', () => this.metaButton.setStyle({ backgroundColor: '#a8ffd9' }));
    this.metaButton.on('pointerout', () => this.metaButton.setStyle({ backgroundColor: '#8ef6c5' }));

    this.menuButton = scene.add.text(1236, 24, 'Menu', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#101828',
      backgroundColor: '#f6e7c7',
      padding: { x: 10, y: 7 },
    });
    this.menuButton.setScrollFactor(0);
    this.menuButton.setOrigin(1, 0);
    this.menuButton.setDepth(40);
    this.menuButton.setInteractive({ useHandCursor: true });
    this.menuButton.on('pointerdown', config.onMenu);
  }

  update(money: number, launchCost: number, bankrupt: boolean, locked: boolean, stats: RocketStats): void {
    this.moneyText.setText(`$${money}`);
    if (!this.launchRollActive) {
      this.renderStats(stats);
    }
    this.primaryButton.setText(bankrupt ? 'Bankruptcy Review' : `Launch  $${launchCost}`);
    this.primaryButton.setAlpha(locked ? 0.42 : 1);
    this.metaButton.setAlpha(locked ? 0.42 : 1);
  }

  beginLaunchRoll(reliability: number): void {
    this.launchRollTween?.stop();
    this.launchRollActive = true;
    this.renderRolledStats({ thrust: 0, fuel: 0, aerodynamics: 0, lightness: 0, guidance: 0 }, reliability);
  }

  animateLaunchRoll(target: RolledRocketStats, reliability: number, duration: number): void {
    this.launchRollTween?.stop();
    this.launchRollActive = true;
    this.launchRollTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        this.renderRolledStats({
          thrust: Math.floor(target.thrust * progress),
          fuel: Math.floor(target.fuel * progress),
          aerodynamics: Math.floor(target.aerodynamics * progress),
          lightness: Math.floor(target.lightness * progress),
          guidance: Math.floor(target.guidance * progress),
        }, reliability);
      },
      onComplete: () => {
        this.renderRolledStats(target, reliability);
      },
    });
  }

  endLaunchRoll(stats: RocketStats): void {
    this.launchRollTween?.stop();
    this.launchRollTween = undefined;
    this.launchRollActive = false;
    this.renderStats(stats);
  }

  private renderStats(stats: RocketStats): void {
    this.statsText.setText(
      `THR ${stats.thrust}  FUEL ${stats.fuel}  AERO ${stats.aerodynamics}  LIGHT ${stats.lightness}  GUIDE ${stats.guidance}  REL ${stats.reliability}`,
    );
  }

  private renderRolledStats(rolledStats: RolledRocketStats, reliability: number): void {
    this.statsText.setText(
      `THR ${rolledStats.thrust}  FUEL ${rolledStats.fuel}  AERO ${rolledStats.aerodynamics}  LIGHT ${rolledStats.lightness}  GUIDE ${rolledStats.guidance}  REL ${reliability}`,
    );
  }
}
