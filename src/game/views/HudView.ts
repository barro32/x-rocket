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
  private viewportWidth = 1280;
  private viewportHeight = 720;

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

    this.layout(scene.scale.width, scene.scale.height);
  }

  layout(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;

    const compact = width < 900;
    const narrow = width < 560;
    const topY = 16;
    const sidePadding = narrow ? 14 : 20;
    const buttonFont = narrow ? '14px' : compact ? '15px' : '16px';
    const moneyFont = narrow ? '20px' : compact ? '24px' : '28px';
    const statsFont = narrow ? '12px' : compact ? '13px' : '15px';
    const primaryFont = narrow ? '18px' : compact ? '20px' : '24px';

    this.moneyText.setPosition(sidePadding, topY);
    this.moneyText.setStyle({ fontSize: moneyFont, padding: { x: narrow ? 10 : 14, y: narrow ? 6 : 8 } });

    this.menuButton.setPosition(width - sidePadding, topY);
    this.menuButton.setStyle({ fontSize: buttonFont, padding: { x: narrow ? 8 : 10, y: narrow ? 6 : 7 } });

    this.metaButton.setPosition(this.menuButton.x - this.menuButton.width - 10, topY);
    this.metaButton.setStyle({ fontSize: buttonFont, padding: { x: narrow ? 8 : 10, y: narrow ? 6 : 7 } });

    this.statsText.setPosition(width / 2, compact ? 62 : 24);
    this.statsText.setStyle({ fontSize: statsFont, padding: { x: narrow ? 8 : 12, y: narrow ? 6 : 8 } });

    this.primaryButton.setPosition(width / 2, height - (compact ? 38 : 60));
    this.primaryButton.setStyle({ fontSize: primaryFont, padding: { x: narrow ? 16 : 22, y: narrow ? 10 : 12 } });
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
    this.statsText.setText(this.formatStatsText(stats.thrust, stats.fuel, stats.aerodynamics, stats.lightness, stats.guidance, stats.reliability));
  }

  private renderRolledStats(rolledStats: RolledRocketStats, reliability: number): void {
    this.statsText.setText(
      this.formatStatsText(
        rolledStats.thrust,
        rolledStats.fuel,
        rolledStats.aerodynamics,
        rolledStats.lightness,
        rolledStats.guidance,
        reliability,
      ),
    );
  }

  private formatStatsText(thrust: number, fuel: number, aerodynamics: number, lightness: number, guidance: number, reliability: number): string {
    const firstLine = `THR ${thrust}  FUEL ${fuel}  AERO ${aerodynamics}`;
    const secondLine = `LIGHT ${lightness}  GUIDE ${guidance}  REL ${reliability}`;
    return this.viewportWidth < 900 ? `${firstLine}\n${secondLine}` : `${firstLine}  ${secondLine}`;
  }
}
