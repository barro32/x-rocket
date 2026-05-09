import Phaser from 'phaser';

interface GlobalMenuViewConfig {
  onReset: () => void;
}

export class GlobalMenuView {
  private readonly container: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: GlobalMenuViewConfig,
  ) {
    this.container = scene.add.container(640, 360).setDepth(80).setVisible(false).setAlpha(0);
    this.container.setScrollFactor(0);

    const blocker = scene.add.rectangle(0, 0, 1280, 720, 0x050711, 0.72);
    blocker.setInteractive();

    const panel = scene.add.rectangle(0, 0, 420, 260, 0x101828, 0.96);
    panel.setStrokeStyle(4, 0xf4c95d, 1);

    const title = scene.add.text(0, -92, 'MENU', {
      fontFamily: 'monospace',
      fontSize: '34px',
      color: '#f6e7c7',
    });
    title.setOrigin(0.5);

    const resetButton = scene.add.text(0, -10, 'Reset Game', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#101828',
      backgroundColor: '#ff6b35',
      padding: { x: 22, y: 12 },
    });
    resetButton.setOrigin(0.5);
    resetButton.setInteractive({ useHandCursor: true });
    resetButton.on('pointerdown', () => this.config.onReset());

    const closeButton = scene.add.text(0, 74, 'Close', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#101828',
      backgroundColor: '#f6e7c7',
      padding: { x: 20, y: 10 },
    });
    closeButton.setOrigin(0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on('pointerdown', () => this.hide());

    this.container.add([blocker, panel, title, resetButton, closeButton]);
  }

  show(): void {
    this.container.setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 140,
      ease: 'Sine.easeOut',
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 120,
      ease: 'Sine.easeIn',
      onComplete: () => this.container.setVisible(false),
    });
  }
}
