import Phaser from 'phaser';

interface GlobalMenuViewConfig {
  onReset: () => void;
}

export class GlobalMenuView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly blocker: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly resetButton: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: GlobalMenuViewConfig,
  ) {
    this.container = scene.add.container(scene.scale.width / 2, scene.scale.height / 2).setDepth(80).setVisible(false).setAlpha(0);
    this.container.setScrollFactor(0);

    this.blocker = scene.add.rectangle(0, 0, 1280, 720, 0x050711, 0.72);
    this.blocker.setInteractive();

    this.panel = scene.add.rectangle(0, 0, 420, 260, 0x101828, 0.96);
    this.panel.setStrokeStyle(4, 0xf4c95d, 1);

    this.title = scene.add.text(0, -92, 'MENU', {
      fontFamily: 'monospace',
      fontSize: '34px',
      color: '#f6e7c7',
    });
    this.title.setOrigin(0.5);

    this.resetButton = scene.add.text(0, -10, 'Reset Game', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#101828',
      backgroundColor: '#ff6b35',
      padding: { x: 22, y: 12 },
    });
    this.resetButton.setOrigin(0.5);
    this.resetButton.setInteractive({ useHandCursor: true });
    this.resetButton.on('pointerdown', () => this.config.onReset());

    this.closeButton = scene.add.text(0, 74, 'Close', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#101828',
      backgroundColor: '#f6e7c7',
      padding: { x: 20, y: 10 },
    });
    this.closeButton.setOrigin(0.5);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.on('pointerdown', () => this.hide());

    this.container.add([this.blocker, this.panel, this.title, this.resetButton, this.closeButton]);
    this.layout(scene.scale.width, scene.scale.height);
  }

  layout(width: number, height: number): void {
    const compact = width < 640;
    const panelWidth = Math.min(420, Math.max(300, width - 32));
    const panelHeight = compact ? 240 : 260;

    this.container.setPosition(width / 2, height / 2);
    this.blocker.setSize(width, height);
    this.panel.setSize(panelWidth, panelHeight);
    this.title.setPosition(0, compact ? -78 : -92);
    this.title.setStyle({ fontSize: compact ? '28px' : '34px' });
    this.resetButton.setPosition(0, compact ? -4 : -10);
    this.resetButton.setStyle({ fontSize: compact ? '20px' : '24px', padding: { x: compact ? 18 : 22, y: compact ? 10 : 12 } });
    this.closeButton.setPosition(0, compact ? 68 : 74);
    this.closeButton.setStyle({ fontSize: compact ? '18px' : '20px', padding: { x: compact ? 16 : 20, y: compact ? 8 : 10 } });
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
