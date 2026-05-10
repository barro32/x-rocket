import type { LaunchResult, LessonSpec, RocketStats, RolledRocketStats } from '../../sim/types';

interface DomUiViewConfig {
  onPrimary: () => void;
  onMeta: () => void;
  onMenuReset: () => void;
}

interface UiState {
  money: number;
  launchCost: number;
  bankrupt: boolean;
  locked: boolean;
  stats: RocketStats;
}

interface LessonCardModel {
  spec: LessonSpec;
  effectText: string;
}

const animationMs = {
  cardsEnter: 420,
  cardsExit: 260,
  summaryEnter: 240,
  menu: 160,
};

export class DomUiView {
  private readonly root: HTMLDivElement;
  private readonly moneyText: HTMLDivElement;
  private readonly statsText: HTMLDivElement;
  private readonly primaryButton: HTMLButtonElement;
  private readonly metaButton: HTMLButtonElement;
  private readonly menuButton: HTMLButtonElement;
  private readonly cardLayer: HTMLDivElement;
  private readonly menuLayer: HTMLDivElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly closeMenuButton: HTMLButtonElement;

  private launchRollFrame?: number;
  private launchRollActive = false;
  private currentStats?: RocketStats;

  constructor(config: DomUiViewConfig) {
    const app = document.querySelector<HTMLDivElement>('#app');
    if (!app) {
      throw new Error('Missing #app root for DOM UI');
    }

    this.root = document.createElement('div');
    this.root.className = 'game-ui';
    this.root.innerHTML = `
      <div class="hud" aria-label="Game status">
        <div class="hud__money"></div>
        <div class="hud__stats"></div>
        <div class="hud__actions">
          <button class="hud__icon-button hud__meta" type="button">Meta</button>
          <button class="hud__icon-button hud__menu" type="button">Menu</button>
        </div>
        <button class="hud__primary" type="button"></button>
      </div>
      <div class="card-layer" aria-live="polite"></div>
      <div class="dom-menu" aria-hidden="true">
        <div class="dom-menu__backdrop"></div>
        <section class="dom-menu__panel" aria-label="Menu">
          <h2>Menu</h2>
          <button class="dom-menu__reset" type="button">Reset Game</button>
          <button class="dom-menu__close" type="button">Close</button>
        </section>
      </div>
    `;

    app.append(this.root);

    this.moneyText = this.requireElement('.hud__money');
    this.statsText = this.requireElement('.hud__stats');
    this.primaryButton = this.requireElement('.hud__primary');
    this.metaButton = this.requireElement('.hud__meta');
    this.menuButton = this.requireElement('.hud__menu');
    this.cardLayer = this.requireElement('.card-layer');
    this.menuLayer = this.requireElement('.dom-menu');
    this.resetButton = this.requireElement('.dom-menu__reset');
    this.closeMenuButton = this.requireElement('.dom-menu__close');

    this.primaryButton.addEventListener('click', config.onPrimary);
    this.metaButton.addEventListener('click', config.onMeta);
    this.menuButton.addEventListener('click', () => this.showMenu());
    this.resetButton.addEventListener('click', () => config.onMenuReset());
    this.closeMenuButton.addEventListener('click', () => this.hideMenu());
    this.menuLayer.querySelector('.dom-menu__backdrop')?.addEventListener('click', () => this.hideMenu());
  }

  update(state: UiState): void {
    this.currentStats = state.stats;
    this.moneyText.textContent = `$${state.money}`;
    if (!this.launchRollActive) {
      this.renderStats(state.stats);
    }
    this.primaryButton.textContent = state.bankrupt ? 'Bankruptcy Review' : `Launch $${state.launchCost}`;
    this.primaryButton.disabled = state.locked;
    this.metaButton.disabled = state.locked;
  }

  beginLaunchRoll(reliability: number): void {
    this.stopLaunchRoll();
    this.launchRollActive = true;
    this.renderRolledStats({ thrust: 0, fuel: 0, aerodynamics: 0, lightness: 0, guidance: 0 }, reliability);
  }

  animateLaunchRoll(target: RolledRocketStats, reliability: number, duration: number): void {
    this.stopLaunchRoll();
    this.launchRollActive = true;
    const startedAt = performance.now();

    const tick = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / Math.max(1, duration));
      const eased = 1 - Math.pow(1 - progress, 2);
      this.renderRolledStats({
        thrust: Math.floor(target.thrust * eased),
        fuel: Math.floor(target.fuel * eased),
        aerodynamics: Math.floor(target.aerodynamics * eased),
        lightness: Math.floor(target.lightness * eased),
        guidance: Math.floor(target.guidance * eased),
      }, reliability);

      if (progress < 1) {
        this.launchRollFrame = requestAnimationFrame(tick);
      } else {
        this.renderRolledStats(target, reliability);
        this.launchRollFrame = undefined;
      }
    };

    this.launchRollFrame = requestAnimationFrame(tick);
  }

  endLaunchRoll(stats: RocketStats): void {
    this.stopLaunchRoll();
    this.launchRollActive = false;
    this.renderStats(stats);
  }

  async showLessonChoices(
    choices: LessonCardModel[],
    result: LaunchResult | undefined,
    onSelect: (index: number) => void,
  ): Promise<void> {
    this.destroyLessonChoices();
    this.cardLayer.classList.add('card-layer--active');

    if (result) {
      this.cardLayer.append(this.createLaunchSummary(result));
    }

    const cards = document.createElement('div');
    cards.className = 'lesson-cards';

    choices.forEach((choice, index) => {
      const card = this.createLessonCard(choice, index);
      card.addEventListener('click', () => onSelect(index));
      cards.append(card);
    });

    this.cardLayer.append(cards);
    await nextFrame();
    this.cardLayer.classList.add('card-layer--visible');
    await delay(Math.max(animationMs.cardsEnter, animationMs.summaryEnter));
  }

  async chooseLesson(index: number): Promise<void> {
    const cards = [...this.cardLayer.querySelectorAll<HTMLElement>('.lesson-card')];
    cards.forEach((card, cardIndex) => {
      card.tabIndex = -1;
      card.classList.add(cardIndex === index ? 'lesson-card--selected' : 'lesson-card--rejected');
      if (cardIndex !== index) {
        card.style.setProperty('--reject-x', `${cardIndex < index ? -1 : 1}`);
      }
    });
    this.cardLayer.querySelector('.launch-summary')?.classList.add('launch-summary--exit');
    await delay(animationMs.cardsExit);
    this.destroyLessonChoices();
  }

  destroyLessonChoices(): void {
    this.cardLayer.replaceChildren();
    this.cardLayer.classList.remove('card-layer--active', 'card-layer--visible');
  }

  showMenu(): void {
    this.menuLayer.setAttribute('aria-hidden', 'false');
    this.menuLayer.classList.add('dom-menu--visible');
  }

  hideMenu(): void {
    this.menuLayer.classList.remove('dom-menu--visible');
    window.setTimeout(() => this.menuLayer.setAttribute('aria-hidden', 'true'), animationMs.menu);
  }

  private createLaunchSummary(result: LaunchResult): HTMLElement {
    const summary = document.createElement('section');
    summary.className = `launch-summary launch-summary--${result.outcome}`;
    summary.innerHTML = `
      <div class="launch-summary__title">${escapeHtml(titleFor(result))}</div>
      <div class="launch-summary__altitude">Altitude: ${Math.max(0, Math.floor(result.altitudeMeters))} m</div>
      <p>${escapeHtml(result.message)}</p>
    `;
    return summary;
  }

  private createLessonCard(choice: LessonCardModel, index: number): HTMLButtonElement {
    const { spec } = choice;
    const card = document.createElement('button');
    card.className = `lesson-card lesson-card--${spec.id}`;
    card.type = 'button';
    card.style.setProperty('--card-index', `${index}`);
    card.innerHTML = `
      <span class="lesson-card__art" aria-hidden="true">
        <span class="lesson-card__glyph">${glyphFor(spec.id)}</span>
      </span>
      <span class="lesson-card__title">${escapeHtml(spec.name)}</span>
      <span class="lesson-card__description">${escapeHtml(spec.description)}</span>
      <span class="lesson-card__effect">${escapeHtml(choice.effectText)}</span>
    `;
    return card;
  }

  private renderStats(stats: RocketStats): void {
    this.statsText.textContent = `THR ${stats.thrust}  FUEL ${stats.fuel}  AERO ${stats.aerodynamics}  LIGHT ${stats.lightness}  GUIDE ${stats.guidance}  REL ${stats.reliability}`;
  }

  private renderRolledStats(rolledStats: RolledRocketStats, reliability: number): void {
    this.statsText.textContent = `THR ${rolledStats.thrust}  FUEL ${rolledStats.fuel}  AERO ${rolledStats.aerodynamics}  LIGHT ${rolledStats.lightness}  GUIDE ${rolledStats.guidance}  REL ${reliability}`;
  }

  private stopLaunchRoll(): void {
    if (this.launchRollFrame) {
      cancelAnimationFrame(this.launchRollFrame);
      this.launchRollFrame = undefined;
    }
  }

  private requireElement<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing DOM UI element: ${selector}`);
    }
    return element;
  }
}

function titleFor(result: LaunchResult): string {
  if (result.outcome === 'orbit') {
    return 'ORBIT REACHED';
  }

  if (result.outcome === 'exploded') {
    return result.failurePhase ? `EXPLOSION: ${result.failurePhase.toUpperCase()}` : 'EXPLOSION';
  }

  return result.failurePhase ? `FAILED: ${result.failurePhase.toUpperCase()}` : 'FLIGHT COMPLETE';
}

function glyphFor(id: LessonSpec['id']): string {
  switch (id) {
    case 'tuneEngineMix':
      return 'THR';
    case 'improveFuelFlow':
      return 'FUEL';
    case 'salvageUsefulParts':
      return 'SALV';
    case 'stabilizeFins':
      return 'GUIDE';
    case 'fairNoseCone':
      return 'AERO';
    case 'cutDeadWeight':
      return 'MASS';
    case 'standardizeAssembly':
      return 'PROC';
    case 'recruitSpecialist':
      return 'CREW';
    case 'documentEverything':
      return 'LOG';
    case 'reinforceFrame':
      return 'REL';
  }
}

function escapeHtml(value: string): string {
  const element = document.createElement('div');
  element.textContent = value;
  return element.innerHTML;
}

function delay(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
