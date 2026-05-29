import type { ReactNode } from 'react';
import { categoryColors, categoryLabels, diceCategories } from '../sim/categories';
import type { CardSpec, DiceCategory, GameState } from '../sim/types';
import { cardEffectRows, EffectRows } from './effectRowsView';

type DiceGridState = Pick<GameState, 'dice' | 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'>;

interface DiceGridProps {
  state: DiceGridState;
  categories?: DiceCategory[];
  compareTo?: DiceGridState;
  showRunEffects?: boolean;
  previewCard?: CardSpec;
}

interface DieModifier {
  value: string;
  preview: boolean;
}

export function DiceGrid({ state, categories = diceCategories, compareTo, showRunEffects = true, previewCard }: DiceGridProps): ReactNode {
  return (
    <>
      <div>
        {categories.map((category) => {
          const die = state.dice[category];
          return (
            <div
              className="stat-row grid grid-cols-[92px_1fr] gap-2 border-t border-[rgba(160,181,210,0.16)] py-2 pl-2"
              key={category}
              style={{ '--stat-color': categoryColors[category] } as React.CSSProperties}
            >
              <span>{categoryLabels[category]}</span>
              <div className="grid gap-[5px]">
                <DieFaces
                  category={category}
                  faces={die.faces}
                  compareTo={compareTo}
                  modifiers={modifierValues(category, state, compareTo, previewCard)}
                />
              </div>
            </div>
          );
        })}
      </div>
      {showRunEffects ? <RunEffects state={state} /> : null}
    </>
  );
}

function DieFaces({
  category,
  faces,
  compareTo,
  modifiers,
}: {
  category: DiceCategory;
  faces: number[];
  compareTo?: DiceGridState;
  modifiers: DieModifier[];
}): ReactNode {
  const compareDie = compareTo?.dice[category];
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex flex-wrap gap-[3px]">
        {faces.map((face, faceIndex) => {
          const beforeFace = compareDie?.faces[faceIndex];
          const changed = beforeFace !== undefined && beforeFace !== face;
          const direction = beforeFace !== undefined && face > beforeFace ? 'positive' : 'negative';
          return (
            <span className={dieFaceClass(changed, direction)} key={faceIndex}>
              {face}
            </span>
          );
        })}
      </span>
      <ModifierColumn modifiers={modifiers} />
    </div>
  );
}

function ModifierColumn({ modifiers }: { modifiers: DieModifier[] }): ReactNode {
  if (modifiers.length === 0) {
    return <span className="inline-flex min-w-11" />;
  }

  return (
    <span className="flex min-w-11 flex-wrap items-center gap-[3px]">
      {modifiers.map((modifier, index) => (
        <span className={`whitespace-nowrap rounded-full border px-1.5 py-0.5 font-mono text-[11px] font-extrabold ${modifierClass(modifier)}`} key={`${modifier.value}-${index}`}>
          {modifier.value}
        </span>
      ))}
    </span>
  );
}

function RunEffects({ state }: { state: DiceGridState }): ReactNode {
  const rows = [
    ...state.autoRerollLowest > 0
      ? [{ dice: 'Any', target: 'Lowest roll', value: `+${state.autoRerollLowest} ${state.autoRerollLowest === 1 ? 'reroll' : 'rerolls'}` }]
      : [],
    ...state.temporaryAutoRerollLowest > 0
      ? [{ dice: 'Any', target: 'Lowest roll', value: `+${state.temporaryAutoRerollLowest} temporary ${state.temporaryAutoRerollLowest === 1 ? 'reroll' : 'rerolls'}` }]
      : [],
    ...state.runCards.flatMap(rollEffectRows),
  ];

  if (rows.length === 0) {
    return <div className="flex flex-wrap gap-1.5 border-t border-[rgba(160,181,210,0.16)] pt-2"><span className="rounded-full border border-[rgba(160,181,210,0.24)] px-[7px] py-[3px] text-xs text-[#c8d6e8]">-</span></div>;
  }

  return <EffectRows rows={rows} compact />;
}

function rollEffectRows(card: CardSpec) {
  return cardEffectRows(card.effect).filter(() => {
    switch (card.effect.type) {
      case 'doubleHighestRoll':
      case 'categoryDelta':
      case 'topBottomDelta':
      case 'multiplyStat':
        return true;
      case 'addFaceValue':
      case 'addRandomFaceValue':
      case 'addFaceValueToCategories':
      case 'addAllFaces':
      case 'autoRerollLowest':
        return false;
    }
  });
}

function modifierValues(category: DiceCategory, state: DiceGridState, compareTo?: DiceGridState, previewCard?: CardSpec): DieModifier[] {
  const previousCardCounts = compareTo ? cardCounts(compareTo.runCards) : new Map<string, number>();
  const usedPreviousCardCounts = new Map<string, number>();
  const existing = state.runCards.flatMap((card) => {
    const previousCount = previousCardCounts.get(card.id) ?? 0;
    const usedCount = usedPreviousCardCounts.get(card.id) ?? 0;
    const preview = compareTo ? usedCount >= previousCount : false;
    usedPreviousCardCounts.set(card.id, usedCount + 1);
    return cardModifierValues(category, card, preview);
  });
  const preview = previewCard && !state.runCards.some((card) => card.id === previewCard.id)
    ? cardModifierValues(category, previewCard, true)
    : [];
  return [...existing, ...preview];
}

function cardCounts(cards: CardSpec[]): Map<string, number> {
  return cards.reduce((counts, card) => {
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function cardModifierValues(category: DiceCategory, card: CardSpec, preview: boolean): DieModifier[] {
  switch (card.effect.type) {
    case 'multiplyStat':
      return card.effect.category === category ? [{ value: `x${card.effect.multiplier}`, preview }] : [];
    case 'categoryDelta':
      return [
        ...card.effect.category === category ? [{ value: `${signed(card.effect.amount)} all`, preview }] : [],
        ...card.effect.penaltyCategory === category && card.effect.penaltyAmount !== undefined
          ? [{ value: `${signed(card.effect.penaltyAmount)} all`, preview }]
          : [],
      ];
    case 'addAllFaces':
      return card.effect.category === category ? [{ value: `${signed(card.effect.amount)} all`, preview }] : [];
    case 'addFaceValue':
    case 'addRandomFaceValue':
    case 'addFaceValueToCategories':
    case 'autoRerollLowest':
    case 'doubleHighestRoll':
    case 'topBottomDelta':
      return [];
  }
}

function signed(amount: number): string {
  return `${amount >= 0 ? '+' : ''}${amount}`;
}

function modifierClass(modifier: DieModifier): string {
  if (modifier.value.startsWith('x')) {
    return 'border-[rgba(142,246,197,0.48)] bg-[rgba(142,246,197,0.16)] text-rocket-green';
  }

  if (modifier.value.startsWith('-')) {
    return 'border-[rgba(255,90,95,0.48)] bg-[rgba(255,90,95,0.16)] text-[#ffb4b7]';
  }

  return modifier.preview
    ? 'border-[rgba(142,246,197,0.48)] bg-[rgba(142,246,197,0.16)] text-rocket-green'
    : 'border-[rgba(160,181,210,0.34)] bg-[rgba(160,181,210,0.14)] text-rocket-text';
}

function dieFaceClass(changed: boolean, direction: 'positive' | 'negative'): string {
  const base = 'inline-flex h-5 min-w-5 items-center justify-center rounded border border-[rgba(160,181,210,0.24)] bg-[rgba(216,226,240,0.08)] px-1 font-mono text-xs text-rocket-text';
  if (!changed) {
    return base;
  }

  return direction === 'positive'
    ? `${base} border-rocket-green bg-[rgba(142,246,197,0.18)] font-extrabold text-rocket-green`
    : `${base} border-rocket-red bg-[rgba(255,90,95,0.18)] font-extrabold text-[#ffb4b7]`;
}
