import { isBankrupt } from '../../sim/game';
import { isMetaUpgradeUnlocked, metaUpgradeById, metaUpgradeCost, metaUpgradeSpecs } from '../../sim/metaUpgrades';
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
  private readonly detailsTitle: HTMLHeadingElement;
  private readonly detailsMeta: HTMLDivElement;
  private readonly detailsDescription: HTMLParagraphElement;
  private readonly detailsUnlocks: HTMLParagraphElement;
  private readonly detailsPrerequisites: HTMLDivElement;
  private readonly detailsStatus: HTMLDivElement;
  private readonly buyButton: HTMLButtonElement;
  private readonly continueButton: HTMLButtonElement;

  private currentState?: GameState;
  private selectedNodeId: MetaUpgradeId = 'blackBoxRecovery';
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartScrollLeft = 0;
  private panStartScrollTop = 0;

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
          </div>
          <aside class="meta-progress__details" aria-live="polite">
            <h3></h3>
            <div class="meta-progress__details-meta"></div>
            <p class="meta-progress__description"></p>
            <p class="meta-progress__unlocks"></p>
            <div class="meta-progress__prerequisites"></div>
            <div class="meta-progress__status"></div>
            <button class="meta-progress__buy" type="button">Buy Upgrade</button>
          </aside>
        </div>
      </section>
    `;

    app.append(this.root);

    this.knowledgeText = this.requireElement('.meta-progress__knowledge');
    this.graphElement = this.requireElement('.meta-progress__graph');
    this.graphSpacer = this.requireElement('.meta-progress__graph-spacer');
    this.graphSvg = this.requireElement('.meta-progress__links');
    this.nodesLayer = this.requireElement('.meta-progress__nodes');
    this.detailsTitle = this.requireElement('.meta-progress__details h3');
    this.detailsMeta = this.requireElement('.meta-progress__details-meta');
    this.detailsDescription = this.requireElement('.meta-progress__description');
    this.detailsUnlocks = this.requireElement('.meta-progress__unlocks');
    this.detailsPrerequisites = this.requireElement('.meta-progress__prerequisites');
    this.detailsStatus = this.requireElement('.meta-progress__status');
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
    this.buildGraph(config);
  }

  show(state: GameState): void {
    this.update(state);
    this.root.setAttribute('aria-hidden', 'false');
    this.root.classList.add('meta-progress--visible');
    requestAnimationFrame(() => this.centerOnNode('blackBoxRecovery'));
  }

  hide(): void {
    this.root.classList.remove('meta-progress--visible');
    window.setTimeout(() => this.root.setAttribute('aria-hidden', 'true'), 160);
  }

  update(state: GameState): void {
    this.currentState = state;
    this.knowledgeText.textContent = `Meta Knowledge: ${state.knowledge}`;
    this.continueButton.textContent = isBankrupt(state) ? 'Start Next Company' : 'Close';
    this.renderLinks(state);
    this.renderNodes(state);
    this.renderDetails();
  }

  private buildGraph(config: DomMetaProgressViewConfig): void {
    metaUpgradeSpecs.forEach((spec) => {
      const position = graphPoint(spec.id);
      const button = document.createElement('button');
      button.className = 'meta-node';
      button.type = 'button';
      button.dataset.nodeId = spec.id;
      button.style.left = `${position.x}px`;
      button.style.top = `${position.y}px`;
      button.addEventListener('mouseenter', () => this.selectNode(spec.id));
      button.addEventListener('focus', () => this.selectNode(spec.id));
      button.addEventListener('click', () => {
        this.selectNode(spec.id);
        if (this.currentState && nodeState(this.currentState, spec.id).affordable) {
          config.onBuy(spec.id);
        }
      });
      this.nodesLayer.append(button);
    });
  }

  private bindPanEvents(): void {
    this.graphElement.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('.meta-node')) {
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
    this.graphElement.scrollLeft = position.x - this.graphElement.clientWidth / 2;
    this.graphElement.scrollTop = position.y - this.graphElement.clientHeight / 2;
  }

  private renderLinks(state: GameState): void {
    this.graphSvg.replaceChildren();

    metaUpgradeSpecs.forEach((spec) => {
      const to = graphPoint(spec.id);
      (spec.prerequisites ?? []).forEach((prerequisite) => {
        const from = graphPoint(prerequisite);
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
      button.className = 'meta-node';
      button.classList.add(`meta-node--${view.status}`);
      if (id === this.selectedNodeId) {
        button.classList.add('meta-node--selected');
      }
      button.setAttribute('aria-disabled', `${!view.affordable}`);
      button.innerHTML = `
        <span class="meta-node__name">${escapeHtml(spec.name)}</span>
        <span class="meta-node__level">${view.level}/${spec.maxLevel}</span>
        <span class="meta-node__cost">${view.maxed ? 'MAX' : `${view.cost}K`}</span>
      `;
    });
  }

  private selectNode(id: MetaUpgradeId): void {
    this.selectedNodeId = id;
    if (this.currentState) {
      this.renderNodes(this.currentState);
      this.renderDetails();
    }
  }

  private renderDetails(): void {
    if (!this.currentState) {
      return;
    }

    const spec = metaUpgradeById[this.selectedNodeId];
    const view = nodeState(this.currentState, this.selectedNodeId);
    const prerequisites = (spec.prerequisites ?? []).map((id) => metaUpgradeById[id].name).join(', ') || 'None';

    this.detailsTitle.textContent = spec.name;
    this.detailsMeta.textContent = `Level ${view.level}/${spec.maxLevel}`;
    this.detailsDescription.textContent = spec.description;
    this.detailsUnlocks.textContent = spec.unlocks;
    this.detailsPrerequisites.textContent = `Prerequisites: ${prerequisites}`;
    this.detailsStatus.textContent = statusText(view);
    this.detailsStatus.dataset.status = view.status;
    this.buyButton.disabled = !view.affordable;
    this.buyButton.textContent = view.maxed ? 'Maxed' : `Buy for ${view.cost}K`;
  }

  private requireElement<T extends HTMLElement | SVGSVGElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing DOM meta element: ${selector}`);
    }
    return element;
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

function statusText(view: NodeState): string {
  if (view.maxed) {
    return 'Status: MAX';
  }

  if (!view.unlocked) {
    return 'Status: Locked';
  }

  if (view.affordable) {
    return `Status: Buy now for ${view.cost}K`;
  }

  return `Status: Need ${view.cost}K`;
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
