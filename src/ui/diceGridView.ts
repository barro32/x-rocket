import { categoryColors, categoryLabels, diceCategories } from '../sim/categories';
import type { CardSpec, DiceCategory, GameState } from '../sim/types';
import { cardEffectRows, renderEffectRows } from './effectRowsView';
import { escapeHtml } from './metaGridView';

type DiceGridState = Pick<GameState, 'dice' | 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'>;

interface DiceGridOptions {
  compareTo?: DiceGridState;
  showRunEffects?: boolean;
  previewCard?: CardSpec;
}

export function renderDiceGrid(state: DiceGridState, options: DiceGridOptions = {}): string {
  return `
    <div class="dice-grid">
      ${diceCategories.map((category) => {
        const die = state.dice[category];
        return `
          <div class="dice-row stat-themed" style="--stat-color: ${categoryColors[category]}">
            <span>${escapeHtml(categoryLabels[category])}</span>
            <div class="dice-list">
              ${renderDie(category, die.faces, options.compareTo, modifierValues(category, state, options.previewCard))}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${options.showRunEffects === false ? '' : renderRunEffects(state, options.compareTo)}
  `;
}

function renderDie(category: DiceCategory, faces: number[], compareTo: DiceGridState | undefined, modifiers: DieModifier[]): string {
  const compareDie = compareTo?.dice[category];
  const modifierColumn = renderModifierColumn(modifiers);

  if (compareDie && faces.some((face, faceIndex) => compareDie.faces[faceIndex] !== face)) {
    return `
      <div class="die">
        <span class="die-faces">
          ${faces.map((face, faceIndex) => {
            const beforeFace = compareDie.faces[faceIndex];
            const changed = beforeFace !== face;
            const direction = face > beforeFace ? 'positive' : 'negative';
            return `<span class="die-face ${changed ? `changed ${direction}` : ''}">${face}</span>`;
          }).join('')}
        </span>
        ${modifierColumn}
      </div>
    `;
  }

  return `
    <div class="die">
      <span class="die-faces">
        ${faces.map((face) => `<span class="die-face">${face}</span>`).join('')}
      </span>
      ${modifierColumn}
    </div>
  `;
}

function renderModifierColumn(modifiers: DieModifier[]): string {
  if (modifiers.length === 0) {
    return '<span class="die-modifiers empty"></span>';
  }

  return `
    <span class="die-modifiers">
      ${modifiers.map((modifier) => `<span class="${modifier.preview ? 'preview' : ''}">${escapeHtml(modifier.value)}</span>`).join('')}
    </span>
  `;
}

function renderRunEffects(
  state: Pick<GameState, 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'>,
  _compareTo?: Pick<GameState, 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'>,
): string {
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
    return '<div class="run-effects"><span>-</span></div>';
  }

  return renderEffectRows(rows, { compact: true });
}

function rollEffectRows(card: CardSpec) {
  return cardEffectRows(card.effect).filter((row) => {
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

interface DieModifier {
  value: string;
  preview: boolean;
}

function modifierValues(category: DiceCategory, state: DiceGridState, previewCard?: CardSpec): DieModifier[] {
  const existing = state.runCards.flatMap((card) => cardModifierValues(category, card, false));
  const preview = previewCard && !state.runCards.some((card) => card.id === previewCard.id)
    ? cardModifierValues(category, previewCard, true)
    : [];
  return [...existing, ...preview];
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
