import Phaser from 'phaser';
import { buyMetaNode, metaNodeById } from '../sim/meta';
import { claimBankruptcyReward, chooseCard, createInitialState, isBankrupt, launchCost, milestones, restartRun, simulateLaunch, startingMoneyFor } from '../sim/game';
import { applyCard, startingDice } from '../sim/dice';
import { clearSave, loadGame, parseSave, saveFileName, saveGame, serializeSave } from '../sim/save';
import type { CardSpec, GameState, MetaNodeId } from '../sim/types';
import { categoryLabels } from '../sim/categories';
import { renderDiceGrid } from './diceGridView';
import { renderMetaGrid } from './metaGridView';
import { RocketView } from './RocketView';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private rocket!: RocketView;
  private ui!: HTMLDivElement;
  private saveImportInput!: HTMLInputElement;
  private busy = false;

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
    this.saveImportInput = document.createElement('input');
    this.saveImportInput.type = 'file';
    this.saveImportInput.accept = 'application/json,.json';
    this.saveImportInput.hidden = true;
    document.body.append(this.saveImportInput);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ui.remove());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.saveImportInput.remove());
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
    await this.rocket.animateLaunch(next.lastLaunch);
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
        <button data-action="launch" ${this.busy || bankrupt || this.state.pendingCardChoices.length > 0 ? 'disabled' : ''}>Launch</button>
        <button data-action="meta">Meta</button>
        <button data-action="export-save">Export Save</button>
        <button data-action="import-save">Import Save</button>
      </section>

      <section class="side-panel">
        <h2>Dice</h2>
        ${renderDiceGrid(this.state)}
        ${this.renderLastLaunch()}
      </section>

      ${this.state.pendingCardChoices.length > 0 ? this.renderCards() : ''}
      ${bankrupt ? this.renderBankruptcy() : ''}

      <section class="meta-panel" hidden>
        <div class="meta-header">
          <h2>Meta Grid</h2>
          <button data-action="close-meta">Close</button>
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
        } else if (action === 'meta') {
          this.ui.querySelector('.meta-panel')?.removeAttribute('hidden');
        } else if (action === 'close-meta') {
          this.ui.querySelector('.meta-panel')?.setAttribute('hidden', '');
        } else if (action === 'restart') {
          this.state = restartRun(this.state);
          saveGame(this.state);
          this.render();
        } else if (action === 'reset') {
          clearSave();
          this.state = createInitialState();
          saveGame(this.state);
          this.render();
        } else if (action === 'export-save') {
          this.exportSave();
        } else if (action === 'import-save') {
          this.importSave();
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
        this.ui.querySelector('.meta-panel')?.removeAttribute('hidden');
      });
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          element.click();
        }
      });
    });
  }

  private exportSave(): void {
    const blob = new Blob([serializeSave(this.state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = saveFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private importSave(): void {
    this.saveImportInput.onchange = () => {
      const file = this.saveImportInput.files?.[0];
      this.saveImportInput.value = '';
      if (!file) {
        return;
      }

      void file.text().then((raw) => {
        this.state = parseSave(raw);
        saveGame(this.state);
        this.render();
      }).catch(() => {
        this.render();
      });
    };
    this.saveImportInput.click();
  }

  private renderLastLaunch(): string {
    const result = this.state.lastLaunch;
    if (!result) {
      return `
        <div class="roll-log empty">
          <h2>Roll Log</h2>
          <p>-</p>
        </div>
      `;
    }

    return `
      <div class="roll-log">
        <h2>Roll Log</h2>
        <p>${result.message}</p>
        <table>
          <thead><tr><th>Die</th><th>Value</th></tr></thead>
          <tbody>
            ${result.roll.rolls.map((roll) => `
              <tr>
                <td>${categoryLabels[roll.category]}</td>
                <td class="${roll.value === 0 ? 'zero' : ''}">${roll.rerolledFrom === undefined ? roll.value : `${roll.rerolledFrom}->${roll.value}`}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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
                <button class="card ${card.rarity}" data-card="${index}">
                  <em>${card.rarity}</em>
                  <strong>${card.name}</strong>
                  <span>${card.description}</span>
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
          <h3>Now</h3>
          ${renderDiceGrid(this.state)}
        </div>
        <div>
          <h3>After</h3>
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
    const afterIds = id && !this.state.boughtMetaNodes.includes(id)
      ? [...this.state.boughtMetaNodes, id]
      : this.state.boughtMetaNodes;
    const after = metaPreviewState(afterIds);
    const node = id ? metaNodeById[id] : undefined;

    return `
      <div class="preview-grid">
        <div>
          <h3>Now</h3>
          <div class="meta-preview-money">$${before.money}</div>
          ${renderDiceGrid(before)}
        </div>
        <div>
          <h3>After</h3>
          <div class="meta-preview-money">$${after.money}</div>
          ${renderDiceGrid(after, { compareTo: before })}
          ${node?.effect.type === 'unlockCard' ? `<div class="run-effects"><span>${node.label}</span></div>` : ''}
        </div>
      </div>
    `;
  }

  private renderBankruptcy(): string {
    return `
      <div class="bankruptcy">
        <strong>Bankrupt</strong>
        <span>+1 meta</span>
        <button data-action="meta">Open Meta</button>
        <button data-action="restart">Restart Run</button>
        <button data-action="reset">Reset Save</button>
      </div>
    `;
  }
}

function previewCardState(state: GameState, card: CardSpec): GameState {
  return applyCard({
    ...state,
    runCards: [...state.runCards, card],
  }, card);
}

function metaPreviewState(boughtMetaNodes: MetaNodeId[]): Pick<GameState, 'dice' | 'runCards' | 'autoRerollLowest'> & { money: number } {
  return {
    money: startingMoneyFor(boughtMetaNodes),
    dice: startingDice(boughtMetaNodes),
    runCards: [],
    autoRerollLowest: 0,
  };
}
