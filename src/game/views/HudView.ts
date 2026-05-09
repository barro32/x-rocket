import Phaser from 'phaser';

interface HudViewConfig {
  onPrimary: () => void;
}

export class HudView {
  private moneyText: Phaser.GameObjects.Text;
  private primaryButton: Phaser.GameObjects.Text;

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

    this.primaryButton = scene.add.text(640, 660, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#101828',
      backgroundColor: '#f4c95d',
      padding: { x: 22, y: 12 },
    });
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
  }

  update(money: number, launchCost: number, bankrupt: boolean, locked: boolean): void {
    this.moneyText.setText(`$${money}`);
    this.primaryButton.setText(bankrupt ? 'Take New Loan' : `Launch  $${launchCost}`);
    this.primaryButton.setAlpha(locked ? 0.42 : 1);
  }
}
