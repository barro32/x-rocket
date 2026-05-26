import type { ReactNode } from 'react';
import { categoryColors, categoryLabels, diceCategories } from '../sim/categories';
import type { CardSpec, DiceCategory, GameState } from '../sim/types';
import { cardEffectRows, EffectRows } from './effectRowsView';

type DiceGridState = Pick<GameState, 'dice' | 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'>;

interface DiceGridProps {
  state: DiceGridState;
  compareTo?: DiceGridState;
  showRunEffects?: boolean;
  previewCard?: CardSpec;
}

interface DieModifier {
  value: string;
  preview: boolean;
}

export function DiceGrid({ state, compareTo, showRunEffects = true, previewCard }: DiceGridProps): ReactNode {
  return (
    <>
      <div className="dice-grid">
        {diceCategories.map((category) => {
          const die = state.dice[category];
          return (
            <div
              className="dice-row stat-themed"
              key={category}
              style={{ '--stat-color': categoryColors[category] } as React.CSSProperties}
            >
              <span>{categoryLabels[category]}</span>
              <div className="dice-list">
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
    <div className="die">
      <span className="die-faces">
        {faces.map((face, faceIndex) => {
          const beforeFace = compareDie?.faces[faceIndex];
          const changed = beforeFace !== undefined && beforeFace !== face;
          const direction = beforeFace !== undefined && face > beforeFace ? 'positive' : 'negative';
          return (
            <span className={`die-face ${changed ? `changed ${direction}` : ''}`} key={faceIndex}>
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
    return <span className="die-modifiers empty" />;
  }

  return (
    <span className="die-modifiers">
      {modifiers.map((modifier, index) => (
        <span className={modifierClass(modifier)} key={`${modifier.value}-${index}`}>
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
    return <div className="run-effects"><span>-</span></div>;
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
    return 'multiplier';
  }

  if (modifier.value.startsWith('-')) {
    return 'negative';
  }

  return modifier.preview ? 'preview' : '';
}
