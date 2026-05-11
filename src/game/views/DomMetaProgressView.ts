import { isBankrupt } from '../../sim/game';
import { isMetaUpgradeUnlocked, metaUpgradeById, metaUpgradeCost, metaUpgradeSpecs } from '../../sim/metaUpgrades';
import './DomMetaProgressView.css';
import type { GameState, MetaUpgradeId } from '../../sim/types';

interface DomMetaProgressViewConfig {
  onBuy: (id: MetaUpgradeId) => void;
  onContinue: () => void;
}

interface NodeState {
  affordable: boolean;
  cost: number;
  level: number;
  maxed: boolean;
  status: string;
  unlocked: boolean;
}

const graphWidth = 1800;
const graphHeight = 1400;
const originX = graphWidth / 2;
const originY = graphHeight / 2;

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

export class DomMetaProgressView {
  private readonly root: HTMLDivElement;
  private readonly knowledgeText: HTMLDivElement;
  private readonly graphElement: HTMLDivElement;
  private readonly graphSpacer: HTMLDivElement;
  private readonly graphSvg: SVGSVGElement;
  private readonly nodesLayer: HTMLDivElement;
  private readonly popover: HTMLDivElement;
  private readonly popoverTitle: HTMLHeadingElement;
  private readonly popoverMeta: HTMLDivElement;
  private readonly popoverDescription: HTMLParagraphElement;
  private readonly popoverUnlocks: HTMLParagraphElement;
  private readonly buyButton: HTMLButtonElement;
  private readonly continueButton: HTMLButtonElement;

  private currentState?: GameState;
  private popoverOpen = false;
  private selectedNodeId: MetaUpgradeId = 'blackBoxRecovery';
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartScrollLeft = 0;
  private panStartScrollTop = 0;
  private viewportPaddingX = 0;
  private viewportPaddingY = 0;

  constructor(config: DomMetaProgressViewConfig) {
    const app = document.querySelector<HTMLDivElement>('#app');
    if (!app) {
      throw new Error('Missing #app root for DOM meta view');
    }

    this.root = document.createElement('div');
    this.root.className = 'meta-progress';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `
      <div class="meta-progress__backdrop"></div>
      <section class="meta-progress__panel" aria-label="Bankruptcy Review">
        <header class="meta-progress__header">
          <div>
            <h2>Bankruptcy Review</h2>
            <div class="meta-progress__knowledge"></div>
          </div>
          <button class="meta-progress__continue" type="button"></button>
        </header>
        <div class="meta-progress__body">
          <div class="meta-progress__graph" role="group" aria-label="Meta upgrade graph">
            <div class="meta-progress__graph-spacer"></div>
            <svg class="meta-progress__links" viewBox="0 0 ${graphWidth} ${graphHeight}" aria-hidden="true"></svg>
            <div class="meta-progress__nodes"></div>
            <div class="meta-progress__popover" aria-live="polite" aria-hidden="true">
              <h3></h3>
              <div class="meta-progress__popover-meta"></div>
              <p class="meta-progress__popover-description"></p>
              <p class="meta-progress__popover-unlocks"></p>
              <button class="meta-progress__buy" type="button">Buy Upgrade</button>
            </div>
          </div>
        </div>
      </section>
    `;

    app.append(this.root);

    this.knowledgeText = this.requireElement('.meta-progress__knowledge');
    this.graphElement = this.requireElement('.meta-progress__graph');
    this.graphSpacer = this.requireElement('.meta-progress__graph-spacer');
    this.graphSvg = this.requireElement('.meta-progress__links');
    this.nodesLayer = this.requireElement('.meta-progress__nodes');
    this.popover = this.requireElement('.meta-progress__popover');
    this.popoverTitle = this.requireElement('.meta-progress__popover h3');
    this.popoverMeta = this.requireElement('.meta-progress__popover-meta');
    this.popoverDescription = this.requireElement('.meta-progress__popover-description');
    this.popoverUnlocks = this.requireElement('.meta-progress__popover-unlocks');
    this.buyButton = this.requireElement('.meta-progress__buy');
    this.continueButton = this.requireElement('.meta-progress__continue');

    this.continueButton.addEventListener('click', () => config.onContinue());
    this.buyButton.addEventListener('click', () => config.onBuy(this.selectedNodeId));
    this.graphSpacer.style.width = `${graphWidth}px`;
    this.graphSpacer.style.height = `${graphHeight}px`;
    this.graphSvg.style.width = `${graphWidth}px`;
    this.graphSvg.style.height = `${graphHeight}px`;
    this.nodesLayer.style.width = `${graphWidth}px`;
    this.nodesLayer.style.height = `${graphHeight}px`;
    this.bindPanEvents();
    this.buildGraph();
    window.addEventListener('resize', () => {
      if (this.root.classList.contains('meta-progress--visible')) {
        this.centerGraphWhenReady();
      }
    });
  }

  show(state: GameState): void {
    this.update(state);
    this.root.setAttribute('aria-hidden', 'false');
    this.root.classList.add('meta-progress--visible');
    this.centerGraphWhenReady();
  }

  hide(): void {
    this.root.classList.remove('meta-progress--visible');
    this.closePopover();
    window.setTimeout(() => this.root.setAttribute('aria-hidden', 'true'), 160);
  }

  update(state: GameState): void {
    const previousState = this.currentState;
    this.currentState = state;
    this.knowledgeText.textContent = `Meta Knowledge: ${state.knowledge}`;
    this.continueButton.textContent = isBankrupt(state) ? 'Start Next Company' : 'Close';
    this.renderLinks(state);
    this.renderNodes(state);
    this.renderPopover();
    this.renderPurchaseFeedback(previousState, state);
  }

  private buildGraph(): void {
    metaUpgradeSpecs.forEach((spec) => {
      const position = graphPoint(spec.id);
      const button = document.createElement('button');
      button.className = 'meta-node';
      button.type = 'button';
      button.dataset.nodeId = spec.id;
      button.style.left = `${position.x + this.viewportPaddingX}px`;
      button.style.top = `${position.y + this.viewportPaddingY}px`;
      button.addEventListener('focus', () => this.openPopover(spec.id));
      button.addEventListener('click', () => {
        this.openPopover(spec.id);
      });
      this.nodesLayer.append(button);
    });

    this.graphElement.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('.meta-node, .meta-progress__popover')) {
        return;
      }

      this.closePopover();
    });

    this.graphElement.addEventListener('scroll', () => {
      if (this.popoverOpen) {
        this.positionPopover(this.selectedNodeId);
      }
    });
  }

  private bindPanEvents(): void {
    this.graphElement.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('.meta-node, .meta-progress__popover')) {
        return;
      }

      this.isPanning = true;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      this.panStartScrollLeft = this.graphElement.scrollLeft;
      this.panStartScrollTop = this.graphElement.scrollTop;
      this.graphElement.classList.add('meta-progress__graph--panning');
      this.graphElement.setPointerCapture(event.pointerId);
    });

    this.graphElement.addEventListener('pointermove', (event) => {
      if (!this.isPanning) {
        return;
      }

      this.graphElement.scrollLeft = this.panStartScrollLeft - (event.clientX - this.panStartX);
      this.graphElement.scrollTop = this.panStartScrollTop - (event.clientY - this.panStartY);
    });

    const stopPan = (event: PointerEvent): void => {
      if (!this.isPanning) {
        return;
      }

      this.isPanning = false;
      this.graphElement.classList.remove('meta-progress__graph--panning');
      if (this.graphElement.hasPointerCapture(event.pointerId)) {
        this.graphElement.releasePointerCapture(event.pointerId);
      }
    };

    this.graphElement.addEventListener('pointerup', stopPan);
    this.graphElement.addEventListener('pointercancel', stopPan);
    this.graphElement.addEventListener('pointerleave', stopPan);
  }

  private centerOnNode(id: MetaUpgradeId): void {
    const position = graphPoint(id);
    const left = Math.max(0, position.x);
    const top = Math.max(0, position.y);
    this.graphElement.scrollLeft = left;
    this.graphElement.scrollTop = top;
  }

  private centerGraphWhenReady(): void {
    const center = (): void => {
      this.layoutGraph();
      this.centerOnNode('blackBoxRecovery');
    };
    requestAnimationFrame(() => requestAnimationFrame(center));
    window.setTimeout(center, 40);
    window.setTimeout(center, 180);
  }

  private layoutGraph(): void {
    this.viewportPaddingX = this.graphElement.clientWidth / 2;
    this.viewportPaddingY = this.graphElement.clientHeight / 2;
    const width = graphWidth + this.graphElement.clientWidth;
    const height = graphHeight + this.graphElement.clientHeight;
    this.graphSpacer.style.width = `${width}px`;
    this.graphSpacer.style.height = `${height}px`;
    this.graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.graphSvg.style.width = `${width}px`;
    this.graphSvg.style.height = `${height}px`;
    this.nodesLayer.style.width = `${width}px`;
    this.nodesLayer.style.height = `${height}px`;

    if (this.currentState) {
      this.renderLinks(this.currentState);
      this.renderNodes(this.currentState);
      this.renderPopover();
    }
  }

  private renderLinks(state: GameState): void {
    this.graphSvg.replaceChildren();

    metaUpgradeSpecs.forEach((spec) => {
      const to = this.graphPoint(spec.id);
      (spec.prerequisites ?? []).forEach((prerequisite) => {
        const from = this.graphPoint(prerequisite);
        const active = state.metaUpgrades[prerequisite] > 0;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', `${from.x}`);
        line.setAttribute('y1', `${from.y}`);
        line.setAttribute('x2', `${to.x}`);
        line.setAttribute('y2', `${to.y}`);
        line.classList.add('meta-link');
        if (active) {
          line.classList.add('meta-link--active');
        }
        this.graphSvg.append(line);
      });
    });
  }

  private renderNodes(state: GameState): void {
    this.nodesLayer.querySelectorAll<HTMLButtonElement>('.meta-node').forEach((button) => {
      const id = button.dataset.nodeId as MetaUpgradeId;
      const spec = metaUpgradeById[id];
      const view = nodeState(state, id);
      const position = this.graphPoint(id);
      button.className = 'meta-node';
      button.classList.add(`meta-node--${view.status}`);
      button.style.left = `${position.x}px`;
      button.style.top = `${position.y}px`;
      if (this.popoverOpen && id === this.selectedNodeId) {
        button.classList.add('meta-node--selected');
      }
      button.setAttribute('aria-disabled', `${!view.affordable}`);
      button.innerHTML = `
        <span class="meta-node__name">${escapeHtml(spec.name)}</span>
      `;
    });
  }

  private openPopover(id: MetaUpgradeId): void {
    this.selectedNodeId = id;
    this.popoverOpen = true;
    if (this.currentState) {
      this.renderNodes(this.currentState);
      this.renderPopover();
    }
  }

  private closePopover(): void {
    this.popoverOpen = false;
    this.popover.classList.remove('meta-progress__popover--visible');
    this.popover.setAttribute('aria-hidden', 'true');
    if (this.currentState) {
      this.renderNodes(this.currentState);
    }
  }

  private renderPopover(): void {
    if (!this.currentState || !this.popoverOpen) {
      return;
    }

    const spec = metaUpgradeById[this.selectedNodeId];
    const view = nodeState(this.currentState, this.selectedNodeId);

    this.popoverTitle.textContent = spec.name;
    this.popoverMeta.textContent = view.maxed ? `Level ${view.level}/${spec.maxLevel}` : `Level ${view.level}/${spec.maxLevel} | Cost ${view.cost}K`;
    this.popoverDescription.textContent = spec.description;
    this.popoverUnlocks.textContent = spec.unlocks;
    this.buyButton.disabled = !view.affordable;
    this.buyButton.hidden = view.maxed;
    this.buyButton.textContent = buyButtonText(view);
    this.positionPopover(this.selectedNodeId);
    this.popover.classList.add('meta-progress__popover--visible');
    this.popover.setAttribute('aria-hidden', 'false');
  }

  private positionPopover(id: MetaUpgradeId): void {
    const position = this.graphPoint(id);
    const margin = 16;
    const width = Math.max(this.popover.offsetWidth, 272);
    const height = Math.max(this.popover.offsetHeight, 220);
    const minLeft = this.graphElement.scrollLeft + margin;
    const maxLeft = this.graphElement.scrollLeft + this.graphElement.clientWidth - width - margin;
    const minTop = this.graphElement.scrollTop + margin;
    const maxTop = this.graphElement.scrollTop + this.graphElement.clientHeight - height - margin;
    const preferredLeft = position.x + 80;
    const preferredTop = position.y - height / 2;
    const left = clamp(preferredLeft > maxLeft ? position.x - width - 80 : preferredLeft, minLeft, Math.max(minLeft, maxLeft));
    const top = clamp(preferredTop, minTop, Math.max(minTop, maxTop));

    this.popover.style.left = `${left}px`;
    this.popover.style.top = `${top}px`;
  }

  private renderPurchaseFeedback(previousState: GameState | undefined, state: GameState): void {
    if (!previousState || !this.root.classList.contains('meta-progress--visible')) {
      return;
    }

    const purchased = metaUpgradeSpecs.find((spec) => state.metaUpgrades[spec.id] > previousState.metaUpgrades[spec.id]);
    if (!purchased) {
      return;
    }

    this.knowledgeText.classList.remove('meta-progress__knowledge--pulse');
    void this.knowledgeText.offsetWidth;
    this.knowledgeText.classList.add('meta-progress__knowledge--pulse');
    this.flashNode(purchased.id, 'meta-node--purchased');

    metaUpgradeSpecs.forEach((spec) => {
      const wasUnlocked = nodeState(previousState, spec.id).unlocked;
      const isUnlocked = nodeState(state, spec.id).unlocked;
      if (!wasUnlocked && isUnlocked) {
        this.flashNode(spec.id, 'meta-node--newly-unlocked');
      }
    });
  }

  private flashNode(id: MetaUpgradeId, className: string): void {
    const node = this.nodesLayer.querySelector<HTMLButtonElement>(`.meta-node[data-node-id="${id}"]`);
    if (!node) {
      return;
    }

    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  private requireElement<T extends HTMLElement | SVGSVGElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing DOM meta element: ${selector}`);
    }
    return element;
  }

  private graphPoint(id: MetaUpgradeId): { x: number; y: number } {
    const position = graphPoint(id);
    return {
      x: position.x + this.viewportPaddingX,
      y: position.y + this.viewportPaddingY,
    };
  }
}

function nodeState(state: GameState, id: MetaUpgradeId): NodeState {
  const spec = metaUpgradeById[id];
  const level = state.metaUpgrades[id];
  const cost = metaUpgradeCost(spec, level);
  const unlocked = isMetaUpgradeUnlocked(state.metaUpgrades, id);
  const maxed = level >= spec.maxLevel;
  const affordable = unlocked && state.knowledge >= cost && !maxed;
  const status = maxed ? 'maxed' : affordable ? 'affordable' : unlocked ? 'available' : 'locked';
  return { affordable, cost, level, maxed, status, unlocked };
}

function buyButtonText(view: NodeState): string {
  if (view.maxed) {
    return 'Maxed';
  }

  if (!view.unlocked) {
    return 'Locked';
  }

  if (!view.affordable) {
    return `Need ${view.cost}K`;
  }

  return `Buy ${view.cost}K`;
}

function graphPoint(id: MetaUpgradeId): { x: number; y: number } {
  const position = nodePositions[id];
  return {
    x: position.x + originX,
    y: position.y + originY,
  };
}

function escapeHtml(value: string): string {
  const element = document.createElement('div');
  element.textContent = value;
  return element.innerHTML;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
