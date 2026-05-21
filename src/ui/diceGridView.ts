import { categoryColors, categoryLabels, diceCategories } from '../sim/categories';
import type { CardSpec, DiceCategory, GameState } from '../sim/types';
import { escapeHtml } from './metaGridView';

type DiceGridState = Pick<GameState, 'dice' | 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'>;

interface DiceGridOptions {
  compareTo?: DiceGridState;
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
              ${renderDie(category, die.faces, options.compareTo)}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${renderRunEffects(state, options.compareTo)}
  `;
}

function renderDie(category: DiceCategory, faces: number[], compareTo?: DiceGridState): string {
  const compareDie = compareTo?.dice[category];

  return `
    <div class="die">
      <span class="die-faces">
        ${faces.map((face, faceIndex) => {
          const beforeFace = compareDie?.faces[faceIndex];
          const changed = beforeFace !== undefined && beforeFace !== face;
          return `<span class="die-face ${changed ? 'changed' : ''}">${face}</span>`;
        }).join('')}
      </span>
    </div>
  `;
}

function renderRunEffects(
  state: Pick<GameState, 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'>,
  compareTo?: Pick<GameState, 'runCards' | 'autoRerollLowest' | 'temporaryAutoRerollLowest'>,
): string {
  const effects = [
    ...(state.autoRerollLowest > 0 ? [{ label: `Auto lowest reroll x${state.autoRerollLowest}`, temporary: false }] : []),
    ...(state.temporaryAutoRerollLowest > 0 ? [{ label: `Reroll lowest x${state.temporaryAutoRerollLowest}`, temporary: true }] : []),
    ...state.runCards.flatMap((card) => rollEffectLabel(card).map((label) => ({ label, temporary: false }))),
  ];
  const previousEffects = compareTo ? [
    ...(compareTo.autoRerollLowest > 0 ? [`Auto lowest reroll x${compareTo.autoRerollLowest}`] : []),
    ...(compareTo.temporaryAutoRerollLowest > 0 ? [`Reroll lowest x${compareTo.temporaryAutoRerollLowest}`] : []),
    ...compareTo.runCards.flatMap((card) => rollEffectLabel(card)),
  ] : [];
  const previousCounts = effectCounts(previousEffects);

  if (effects.length === 0) {
    return '<div class="run-effects"><span>-</span></div>';
  }

  return `
    <div class="run-effects">
      ${effects.map((effect) => {
        const previousCount = previousCounts.get(effect.label) ?? 0;
        const changed = previousCount === 0;
        if (previousCount > 0) {
          previousCounts.set(effect.label, previousCount - 1);
        }
        return `<span class="${changed ? 'changed' : ''} ${effect.temporary ? 'temporary' : ''}">${escapeHtml(effect.label)}</span>`;
      }).join('')}
    </div>
  `;
}

function effectCounts(effects: string[]): Map<string, number> {
  return effects.reduce((counts, effect) => {
    counts.set(effect, (counts.get(effect) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function rollEffectLabel(card: CardSpec): string[] {
  switch (card.effect.type) {
    case 'doubleHighestRoll':
      return ['2x highest roll'];
    case 'categoryDelta':
      return [
        `${card.effect.amount >= 0 ? '+' : ''}${card.effect.amount} ${categoryLabels[card.effect.category]} roll`,
        ...card.effect.penaltyCategory && card.effect.penaltyAmount
          ? [`${card.effect.penaltyAmount >= 0 ? '+' : ''}${card.effect.penaltyAmount} ${categoryLabels[card.effect.penaltyCategory]} roll`]
          : [],
      ];
    case 'topBottomDelta':
      return [`+${card.effect.topAmount} highest roll`, `${card.effect.bottomAmount} lowest roll`];
    case 'multiplyStat':
      return [`x${card.effect.multiplier} ${categoryLabels[card.effect.category]} roll`];
    case 'addFaceValue':
    case 'addRandomFaceValue':
    case 'addFaceValueToCategories':
    case 'addAllFaces':
    case 'autoRerollLowest':
      return [];
  }
}
