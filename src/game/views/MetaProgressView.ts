import Phaser from 'phaser';
import { isMetaUpgradeUnlocked, metaUpgradeById, metaUpgradeCost, metaUpgradeSpecs } from '../../sim/metaUpgrades';
import type { GameState, MetaUpgradeId } from '../../sim/types';

interface MetaProgressViewConfig {
  onBuy: (id: MetaUpgradeId) => void;
  onContinue: () => void;
}

interface MetaNode {
  id: MetaUpgradeId;
  x: number;
  y: number;
  label: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Arc;
}

const nodePositions: Record<MetaUpgradeId, { x: number; y: number }> = {
  blackBoxRecovery: { x: 0, y: -55 },
  scrapyardEngineering: { x: -260, y: 20 },
  questionableInvestors: { x: 0, y: 140 },
  basicStabilizers: { x: 260, y: 20 },
  recoveryProgram: { x: -390, y: 160 },
  supplierContracts: { x: -250, y: 210 },
  failureReviewBoard: { x: 0, y: 265 },
  prototypeArchive: { x: 0, y: 370 },
  safetyReviewBoard: { x: 170, y: 210 },
  missionControl: { x: 0, y: 470 },
  crashLab: { x: 170, y: 340 },
  guidanceProgram: { x: 255, y: 190 },
  advancedAerodynamics: { x: 390, y: 160 },
};

export class MetaProgressView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly knowledgeText: Phaser.GameObjects.Text;
  private readonly graph: Phaser.GameObjects.Graphics;
  private readonly nodes: MetaNode[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: MetaProgressViewConfig,
  ) {
    this.container = scene.add.container(640, 360).setDepth(60).setVisible(false).setAlpha(0);
    this.container.setScrollFactor(0);

    const blocker = scene.add.rectangle(0, 0, 1280, 720, 0x050711, 0.78);
    blocker.setInteractive();
    const panel = scene.add.rectangle(0, 0, 1040, 650, 0x101828, 0.96);
    panel.setStrokeStyle(5, 0xf4c95d, 1);

    const title = scene.add.text(-470, -298, 'BANKRUPTCY REVIEW', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#f6e7c7',
    });

    this.knowledgeText = scene.add.text(-470, -254, '', {
      fontFamily: 'monospace',
      fontSize: '19px',
      color: '#8ef6c5',
    });

    this.graph = scene.add.graphics();
    this.container.add([blocker, panel, title, this.knowledgeText, this.graph]);

    metaUpgradeSpecs.forEach((spec) => {
      const position = nodePositions[spec.id];
      const ring = scene.add.circle(position.x, position.y, 48, 0xf6e7c7, 1);
      ring.setStrokeStyle(4, 0x101828, 1);
      ring.setInteractive({ useHandCursor: true });
      ring.on('pointerdown', () => this.config.onBuy(spec.id));

      const label = scene.add.text(position.x, position.y, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#101828',
        align: 'center',
        wordWrap: { width: 92 },
      });
      label.setOrigin(0.5);
      label.setInteractive({ useHandCursor: true });
      label.on('pointerdown', () => this.config.onBuy(spec.id));

      this.nodes.push({ id: spec.id, x: position.x, y: position.y, label, ring });
      this.container.add([ring, label]);
    });

    const continueButton = scene.add.text(0, 302, 'Start Next Company', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#101828',
      backgroundColor: '#8ef6c5',
      padding: { x: 22, y: 10 },
    });
    continueButton.setOrigin(0.5);
    continueButton.setInteractive({ useHandCursor: true });
    continueButton.on('pointerdown', () => this.config.onContinue());
    continueButton.on('pointerover', () => continueButton.setScale(1.05));
    continueButton.on('pointerout', () => continueButton.setScale(1));
    this.container.add(continueButton);
  }

  show(state: GameState): void {
    this.update(state);
    this.container.setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 180,
      ease: 'Sine.easeOut',
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 140,
      ease: 'Sine.easeIn',
      onComplete: () => this.container.setVisible(false),
    });
  }

  update(state: GameState): void {
    this.knowledgeText.setText(`Meta Knowledge: ${state.knowledge}`);
    this.drawLinks(state);

    this.nodes.forEach((node) => {
      const spec = metaUpgradeById[node.id];
      const level = state.metaUpgrades[node.id];
      const unlocked = isMetaUpgradeUnlocked(state.metaUpgrades, node.id);
      const maxed = level >= spec.maxLevel;
      const cost = metaUpgradeCost(spec, level);
      const affordable = unlocked && state.knowledge >= cost && !maxed;

      const fill = maxed ? 0x8ef6c5 : affordable ? 0xffd166 : unlocked ? 0xf6e7c7 : 0x30394d;
      const stroke = maxed ? 0x1bd88f : affordable ? 0xff6b35 : unlocked ? 0xf4c95d : 0x6c7487;
      const textColor = unlocked ? '#101828' : '#aab2c5';

      node.ring.setFillStyle(fill, unlocked ? 1 : 0.78);
      node.ring.setStrokeStyle(4, stroke, 1);
      node.label.setColor(textColor);
      node.label.setText(`${spec.name}\n${level}/${spec.maxLevel}\n${maxed ? 'MAX' : `${cost}K`}`);
    });
  }

  private drawLinks(state: GameState): void {
    this.graph.clear();

    metaUpgradeSpecs.forEach((spec) => {
      const to = nodePositions[spec.id];
      (spec.prerequisites ?? []).forEach((prerequisite) => {
        const from = nodePositions[prerequisite];
        const active = state.metaUpgrades[prerequisite] > 0;
        this.graph.lineStyle(4, active ? 0x8ef6c5 : 0x6c7487, active ? 0.85 : 0.36);
        this.graph.lineBetween(from.x, from.y, to.x, to.y);
      });
    });
  }
}
