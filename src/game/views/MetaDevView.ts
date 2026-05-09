import Phaser from 'phaser';
import { metaUpgradeSpecs } from '../../sim/metaUpgrades';
import type { GameState, MetaUpgradeId } from '../../sim/types';

interface MetaDevViewConfig {
  onBuy: (id: MetaUpgradeId) => void;
}

export class MetaDevView {
  private readonly header: Phaser.GameObjects.Text;
  private readonly buttons: Array<{ id: MetaUpgradeId; text: Phaser.GameObjects.Text }> = [];

  constructor(
    private readonly scene: Phaser.Scene,
    config: MetaDevViewConfig,
  ) {
    this.header = scene.add.text(28, 82, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f6e7c7',
      backgroundColor: 'rgba(5, 7, 17, 0.72)',
      padding: { x: 10, y: 7 },
    });
    this.header.setDepth(31);

    metaUpgradeSpecs.forEach((spec, index) => {
      const text = scene.add.text(28, 122 + index * 38, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#101828',
        backgroundColor: '#8ef6c5',
        padding: { x: 8, y: 5 },
      });
      text.setDepth(31);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => config.onBuy(spec.id));
      this.buttons.push({ id: spec.id, text });
    });
  }

  update(state: GameState): void {
    this.header.setText(`META KNOWLEDGE: ${state.knowledge}`);
    this.buttons.forEach(({ id, text }) => {
      const spec = metaUpgradeSpecs.find((upgrade) => upgrade.id === id);
      if (!spec) {
        return;
      }

      const level = state.metaUpgrades[id];
      const maxed = level >= spec.maxLevel;
      const affordable = state.knowledge >= spec.cost;
      text.setText(`${spec.name} ${level}/${spec.maxLevel} - ${maxed ? 'MAX' : `${spec.cost}K`}`);
      text.setAlpha(maxed ? 0.45 : affordable ? 1 : 0.55);
    });
  }
}
