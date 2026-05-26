import { useState, type ReactNode } from 'react';
import { buyMetaNode, canBuyMetaNode, metaNodeById } from '../sim/meta';
import { claimBankruptcyReward, chooseCard, createInitialState, isBankrupt, launchCost, restartRun, simulateLaunch, startingMoneyFor, startingTemporaryAutoRerollLowest } from '../sim/game';
import { applyCard, startingDice } from '../sim/dice';
import { unlockedCardPoolFor } from '../sim/cards';
import { clearSave, loadGame, saveGame } from '../sim/save';
import type { CardSpec, DiceCategory, GameState, LaunchResult, MetaNodeId, RollEvent } from '../sim/types';
import { categoryColors, categoryLabels } from '../sim/categories';
import { DiceGrid } from './diceGridView';
import { CardPoolSummary, CardSummary, MetaNodeSummary, RollOnlyCardSummary } from './effectRowsView';
import { MetaGrid, type ViewBox } from './metaGridView';

export function GameApp(): ReactNode {
  const [state, setState] = useState(loadInitialState);
  const [showUnlockedCards, setShowUnlockedCards] = useState(false);
  const [metaViewBox, setMetaViewBox] = useState<ViewBox | undefined>();
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [selectedMetaId, setSelectedMetaId] = useState<MetaNodeId | undefined>();
  const [suppressMetaClickUntil, setSuppressMetaClickUntil] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const bankrupt = isBankrupt(state);

  function updateState(next: GameState): void {
    const rewarded = applyBankruptcyReward(next);
    saveGame(rewarded);
    setState(rewarded);
  }

  function launch(): void {
    if (state.pendingCardChoices.length > 0 || bankrupt) {
      return;
    }

    updateState(simulateLaunch(state));
  }

  function reset(): void {
    clearSave();
    const next = createInitialState();
    saveGame(next);
    setMetaViewBox(undefined);
    setSelectedMetaId(undefined);
    setSelectedCardIndex(0);
    setState(next);
  }

  function restart(): void {
    setMetaViewBox(undefined);
    setSelectedMetaId(undefined);
    setSelectedCardIndex(0);
    updateState(restartRun(state));
  }

  function choosePendingCard(index: number): void {
    setSelectedCardIndex(0);
    updateState(chooseCard(state, index));
  }

  function buyNode(id: MetaNodeId): void {
    updateState(buyMetaNode(state, id));
  }

  return (
    <div className="game-ui">
      <section className="top-panel">
        <TopStat label="Money" value={`$${state.money}`} />
        <TopStat label="Launch Cost" value={`$${launchCost}`} />
        <TopStat label="Meta" value={state.metaCurrency} />
        <TopStat label="Best" value={`${state.highestAltitudeMeters}m`} />
        <div className="menu">
          <button onClick={() => setMenuOpen((open) => !open)}>Menu</button>
          <div className="menu-popover" hidden={!menuOpen}>
            <button onClick={() => setShowUnlockedCards(true)}>Unlocked Cards</button>
            <button onClick={reset}>Reset Save</button>
          </div>
        </div>
      </section>

      <main className="result-panel">
        <LaunchResultView state={state} />
      </main>

      <section className="launch-panel">
        <button onClick={launch} disabled={bankrupt || state.pendingCardChoices.length > 0}>Launch</button>
      </section>

      <section className="side-panel">
        <h2>Dice</h2>
        <DiceGrid state={state} />
      </section>

      {state.pendingCardChoices.length > 0 ? (
        <CardPicker
          state={state}
          selectedCardIndex={selectedCardIndex}
          onSelectCard={setSelectedCardIndex}
          onChooseCard={choosePendingCard}
        />
      ) : null}

      {showUnlockedCards ? <UnlockedCards state={state} onClose={() => setShowUnlockedCards(false)} /> : null}

      <section className="meta-panel" hidden={!bankrupt}>
        <div className="meta-header">
          <h2>Meta Grid</h2>
          <button onClick={restart}>Start Next Run</button>
        </div>
        <div className="meta-body">
          <MetaGrid
            state={state}
            viewBox={metaViewBox}
            suppressClickUntil={suppressMetaClickUntil}
            onBuyNode={buyNode}
            onHoverNode={setSelectedMetaId}
            onSuppressClickUntil={setSuppressMetaClickUntil}
            onViewBoxChange={setMetaViewBox}
          />
          <div className="meta-preview">
            <MetaPreview state={state} id={selectedMetaId} />
          </div>
        </div>
      </section>
    </div>
  );
}

function TopStat({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return (
    <div>
      <div className="label">{label}</div>
      <strong>{value}</strong>
    </div>
  );
}

function LaunchResultView({ state }: { state: GameState }): ReactNode {
  const result = state.lastLaunch;
  if (!result) {
    return (
      <section className="launch-result empty">
        <h1>X Rocket</h1>
        <p>Launch to roll your dice and apply active card modifiers.</p>
      </section>
    );
  }

  return (
    <section className="launch-result">
      <div className="launch-result-header">
        <div>
          <h1>Launch {state.launchCount}</h1>
          <p>{result.message}</p>
        </div>
        <strong>{result.heightMeters}m</strong>
      </div>
      <RollShowcase result={result} />
      <EventLog result={result} />
      <Milestones result={result} />
    </section>
  );
}

function RollShowcase({ result }: { result: LaunchResult }): ReactNode {
  return (
    <div className="roll-showcase">
      {result.roll.rolls.map((roll) => {
        const modifiers = [
          ...(roll.rerolledFrom !== undefined ? [`Reroll: ${roll.rerolledFrom} -> ${roll.value}`] : []),
          ...roll.modifiers.map((modifier) => `${modifier.label}: ${modifier.before} -> ${modifier.after}`),
        ];
        return (
          <article
            className={`roll-card revealed ${roll.value === 0 ? 'zero' : ''}`}
            key={roll.dieId}
            style={{ '--stat-color': categoryColors[roll.category] } as React.CSSProperties}
          >
            <span>{categoryLabels[roll.category]}</span>
            <strong>{roll.value}</strong>
            <div className="roll-breakdown">
              <span>Initial: {roll.initialValue}</span>
              {modifiers.map((modifier) => <span key={modifier}>{modifier}</span>)}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EventLog({ result }: { result: LaunchResult }): ReactNode {
  return (
    <table className="event-log">
      <thead>
        <tr>
          <th>Step</th>
          <th>Category</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {result.roll.events.map((event, index) => <EventRow event={event} step={index + 1} key={`${event.type}-${index}`} />)}
      </tbody>
    </table>
  );
}

function EventRow({ event, step }: { event: RollEvent; step: number }): ReactNode {
  const category = categoryLabels[event.category];
  if (event.type === 'initialRoll') {
    return (
      <tr>
        <td>{step}. Roll</td>
        <td>{category}</td>
        <td className={event.value === 0 ? 'zero' : ''}>{event.value}</td>
      </tr>
    );
  }

  if (event.type === 'reroll') {
    return (
      <tr>
        <td>{step}. Reroll lowest</td>
        <td>{category}</td>
        <td className={event.after === 0 ? 'zero' : ''}>{event.before} -&gt; {event.after}</td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{step}. {event.cardName}</td>
      <td>{category}</td>
      <td className={event.after === 0 ? 'zero' : ''}>{event.label}: {event.before} -&gt; {event.after}</td>
    </tr>
  );
}

function Milestones({ result }: { result: LaunchResult }): ReactNode {
  if (result.reachedRunMilestones.length === 0) {
    return null;
  }

  return (
    <div className="milestones">
      {result.reachedRunMilestones.map((milestone) => <span className="hit" key={milestone}>{milestone}m reached</span>)}
    </div>
  );
}

function CardPicker({
  state,
  selectedCardIndex,
  onSelectCard,
  onChooseCard,
}: {
  state: GameState;
  selectedCardIndex: number;
  onSelectCard: (index: number) => void;
  onChooseCard: (index: number) => void;
}): ReactNode {
  return (
    <div className="modal-shade">
      <section className="card-picker">
        <h2>Choose an Upgrade</h2>
        <div className="card-picker-body">
          <div className="cards">
            {state.pendingCardChoices.map((card, index) => (
              <button
                className={`card ${card.rarity} ${statThemeClass(cardCategories(card))}`}
                key={card.id}
                style={statThemeStyle(cardCategories(card))}
                onMouseEnter={() => onSelectCard(index)}
                onFocus={() => onSelectCard(index)}
                onClick={() => onChooseCard(index)}
              >
                <CardSummary card={card} />
              </button>
            ))}
          </div>
          <div className="card-preview">
            <CardPreview state={state} index={selectedCardIndex} />
          </div>
        </div>
      </section>
    </div>
  );
}

function UnlockedCards({ state, onClose }: { state: GameState; onClose: () => void }): ReactNode {
  const cards = unlockedCardPoolFor(state.boughtMetaNodes);
  return (
    <div className="modal-shade">
      <section className="card-library">
        <div className="card-library-header">
          <h2>Unlocked Cards</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="card-library-list">
          {cards.map((card) => (
            <article
              className={`card-library-card ${card.rarity} ${statThemeClass(card.affectedCategories)}`}
              key={card.id}
              style={statThemeStyle(card.affectedCategories)}
            >
              <div>
                <CardPoolSummary card={card} />
              </div>
              <small>{card.source === 'base' ? 'Base' : 'Meta'}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CardPreview({ state, index }: { state: GameState; index: number }): ReactNode {
  const card = state.pendingCardChoices[index];
  const after = card ? previewCardState(state, card) : state;
  return (
    <div className="preview-grid">
      <div>
        <DiceGrid state={after} compareTo={state} showRunEffects={false} previewCard={card} />
        {card ? <RollOnlyCardSummary card={card} /> : null}
      </div>
    </div>
  );
}

function MetaPreview({ state, id }: { state: GameState; id?: MetaNodeId }): ReactNode {
  const before = metaPreviewState(state.boughtMetaNodes);
  const buyable = id ? canBuyMetaNode(state, id) : false;
  const afterIds = id && buyable ? [...state.boughtMetaNodes, id] : state.boughtMetaNodes;
  const after = metaPreviewState(afterIds);
  const node = id ? metaNodeById[id] : undefined;
  const moneyChanged = before.money !== after.money;
  const owned = Boolean(id && state.boughtMetaNodes.includes(id));
  const status = node
    ? buyable ? 'Previewing next run' : owned ? 'Already owned' : 'Locked'
    : 'Hover a node to preview its effect.';

  return (
    <>
      <div className="meta-preview-summary">
        {node ? <MetaNodeSummary node={node} /> : <h3>Select an upgrade</h3>}
        <div className={`meta-preview-money ${moneyChanged ? 'changed' : ''}`}>${after.money}</div>
        <span>{status}</span>
      </div>
      <DiceGrid state={after} compareTo={before} showRunEffects={false} />
    </>
  );
}

function cardCategories(card: CardSpec): DiceCategory[] {
  if (card.affectedCategories) {
    return card.affectedCategories;
  }

  switch (card.effect.type) {
    case 'addFaceValue':
    case 'addRandomFaceValue':
    case 'addAllFaces':
    case 'multiplyStat':
      return [card.effect.category];
    case 'categoryDelta':
      return [
        card.effect.category,
        ...card.effect.penaltyCategory ? [card.effect.penaltyCategory] : [],
      ];
    case 'addFaceValueToCategories':
      return card.effect.categories;
    case 'autoRerollLowest':
    case 'doubleHighestRoll':
    case 'topBottomDelta':
      return [];
  }
}

function statThemeClass(categories: DiceCategory[]): string {
  return categories.length > 0 ? 'stat-themed' : '';
}

function statThemeStyle(categories: DiceCategory[]): React.CSSProperties | undefined {
  return categories.length > 0 ? ({ '--card-bg': cardBackground(categories) } as React.CSSProperties) : undefined;
}

function cardBackground(categories: DiceCategory[]): string {
  const layers = categories.map((category) => {
    const color = categoryColors[category];
    switch (category) {
      case 'thrusters':
        return `linear-gradient(45deg, color-mix(in srgb, ${color} 54%, transparent) 0%, transparent 56%)`;
      case 'fuel':
        return `linear-gradient(315deg, color-mix(in srgb, ${color} 50%, transparent) 0%, transparent 56%)`;
      case 'aerodynamics':
        return `linear-gradient(135deg, color-mix(in srgb, ${color} 50%, transparent) 0%, transparent 56%)`;
      case 'guidance':
        return `linear-gradient(225deg, color-mix(in srgb, ${color} 50%, transparent) 0%, transparent 56%)`;
      case 'weight':
        return `radial-gradient(circle at center, color-mix(in srgb, ${color} 45%, transparent) 0%, transparent 58%)`;
    }
  });

  return [...layers, '#17263d'].join(', ');
}

function previewCardState(state: GameState, card: CardSpec): GameState {
  const after = applyCard({ ...state, runCards: [...state.runCards, card] }, card);

  if (card.effect.type !== 'categoryDelta') {
    return after;
  }

  const effect = card.effect;
  const dice = Object.fromEntries(
    Object.entries(after.dice).map(([category, die]) => [category, { ...die, faces: [...die.faces] }]),
  ) as GameState['dice'];

  dice[effect.category].faces = dice[effect.category].faces.map((face) => face + effect.amount);

  const penaltyAmount = effect.penaltyAmount;
  if (effect.penaltyCategory && penaltyAmount !== undefined) {
    dice[effect.penaltyCategory].faces = dice[effect.penaltyCategory].faces.map((face) => face + penaltyAmount);
  }

  return { ...after, dice };
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

function loadInitialState(): GameState {
  const state = applyBankruptcyReward(loadGame());
  saveGame(state);
  return state;
}

function applyBankruptcyReward(state: GameState): GameState {
  if (!isBankrupt(state) || state.bankruptcyRewardClaimed) {
    return state;
  }

  return claimBankruptcyReward(state);
}
