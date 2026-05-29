import { useState, type ReactNode } from 'react';
import { buyMetaNode, canBuyMetaNode, metaNodeById } from '../sim/meta';
import { claimBankruptcyReward, chooseCard, createInitialState, isBankrupt, launchCost, restartRun, simulateLaunch, startingMoneyFor, startingTemporaryAutoRerollLowest } from '../sim/game';
import { applyCard, startingDice } from '../sim/dice';
import { unlockedCardPoolFor } from '../sim/cards';
import { clearSave, loadGame, saveGame } from '../sim/save';
import type { CardSpec, DiceCategory, GameState, LaunchResult, MetaNodeId, RollEvent } from '../sim/types';
import { activeDiceCategoriesFor, categoryColors, categoryLabels } from '../sim/categories';
import { DiceGrid } from './diceGridView';
import { CardPoolSummary, CardSummary, MetaNodeSummary, RollOnlyCardSummary } from './effectRowsView';
import { MetaGrid, type ViewBox } from './metaGridView';

export function GameApp(): ReactNode {
  const [state, setState] = useState(loadInitialState);
  const [showUnlockedCards, setShowUnlockedCards] = useState(false);
  const [metaViewBox, setMetaViewBox] = useState<ViewBox | undefined>();
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [selectedMetaId, setSelectedMetaId] = useState<MetaNodeId | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const bankrupt = isBankrupt(state);
  const activeCategories = activeDiceCategoriesFor(state.boughtMetaNodes);

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
    <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(11,16,32,0.72),rgba(11,16,32,0.94)),radial-gradient(circle_at_50%_28%,rgba(95,179,179,0.16),transparent_34%),#0b1020]">
      <section className="absolute inset-x-0 top-0 flex min-h-[76px] items-center gap-4 border-b border-[rgba(160,181,210,0.25)] bg-[rgba(12,19,34,0.9)] px-[22px] py-3 max-[860px]:flex-wrap">
        <TopStat label="Money" value={`$${state.money}`} />
        <TopStat label="Launch Cost" value={`$${launchCost}`} />
        <TopStat label="Meta" value={state.metaCurrency} />
        <TopStat label="Best" value={`${state.highestAltitudeMeters}m`} />
        <div className="pointer-events-auto relative ml-auto">
          <button onClick={() => setMenuOpen((open) => !open)}>Menu</button>
          <div className="absolute right-0 top-[calc(100%+8px)] z-2 w-40 rounded-lg border border-[rgba(160,181,210,0.35)] bg-rocket-panel p-2" hidden={!menuOpen}>
            <button className="w-full" onClick={() => setShowUnlockedCards(true)}>Unlocked Cards</button>
            <button className="mt-1.5 w-full" onClick={reset}>Reset Save</button>
          </div>
        </div>
      </section>

      <main className="pointer-events-auto absolute left-7 right-[402px] top-24 max-[860px]:left-3 max-[860px]:right-3 max-[860px]:top-[136px]">
        <LaunchResultView state={state} />
      </main>

      <section className="pointer-events-auto absolute bottom-7 left-1/2 -translate-x-1/2 max-[860px]:bottom-4">
        <button className="min-h-[54px] min-w-45 border-rocket-gold text-xl shadow-[0_10px_34px_rgba(0,0,0,0.35)]" onClick={launch} disabled={bankrupt || state.pendingCardChoices.length > 0}>Launch</button>
      </section>

      <section className="pointer-events-auto absolute right-[18px] top-24 max-h-[calc(100vh-116px)] w-[360px] overflow-auto rounded-lg border border-[rgba(160,181,210,0.25)] bg-[rgba(12,19,34,0.88)] p-3.5 max-[860px]:left-3 max-[860px]:right-3 max-[860px]:top-[420px] max-[860px]:w-auto">
        <h2>Dice</h2>
        <DiceGrid state={state} categories={activeCategories} />
      </section>

      {state.pendingCardChoices.length > 0 ? (
        <CardPicker
          state={state}
          activeCategories={activeCategories}
          selectedCardIndex={selectedCardIndex}
          onSelectCard={setSelectedCardIndex}
          onChooseCard={choosePendingCard}
        />
      ) : null}

      {showUnlockedCards ? <UnlockedCards state={state} onClose={() => setShowUnlockedCards(false)} /> : null}

      <section className="pointer-events-auto fixed inset-0 flex flex-col items-stretch justify-start bg-[rgba(5,9,16,0.86)] px-7 pb-7 pt-[72px] text-rocket-text" hidden={!bankrupt}>
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between">
          <h2>Meta Grid</h2>
          <button onClick={restart}>Start Next Run</button>
        </div>
        <div className="mx-auto mt-[18px] grid min-h-0 w-full max-w-[1540px] grid-cols-[minmax(560px,1fr)_minmax(360px,460px)] gap-[22px] max-[860px]:grid-cols-1">
          <MetaGrid
            state={state}
            viewBox={metaViewBox}
            onBuyNode={buyNode}
            onHoverNode={setSelectedMetaId}
            onViewBoxChange={setMetaViewBox}
          />
          <div className="max-h-[min(720px,calc(100vh-142px))] overflow-auto rounded-lg border border-[rgba(160,181,210,0.24)] bg-[rgba(12,19,34,0.86)] p-[18px] max-[860px]:max-h-[280px]">
            <MetaPreview state={state} id={selectedMetaId} />
          </div>
        </div>
      </section>
    </div>
  );
}

function TopStat({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return (
    <div className="min-w-[86px]">
      <div className="text-xs uppercase tracking-normal text-rocket-muted">{label}</div>
      <strong className="text-2xl">{value}</strong>
    </div>
  );
}

function LaunchResultView({ state }: { state: GameState }): ReactNode {
  const result = state.lastLaunch;
  if (!result) {
    return (
      <section className="max-w-[860px] rounded-lg border border-[rgba(160,181,210,0.22)] bg-[rgba(12,19,34,0.74)] p-[18px]">
        <h1>X Rocket</h1>
        <p className="m-0 mb-2.5 text-[#c8d6e8]">Launch to roll your dice and apply active card modifiers.</p>
      </section>
    );
  }

  return (
    <section className="max-w-[860px] rounded-lg border border-[rgba(160,181,210,0.22)] bg-[rgba(12,19,34,0.74)] p-[18px]">
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <h1 className="m-0 text-[28px]">Launch {state.launchCount}</h1>
          <p className="m-0 mb-2.5 text-[#c8d6e8]">{result.message}</p>
        </div>
        <strong className="text-2xl text-[#ffe4a6]">{result.heightMeters}m</strong>
      </div>
      <RollShowcase result={result} />
      <EventLog result={result} />
      <Milestones result={result} />
    </section>
  );
}

function RollShowcase({ result }: { result: LaunchResult }): ReactNode {
  return (
    <div className="mb-3 grid grid-cols-5 gap-2 max-[860px]:grid-cols-2">
      {result.roll.rolls.map((roll) => {
        const modifiers = [
          ...(roll.rerolledFrom !== undefined ? [`Reroll: ${roll.rerolledFrom} -> ${roll.value}`] : []),
          ...roll.modifiers.map((modifier) => `${modifier.label}: ${modifier.before} -> ${modifier.after}`),
        ];
        return (
          <article
            className={`roll-card aspect-square min-h-0 -translate-y-0.5 rounded-md border p-2 flex flex-col items-center justify-center transition ${roll.value === 0 ? 'border-rocket-red bg-[rgba(255,90,95,0.24)]' : ''}`}
            key={roll.dieId}
            style={{ '--stat-color': categoryColors[roll.category] } as React.CSSProperties}
          >
            <span>{categoryLabels[roll.category]}</span>
            <strong className={`font-mono text-[34px] leading-none ${roll.value === 0 ? 'text-[#ffb4b7]' : 'text-white'}`}>{roll.value}</strong>
            <div className="mt-[7px] flex min-h-8 flex-wrap items-center justify-center gap-[3px]">
              <span className="roll-breakdown-chip whitespace-nowrap rounded border px-1 py-[3px] text-center text-[9px] font-extrabold leading-none">Initial: {roll.initialValue}</span>
              {modifiers.map((modifier) => <span className="roll-breakdown-chip whitespace-nowrap rounded border px-1 py-[3px] text-center text-[9px] font-extrabold leading-none" key={modifier}>{modifier}</span>)}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EventLog({ result }: { result: LaunchResult }): ReactNode {
  return (
    <table className="mt-3">
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
        <td className={event.value === 0 ? 'font-extrabold text-[#ff776d]' : ''}>{event.value}</td>
      </tr>
    );
  }

  if (event.type === 'reroll') {
    return (
      <tr>
        <td>{step}. Reroll lowest</td>
        <td>{category}</td>
        <td className={event.after === 0 ? 'font-extrabold text-[#ff776d]' : ''}>{event.before} -&gt; {event.after}</td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{step}. {event.cardName}</td>
      <td>{category}</td>
      <td className={event.after === 0 ? 'font-extrabold text-[#ff776d]' : ''}>{event.label}: {event.before} -&gt; {event.after}</td>
    </tr>
  );
}

function Milestones({ result }: { result: LaunchResult }): ReactNode {
  if (result.reachedRunMilestones.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {result.reachedRunMilestones.map((milestone) => <span className="rounded-full border border-rocket-green bg-rocket-green px-2 py-1 text-rocket-bg" key={milestone}>{milestone}m reached</span>)}
    </div>
  );
}

function CardPicker({
  state,
  activeCategories,
  selectedCardIndex,
  onSelectCard,
  onChooseCard,
}: {
  state: GameState;
  activeCategories: DiceCategory[];
  selectedCardIndex: number;
  onSelectCard: (index: number) => void;
  onChooseCard: (index: number) => void;
}): ReactNode {
  return (
    <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[rgba(5,9,16,0.72)]">
      <section className="w-[min(1120px,calc(100vw-36px))] rounded-lg border border-[rgba(160,181,210,0.35)] bg-rocket-panel p-[22px] text-rocket-text">
        <h2>Choose an Upgrade</h2>
        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] gap-[18px] max-[860px]:grid-cols-1">
          <div className="grid grid-cols-3 gap-3.5 max-[860px]:grid-cols-1">
            {state.pendingCardChoices.map((card, index) => (
              <button
                className={`flex min-h-[170px] min-w-0 flex-col items-start rounded-md border bg-rocket-panel-soft p-2.5 text-left text-rocket-text ${rarityClass(card.rarity)} ${statThemeClass(cardCategories(card))}`}
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
          <div className="rounded-lg border border-[rgba(160,181,210,0.24)] bg-[rgba(12,19,34,0.72)] p-3.5">
            <CardPreview state={state} activeCategories={activeCategories} index={selectedCardIndex} />
          </div>
        </div>
      </section>
    </div>
  );
}

function UnlockedCards({ state, onClose }: { state: GameState; onClose: () => void }): ReactNode {
  const cards = unlockedCardPoolFor(state.boughtMetaNodes);
  return (
    <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[rgba(5,9,16,0.72)]">
      <section className="max-h-[min(760px,calc(100vh-36px))] w-[min(980px,calc(100vw-36px))] overflow-auto rounded-lg border border-[rgba(160,181,210,0.35)] bg-rocket-panel p-[22px] text-rocket-text">
        <div className="mb-4 flex items-center justify-between">
          <h2>Unlocked Cards</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 max-[860px]:grid-cols-1">
          {cards.map((card) => (
            <article
              className={`flex min-h-24 items-start justify-between gap-3 rounded-lg border bg-rocket-panel-soft p-3 ${rarityClass(card.rarity)} ${statThemeClass(card.affectedCategories)}`}
              key={card.id}
              style={statThemeStyle(card.affectedCategories)}
            >
              <div>
                <CardPoolSummary card={card} />
              </div>
              <small className="shrink-0 rounded-full border border-[rgba(160,181,210,0.24)] px-2 py-[3px] text-[11px] text-[#c8d6e8]">{card.source === 'base' ? 'Base' : 'Meta'}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CardPreview({ state, activeCategories, index }: { state: GameState; activeCategories: DiceCategory[]; index: number }): ReactNode {
  const card = state.pendingCardChoices[index];
  const after = card ? previewCardState(state, card) : state;
  return (
    <div className="grid grid-cols-1 gap-3">
      <div>
        <DiceGrid state={after} categories={activeCategories} compareTo={state} showRunEffects={false} previewCard={card} />
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
  const afterCategories = activeDiceCategoriesFor(afterIds);
  const node = id ? metaNodeById[id] : undefined;
  const moneyChanged = before.money !== after.money;
  const owned = Boolean(id && state.boughtMetaNodes.includes(id));
  const status = node
    ? buyable ? 'Previewing next run' : owned ? 'Already owned' : 'Locked'
    : 'Hover a node to preview its effect.';

  return (
    <>
      <div className="mb-3 border-b border-[rgba(160,181,210,0.16)] pb-3.5">
        {node ? <MetaNodeSummary node={node} /> : <h3>Select an upgrade</h3>}
        <div className={`text-[28px] font-extrabold ${moneyChanged ? 'text-[#ffe4a6]' : 'text-rocket-text'}`}>${after.money}</div>
        <span className="mt-1 block text-[13px] text-rocket-muted">{status}</span>
      </div>
      <DiceGrid state={after} categories={afterCategories} compareTo={before} showRunEffects={false} />
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
  return categories.length > 0 ? 'stat-surface' : '';
}

function statThemeStyle(categories: DiceCategory[]): React.CSSProperties | undefined {
  return categories.length > 0 ? ({ '--card-bg': cardBackground(categories) } as React.CSSProperties) : undefined;
}

function rarityClass(rarity: CardSpec['rarity']): string {
  switch (rarity) {
    case 'common':
      return 'border-[#647892]';
    case 'uncommon':
      return 'border-2 border-rocket-green';
    case 'rare':
      return 'border-[3px] border-rocket-gold';
  }
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
