import Phaser from 'phaser';
import { buyMetaNode, canBuyMetaNode, metaNodeById } from '../sim/meta';
import { claimBankruptcyReward, chooseCard, createInitialState, isBankrupt, launchCost, milestones, restartRun, simulateLaunch, startingMoneyFor, startingTemporaryAutoRerollLowest } from '../sim/game';
import { applyCard, startingDice } from '../sim/dice';
import { unlockedCardPoolFor } from '../sim/cards';
import { clearSave, loadGame, saveGame } from '../sim/save';
import type { CardSpec, DiceCategory, GameState, MetaNodeId } from '../sim/types';
import { categoryColors, categoryLabels, diceCategories } from '../sim/categories';
import { renderDiceGrid } from './diceGridView';
import { escapeHtml, renderMetaGrid } from './metaGridView';
import { RocketView } from './RocketView';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private rocket!: RocketView;
  private ui!: HTMLDivElement;
  private busy = false;
  private showUnlockedCards = false;
  private rollingLaunch = false;
  private revealedRolls = Number.POSITIVE_INFINITY;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = loadGame();
    this.rocket = new RocketView(this);
    this.rocket.createWorld();
    this.ui = document.createElement('div');
    this.ui.className = 'game-ui';
    document.body.append(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ui.remove());
    this.render();
  }

  private async launch(): Promise<void> {
    if (this.busy || this.state.pendingCardChoices.length > 0 || isBankrupt(this.state)) {
      return;
    }

    this.busy = true;
    this.render();
    const next = simulateLaunch(this.state);
    this.state = next;
    saveGame(this.state);
    this.rollingLaunch = true;
    this.revealedRolls = 0;
    this.render();
    await delay(260);
    for (let index = 0; index < (next.lastLaunch?.roll.rolls.length ?? 0); index += 1) {
      this.revealedRolls = index + 1;
      this.render();
      await delay(360);
    }
    await delay(220);
    await this.rocket.animateLaunch(next.lastLaunch);
    this.rollingLaunch = false;
    this.revealedRolls = Number.POSITIVE_INFINITY;
    this.busy = false;
    this.render();
  }

  private render(): void {
    const bankrupt = isBankrupt(this.state);
    if (bankrupt && !this.state.bankruptcyRewardClaimed) {
      this.state = claimBankruptcyReward(this.state);
      saveGame(this.state);
    }

    this.ui.innerHTML = `
      <section class="top-panel">
        <div>
          <div class="label">Money</div>
          <strong>$${this.state.money}</strong>
        </div>
        <div>
          <div class="label">Launch Cost</div>
          <strong>$${launchCost}</strong>
        </div>
        <div>
          <div class="label">Meta</div>
          <strong>${this.state.metaCurrency}</strong>
        </div>
        <div>
          <div class="label">Best</div>
          <strong>${this.state.highestAltitudeMeters}m</strong>
        </div>
        <div class="menu">
          <button data-action="toggle-menu">Menu</button>
          <div class="menu-popover" hidden>
            <button data-action="show-unlocked-cards">Unlocked Cards</button>
            <button data-action="reset">Reset Save</button>
          </div>
        </div>
      </section>

      <section class="launch-panel">
        <button data-action="launch" ${this.busy || bankrupt || this.state.pendingCardChoices.length > 0 ? 'disabled' : ''}>Launch</button>
      </section>

      <section class="side-panel">
        <h2>Dice</h2>
        ${renderDiceGrid(this.state)}
        ${this.renderLastLaunch()}
      </section>

      ${this.state.pendingCardChoices.length > 0 && !this.rollingLaunch ? this.renderCards() : ''}
      ${this.showUnlockedCards ? this.renderUnlockedCards() : ''}

      <section class="meta-panel" ${bankrupt ? '' : 'hidden'}>
        <div class="meta-header">
          <h2>Meta Grid</h2>
          <button data-action="close-meta">Start Next Run</button>
        </div>
        <div class="meta-body">
          ${renderMetaGrid(this.state)}
          <div class="meta-preview" data-meta-preview>
            ${this.renderMetaPreview()}
          </div>
        </div>
      </section>
    `;

    this.bindUiEvents();
  }

  private bindUiEvents(): void {
    this.ui.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => {
      element.addEventListener('click', () => {
        const action = element.dataset.action;
        if (action === 'launch') {
          void this.launch();
        } else if (action === 'toggle-menu') {
          this.ui.querySelector('.menu-popover')?.toggleAttribute('hidden');
        } else if (action === 'show-unlocked-cards') {
          this.showUnlockedCards = true;
          this.render();
        } else if (action === 'close-unlocked-cards') {
          this.showUnlockedCards = false;
          this.render();
        } else if (action === 'close-meta') {
          this.state = restartRun(this.state);
          saveGame(this.state);
          this.render();
        } else if (action === 'restart') {
          this.state = restartRun(this.state);
          saveGame(this.state);
          this.render();
        } else if (action === 'reset') {
          clearSave();
          this.state = createInitialState();
          saveGame(this.state);
          this.render();
        }
      });
    });

    this.ui.querySelectorAll<HTMLElement>('[data-card]').forEach((element) => {
      const index = Number(element.dataset.card);
      element.addEventListener('mouseenter', () => this.updateCardPreview(index));
      element.addEventListener('focus', () => this.updateCardPreview(index));
      element.addEventListener('click', () => {
        this.state = chooseCard(this.state, index);
        saveGame(this.state);
        this.render();
      });
    });

    this.ui.querySelectorAll<HTMLElement>('[data-meta]').forEach((element) => {
      const id = element.dataset.meta;
      element.addEventListener('mouseenter', () => {
        if (id) {
          this.updateMetaPreview(id);
        }
      });
      element.addEventListener('focus', () => {
        if (id) {
          this.updateMetaPreview(id);
        }
      });
      element.addEventListener('click', () => {
        if (!id) {
          return;
        }
        this.state = buyMetaNode(this.state, id as MetaNodeId);
        saveGame(this.state);
        this.render();
      });
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          element.click();
        }
      });
    });
  }

  private renderLastLaunch(): string {
    const result = this.state.lastLaunch;
    if (!result) {
      return `
        <div class="launch-result empty">
          <h2>Launch Roll</h2>
          <p>-</p>
        </div>
      `;
    }
    const visibleCount = Math.min(this.revealedRolls, result.roll.rolls.length);
    const complete = visibleCount >= result.roll.rolls.length;

    return `
      <div class="launch-result ${this.rollingLaunch ? 'rolling' : ''}">
        <div class="launch-result-header">
          <h2>Launch Roll</h2>
          <strong>${complete ? `${result.heightMeters}m` : 'Rolling'}</strong>
        </div>
        <div class="roll-showcase">
          ${result.roll.rolls.map((roll, index) => {
            const revealed = index < visibleCount;
            const valueText = roll.rerolledFrom === undefined ? `${roll.value}` : `${roll.rerolledFrom}->${roll.value}`;
            return `
              <div class="roll-card stat-themed ${revealed ? 'revealed' : 'pending'} ${revealed && roll.value === 0 ? 'zero' : ''}" style="--stat-color: ${categoryColors[roll.category]}">
                <span>${categoryLabels[roll.category]}</span>
                <strong>${revealed ? valueText : '?'}</strong>
              </div>
            `;
          }).join('')}
        </div>
        ${complete ? `<p>${escapeHtml(result.message)}</p>` : ''}
        <div class="milestones">
          ${milestones.map((milestone) => `<span class="${this.state.runMilestoneClaims.includes(milestone) ? 'hit' : ''}">${milestone}m</span>`).join('')}
        </div>
      </div>
    `;
  }

  private renderCards(): string {
    return `
      <div class="modal-shade">
        <section class="card-picker">
          <h2>Choose an Upgrade</h2>
          <div class="card-picker-body">
            <div class="cards">
              ${this.state.pendingCardChoices.map((card, index) => `
                <button class="card ${card.rarity} ${statThemeClass(cardCategory(card))}" ${statThemeStyle(cardCategory(card))} data-card="${index}">
                  <em>${escapeHtml(card.rarity)}</em>
                  <strong>${escapeHtml(card.name)}</strong>
                  <span>${escapeHtml(card.description)}</span>
                </button>
              `).join('')}
            </div>
            <div class="card-preview" data-card-preview>
              ${this.renderCardPreview(0)}
            </div>
          </div>
          <p>${this.state.pendingCardAwards}</p>
        </section>
      </div>
    `;
  }

  private renderUnlockedCards(): string {
    const cards = unlockedCardPoolFor(this.state.boughtMetaNodes);
    return `
      <div class="modal-shade">
        <section class="card-library">
          <div class="card-library-header">
            <h2>Unlocked Cards</h2>
            <button data-action="close-unlocked-cards">Close</button>
          </div>
          <div class="card-library-list">
            ${cards.map((card) => `
              <article class="card-library-card ${card.rarity} ${statThemeClass(categoryFromId(card.id))}" ${statThemeStyle(categoryFromId(card.id))}>
                <div>
                  <em>${escapeHtml(card.rarity)}</em>
                  <strong>${escapeHtml(card.name)}</strong>
                  <span>${escapeHtml(card.description)}</span>
                </div>
                <small>${card.source === 'base' ? 'Base' : 'Meta'}</small>
              </article>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }

  private updateCardPreview(index: number): void {
    const preview = this.ui.querySelector<HTMLElement>('[data-card-preview]');
    if (!preview) {
      return;
    }
    preview.innerHTML = this.renderCardPreview(index);
  }

  private renderCardPreview(index: number): string {
    const card = this.state.pendingCardChoices[index];
    const after = card ? previewCardState(this.state, card) : this.state;

    return `
      <div class="preview-grid">
        <div>
          ${renderDiceGrid(after, { compareTo: this.state })}
        </div>
      </div>
    `;
  }

  private updateMetaPreview(id: MetaNodeId): void {
    const preview = this.ui.querySelector<HTMLElement>('[data-meta-preview]');
    if (!preview) {
      return;
    }
    preview.innerHTML = this.renderMetaPreview(id);
  }

  private renderMetaPreview(id?: MetaNodeId): string {
    const before = metaPreviewState(this.state.boughtMetaNodes);
    const buyable = id ? canBuyMetaNode(this.state, id) : false;
    const afterIds = id && buyable
      ? [...this.state.boughtMetaNodes, id]
      : this.state.boughtMetaNodes;
    const after = metaPreviewState(afterIds);
    const node = id ? metaNodeById[id] : undefined;
    const moneyChanged = before.money !== after.money;
    const owned = Boolean(id && this.state.boughtMetaNodes.includes(id));
    const status = node
      ? buyable ? 'Previewing next run' : owned ? 'Already owned' : 'Locked'
      : 'Hover a node to preview its effect.';

    return `
      <div class="meta-preview-summary">
        <h3>${node ? escapeHtml(node.label) : 'Select an upgrade'}</h3>
        <div class="meta-preview-money ${moneyChanged ? 'changed' : ''}">$${after.money}</div>
        <span>${status}</span>
      </div>
      ${renderDiceGrid(after, { compareTo: before })}
      ${node?.effect.type === 'unlockCard' && buyable ? `<div class="run-effects"><span>${escapeHtml(node.label)}</span></div>` : ''}
    `;
  }

}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cardCategory(card: CardSpec): DiceCategory | undefined {
  switch (card.effect.type) {
    case 'addFaceValue':
    case 'addRandomFaceValue':
    case 'addAllFaces':
    case 'multiplyStat':
    case 'categoryDelta':
      return card.effect.category;
    case 'addFaceValueToCategories':
    case 'autoRerollLowest':
    case 'doubleHighestRoll':
    case 'topBottomDelta':
      return undefined;
  }
}

function categoryFromId(id: string): DiceCategory | undefined {
  return diceCategories.find((category) => id.endsWith(`-${category}`));
}

function statThemeClass(category?: DiceCategory): string {
  return category ? 'stat-themed' : '';
}

function statThemeStyle(category?: DiceCategory): string {
  return category ? `style="--stat-color: ${categoryColors[category]}"` : '';
}

function previewCardState(state: GameState, card: CardSpec): GameState {
  return applyCard({
    ...state,
    runCards: [...state.runCards, card],
  }, card);
}

function metaPreviewState(boughtMetaNodes: MetaNodeId[]): Pick<GameState, 'dice' | 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'> & { money: number } {
  return {
    money: startingMoneyFor(boughtMetaNodes),
    dice: startingDice(boughtMetaNodes),
    runCards: [],
    autoRerollLowest: 0,
    temporaryAutoRerollLowest: startingTemporaryAutoRerollLowest(boughtMetaNodes),
  };
}
