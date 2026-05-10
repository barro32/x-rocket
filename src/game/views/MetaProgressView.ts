import Phaser from 'phaser';
import { isBankrupt } from '../../sim/game';
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

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const nodePositions: Record<MetaUpgradeId, { x: number; y: number }> = {
  blackBoxRecovery: { x: 0, y: 0 },
  scrapyardEngineering: { x: -205, y: 0 },
  recoveryProgram: { x: -400, y: -80 },
  supplierContracts: { x: -400, y: 80 },
  basicStabilizers: { x: 205, y: 0 },
  guidanceProgram: { x: 400, y: -80 },
  advancedAerodynamics: { x: 400, y: 80 },
  questionableInvestors: { x: 0, y: 150 },
  failureReviewBoard: { x: 0, y: 290 },
  prototypeArchive: { x: -165, y: 430 },
  safetyReviewBoard: { x: 165, y: 430 },
  missionControl: { x: -165, y: 560 },
  crashLab: { x: 165, y: 560 },
};

export class MetaProgressView {
  private static readonly minZoom = 0.7;
  private static readonly maxZoom = 1.5;
  private static readonly zoomStep = 0.1;

  private readonly container: Phaser.GameObjects.Container;
  private readonly blocker: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly knowledgeText: Phaser.GameObjects.Text;
  private readonly navHintText: Phaser.GameObjects.Text;
  private readonly viewportBackground: Phaser.GameObjects.Rectangle;
  private readonly viewportMask: Phaser.GameObjects.Graphics;
  private readonly treeContainer: Phaser.GameObjects.Container;
  private readonly graph: Phaser.GameObjects.Graphics;
  private readonly nodes: MetaNode[] = [];
  private readonly continueButton: Phaser.GameObjects.Text;
  private readonly zoomInButton: Phaser.GameObjects.Text;
  private readonly zoomOutButton: Phaser.GameObjects.Text;
  private readonly tooltipContainer: Phaser.GameObjects.Container;
  private readonly tooltipBackground: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;
  private readonly treeBounds: Bounds;

  private currentState?: GameState;
  private hoveredNodeId?: MetaUpgradeId;
  private isPanning = false;
  private panPointerId?: number;
  private panStartX = 0;
  private panStartY = 0;
  private panStartOffsetX = 0;
  private panStartOffsetY = 0;
  private panOffsetX = 0;
  private panOffsetY = -115;
  private treeZoom = 1;
  private panelWidth = 1040;
  private panelHeight = 650;
  private viewportCenterX = 0;
  private viewportCenterY = 18;
  private viewportWidth = 960;
  private viewportHeight = 478;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: MetaProgressViewConfig,
  ) {
    this.container = scene.add.container(scene.scale.width / 2, scene.scale.height / 2).setDepth(60).setVisible(false).setAlpha(0);
    this.container.setScrollFactor(0);
    this.treeBounds = this.calculateTreeBounds();

    this.blocker = scene.add.rectangle(0, 0, 1280, 720, 0x050711, 0.78);
    this.blocker.setInteractive();
    this.panel = scene.add.rectangle(0, 0, 1040, 650, 0x101828, 0.96);
    this.panel.setStrokeStyle(5, 0xf4c95d, 1);
    this.panel.setInteractive();

    this.titleText = scene.add.text(-470, -298, 'BANKRUPTCY REVIEW', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#f6e7c7',
    });
    this.titleText.setResolution(2);

    this.knowledgeText = scene.add.text(-470, -254, '', {
      fontFamily: 'monospace',
      fontSize: '19px',
      color: '#8ef6c5',
    });
    this.knowledgeText.setResolution(2);

    this.navHintText = scene.add.text(468, -254, 'Drag to pan | Wheel to zoom', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aab2c5',
    });
    this.navHintText.setOrigin(1, 0);
    this.navHintText.setResolution(2);

    this.viewportBackground = scene.add.rectangle(
      this.viewportCenterX,
      this.viewportCenterY,
      this.viewportWidth,
      this.viewportHeight,
      0x0b1320,
      0.8,
    );
    this.viewportBackground.setStrokeStyle(2, 0x2f3b54, 1);

    this.viewportMask = scene.add.graphics();
    this.viewportMask.setVisible(false);

    this.treeContainer = scene.add.container(this.viewportCenterX, this.viewportCenterY);
    this.treeContainer.setMask(this.viewportMask.createGeometryMask());

    this.graph = scene.add.graphics();
    this.treeContainer.add(this.graph);
    this.container.add([
      this.blocker,
      this.panel,
      this.titleText,
      this.knowledgeText,
      this.navHintText,
      this.viewportBackground,
      this.treeContainer,
      this.viewportMask,
    ]);

    metaUpgradeSpecs.forEach((spec) => {
      const position = nodePositions[spec.id];
      const ring = scene.add.circle(position.x, position.y, 48, 0xf6e7c7, 1);
      ring.setStrokeStyle(4, 0x101828, 1);
      ring.setInteractive({ useHandCursor: true });
      ring.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handleNodePointerUp(spec.id, pointer));
      ring.on('pointerover', (pointer: Phaser.Input.Pointer) => this.showTooltip(spec.id, pointer));
      ring.on('pointermove', (pointer: Phaser.Input.Pointer) => this.positionTooltip(pointer));
      ring.on('pointerout', () => this.hideTooltip());

      const label = scene.add.text(position.x, position.y, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#101828',
        align: 'center',
        wordWrap: { width: 92 },
      });
      label.setOrigin(0.5);
      label.setResolution(2);
      label.setInteractive({ useHandCursor: true });
      label.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handleNodePointerUp(spec.id, pointer));
      label.on('pointerover', (pointer: Phaser.Input.Pointer) => this.showTooltip(spec.id, pointer));
      label.on('pointermove', (pointer: Phaser.Input.Pointer) => this.positionTooltip(pointer));
      label.on('pointerout', () => this.hideTooltip());

      this.nodes.push({ id: spec.id, x: position.x, y: position.y, label, ring });
      this.treeContainer.add([ring, label]);
    });

    this.continueButton = scene.add.text(0, 302, 'Start Next Company', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#101828',
      backgroundColor: '#8ef6c5',
      padding: { x: 22, y: 10 },
    });
    this.continueButton.setOrigin(0.5);
    this.continueButton.setResolution(2);
    this.continueButton.setInteractive({ useHandCursor: true });
    this.continueButton.on('pointerdown', () => this.config.onContinue());
    this.continueButton.on('pointerover', () => this.continueButton.setScale(1.05));
    this.continueButton.on('pointerout', () => this.continueButton.setScale(1));
    this.container.add(this.continueButton);

    this.zoomInButton = scene.add.text(0, 0, '+', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#101828',
      backgroundColor: '#f6e7c7',
      padding: { x: 12, y: 6 },
    });
    this.zoomInButton.setOrigin(0.5);
    this.zoomInButton.setResolution(2);
    this.zoomInButton.setInteractive({ useHandCursor: true });
    this.zoomInButton.on('pointerdown', () => this.adjustZoom(1));

    this.zoomOutButton = scene.add.text(0, 0, '-', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#101828',
      backgroundColor: '#f6e7c7',
      padding: { x: 14, y: 6 },
    });
    this.zoomOutButton.setOrigin(0.5);
    this.zoomOutButton.setResolution(2);
    this.zoomOutButton.setInteractive({ useHandCursor: true });
    this.zoomOutButton.on('pointerdown', () => this.adjustZoom(-1));
    this.container.add([this.zoomInButton, this.zoomOutButton]);

    this.tooltipBackground = scene.add.rectangle(0, 0, 260, 120, 0x0b1320, 0.96);
    this.tooltipBackground.setStrokeStyle(2, 0xf4c95d, 1);
    this.tooltipBackground.setOrigin(0, 0);
    this.tooltipText = scene.add.text(10, 10, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f6e7c7',
      wordWrap: { width: 240 },
      lineSpacing: 3,
    });
    this.tooltipText.setResolution(2);
    this.tooltipContainer = scene.add.container(0, 0, [this.tooltipBackground, this.tooltipText]);
    this.tooltipContainer.setVisible(false);
    this.container.add(this.tooltipContainer);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startPan(pointer));
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePanMove(pointer));
    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.stopPan(pointer));
    scene.input.on('wheel', (pointer: Phaser.Input.Pointer, _targets: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      this.handleWheelZoom(pointer, dy);
    });

    this.layout(scene.scale.width, scene.scale.height);
    this.applyTreeTransform();
  }

  layout(width: number, height: number): void {
    const compact = width < 900 || height < 760;
    const narrow = width < 560;

    this.panelWidth = Math.max(320, width - 28);
    this.panelHeight = Math.max(460, height - 28);
    this.viewportWidth = this.panelWidth - (narrow ? 28 : 80);
    this.viewportHeight = this.panelHeight - (narrow ? 196 : 172);
    this.viewportCenterX = 0;
    this.viewportCenterY = narrow ? 24 : 18;

    this.container.setPosition(width / 2, height / 2);
    this.blocker.setSize(width, height);
    this.panel.setSize(this.panelWidth, this.panelHeight);

    const left = -(this.panelWidth / 2) + 18;
    const right = (this.panelWidth / 2) - 18;
    const top = -(this.panelHeight / 2) + 16;
    const bottom = (this.panelHeight / 2) - 18;

    this.titleText.setPosition(left, top);
    this.titleText.setStyle({ fontSize: compact ? '26px' : '32px' });
    this.knowledgeText.setPosition(left, top + (compact ? 34 : 44));
    this.knowledgeText.setStyle({ fontSize: compact ? '16px' : '19px' });
    this.navHintText.setPosition(right, top + (compact ? 36 : 44));
    this.navHintText.setStyle({ fontSize: narrow ? '12px' : '14px' });
    this.navHintText.setText(narrow ? 'Drag to pan | +/- to zoom' : 'Drag to pan | Wheel or +/- to zoom');

    this.viewportBackground.setPosition(this.viewportCenterX, this.viewportCenterY);
    this.viewportBackground.setSize(this.viewportWidth, this.viewportHeight);
    this.redrawViewportMask();

    this.continueButton.setPosition(0, bottom - 18);
    this.continueButton.setStyle({ fontSize: compact ? '18px' : '22px', padding: { x: compact ? 18 : 22, y: compact ? 8 : 10 } });

    const zoomButtonY = this.viewportCenterY - this.viewportHeight / 2 + 24;
    this.zoomInButton.setPosition(right - 24, zoomButtonY);
    this.zoomOutButton.setPosition(right - 24, zoomButtonY + 48);
    this.zoomInButton.setStyle({ fontSize: compact ? '18px' : '22px' });
    this.zoomOutButton.setStyle({ fontSize: compact ? '18px' : '22px' });

    this.applyTreeTransform();
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
    this.hideTooltip();
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 140,
      ease: 'Sine.easeIn',
      onComplete: () => this.container.setVisible(false),
    });
  }

  update(state: GameState): void {
    this.currentState = state;
    this.knowledgeText.setText(`Meta Knowledge: ${state.knowledge}`);
    this.continueButton.setText(isBankrupt(state) ? 'Start Next Company' : 'Close');
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

    if (this.hoveredNodeId) {
      this.refreshTooltipText(this.hoveredNodeId);
    }
  }

  private calculateTreeBounds(): Bounds {
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    Object.values(nodePositions).forEach(({ x, y }) => {
      left = Math.min(left, x - 62);
      right = Math.max(right, x + 62);
      top = Math.min(top, y - 62);
      bottom = Math.max(bottom, y + 62);
    });

    return { left, right, top, bottom };
  }

  private handleNodePointerUp(id: MetaUpgradeId, pointer: Phaser.Input.Pointer): void {
    if (!this.container.visible || pointer.getDistance() > 10) {
      return;
    }
    this.config.onBuy(id);
  }

  private startPan(pointer: Phaser.Input.Pointer): void {
    if (!this.container.visible || !this.isPointerInsideViewport(pointer)) {
      return;
    }

    this.isPanning = true;
    this.panPointerId = pointer.id;
    this.panStartX = pointer.x;
    this.panStartY = pointer.y;
    this.panStartOffsetX = this.panOffsetX;
    this.panStartOffsetY = this.panOffsetY;
  }

  private handlePanMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isPanning || this.panPointerId !== pointer.id) {
      return;
    }

    this.panOffsetX = this.panStartOffsetX + (pointer.x - this.panStartX);
    this.panOffsetY = this.panStartOffsetY + (pointer.y - this.panStartY);
    this.applyTreeTransform();
  }

  private stopPan(pointer: Phaser.Input.Pointer): void {
    if (this.panPointerId !== pointer.id) {
      return;
    }
    this.isPanning = false;
    this.panPointerId = undefined;
  }

  private handleWheelZoom(pointer: Phaser.Input.Pointer, deltaY: number): void {
    if (!this.container.visible || !this.isPointerInsideViewport(pointer)) {
      return;
    }

    const local = this.toLocalPoint(pointer);
    const viewX = local.x - this.viewportCenterX;
    const viewY = local.y - this.viewportCenterY;

    const nextZoom = Phaser.Math.Clamp(
      this.treeZoom + (deltaY > 0 ? -MetaProgressView.zoomStep : MetaProgressView.zoomStep),
      MetaProgressView.minZoom,
      MetaProgressView.maxZoom,
    );

    if (Math.abs(nextZoom - this.treeZoom) < 0.0001) {
      return;
    }

    const worldX = (viewX - this.panOffsetX) / this.treeZoom;
    const worldY = (viewY - this.panOffsetY) / this.treeZoom;
    this.treeZoom = nextZoom;
    this.panOffsetX = viewX - worldX * this.treeZoom;
    this.panOffsetY = viewY - worldY * this.treeZoom;
    this.applyTreeTransform();
  }

  private applyTreeTransform(): void {
    const clamped = this.clampPan(this.panOffsetX, this.panOffsetY, this.treeZoom);
    this.panOffsetX = clamped.x;
    this.panOffsetY = clamped.y;
    this.treeContainer.setPosition(
      this.viewportCenterX + this.panOffsetX,
      this.viewportCenterY + this.panOffsetY,
    );
    this.treeContainer.setScale(this.treeZoom);
  }

  private clampPan(x: number, y: number, zoom: number): { x: number; y: number } {
    const margin = 80;
    const viewportLeft = this.viewportCenterX - this.viewportWidth / 2;
    const viewportRight = this.viewportCenterX + this.viewportWidth / 2;
    const viewportTop = this.viewportCenterY - this.viewportHeight / 2;
    const viewportBottom = this.viewportCenterY + this.viewportHeight / 2;

    const minX = viewportRight - this.treeBounds.right * zoom - margin;
    const maxX = viewportLeft - this.treeBounds.left * zoom + margin;
    const minY = viewportBottom - this.treeBounds.bottom * zoom - margin;
    const maxY = viewportTop - this.treeBounds.top * zoom + margin;

    const clampedX = minX > maxX ? (minX + maxX) / 2 : Phaser.Math.Clamp(x, minX, maxX);
    const clampedY = minY > maxY ? (minY + maxY) / 2 : Phaser.Math.Clamp(y, minY, maxY);
    return { x: clampedX, y: clampedY };
  }

  private showTooltip(id: MetaUpgradeId, pointer: Phaser.Input.Pointer): void {
    if (!this.container.visible) {
      return;
    }

    this.hoveredNodeId = id;
    this.refreshTooltipText(id);
    this.tooltipContainer.setVisible(true);
    this.positionTooltip(pointer);
  }

  private hideTooltip(): void {
    this.hoveredNodeId = undefined;
    this.tooltipContainer.setVisible(false);
  }

  private refreshTooltipText(id: MetaUpgradeId): void {
    if (!this.currentState) {
      return;
    }

    const spec = metaUpgradeById[id];
    const level = this.currentState.metaUpgrades[id];
    const maxed = level >= spec.maxLevel;
    const cost = metaUpgradeCost(spec, level);
    const unlocked = isMetaUpgradeUnlocked(this.currentState.metaUpgrades, id);
    const prereq = (spec.prerequisites ?? []).map((reqId) => metaUpgradeById[reqId].name).join(', ') || 'None';

    const status = maxed
      ? 'Status: MAX'
      : !unlocked
        ? 'Status: Locked'
        : this.currentState.knowledge >= cost
          ? `Status: Buy now for ${cost}K`
          : `Status: Need ${cost}K`;

    this.tooltipText.setText([
      spec.name,
      `${level}/${spec.maxLevel}`,
      '',
      spec.description,
      spec.unlocks,
      '',
      `Prereqs: ${prereq}`,
      status,
    ]);

    const width = Math.min(360, Math.max(250, this.tooltipText.width + 20));
    this.tooltipText.setWordWrapWidth(width - 20);
    this.tooltipBackground.setSize(width, this.tooltipText.height + 20);
  }

  private positionTooltip(pointer: Phaser.Input.Pointer): void {
    if (!this.tooltipContainer.visible) {
      return;
    }

    const local = this.toLocalPoint(pointer);
    const tooltipWidth = this.tooltipBackground.width;
    const tooltipHeight = this.tooltipBackground.height;
    const minX = -(this.panelWidth / 2) + 10;
    const maxX = (this.panelWidth / 2) - 10 - tooltipWidth;
    const minY = -(this.panelHeight / 2) + 10;
    const maxY = (this.panelHeight / 2) - 10 - tooltipHeight;

    const x = Phaser.Math.Clamp(local.x + 18, minX, maxX);
    const y = Phaser.Math.Clamp(local.y + 18, minY, maxY);
    this.tooltipContainer.setPosition(x, y);
  }

  private toLocalPoint(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return {
      x: pointer.x - this.container.x,
      y: pointer.y - this.container.y,
    };
  }

  private isPointerInsideViewport(pointer: Phaser.Input.Pointer): boolean {
    const local = this.toLocalPoint(pointer);
    const left = this.viewportCenterX - this.viewportWidth / 2;
    const right = this.viewportCenterX + this.viewportWidth / 2;
    const top = this.viewportCenterY - this.viewportHeight / 2;
    const bottom = this.viewportCenterY + this.viewportHeight / 2;
    return local.x >= left && local.x <= right && local.y >= top && local.y <= bottom;
  }

  private redrawViewportMask(): void {
    this.viewportMask.clear();
    this.viewportMask.fillStyle(0xffffff, 1);
    this.viewportMask.fillRect(
      this.viewportCenterX - this.viewportWidth / 2,
      this.viewportCenterY - this.viewportHeight / 2,
      this.viewportWidth,
      this.viewportHeight,
    );
  }

  private adjustZoom(direction: number): void {
    const nextZoom = Phaser.Math.Clamp(
      this.treeZoom + direction * MetaProgressView.zoomStep,
      MetaProgressView.minZoom,
      MetaProgressView.maxZoom,
    );

    if (Math.abs(nextZoom - this.treeZoom) < 0.0001) {
      return;
    }

    this.treeZoom = nextZoom;
    this.applyTreeTransform();
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
