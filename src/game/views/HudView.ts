import Phaser from 'phaser';

interface HudViewConfig {
  onPrimary: () => void;
  onMenu: () => void;
}

export class HudView {
  private moneyText: Phaser.GameObjects.Text;
  private primaryButton: Phaser.GameObjects.Text;
  private menuButton: Phaser.GameObjects.Text;

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

  update(money: number, launchCost: number, bankrupt: boolean, locked: boolean): void {
    this.moneyText.setText(`$${money}`);
    this.primaryButton.setText(bankrupt ? 'Bankruptcy Review' : `Launch  $${launchCost}`);
    this.primaryButton.setAlpha(locked ? 0.42 : 1);
  }
}
