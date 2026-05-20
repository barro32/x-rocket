import { categoryLabels, diceCategories } from '../sim/categories';
import type { CardSpec, DiceCategory, GameState } from '../sim/types';

type DiceGridState = Pick<GameState, 'dice' | 'runCards' | 'autoRerollLowest'>;

interface DiceGridOptions {
  compareTo?: DiceGridState;
}

export function renderDiceGrid(state: DiceGridState, options: DiceGridOptions = {}): string {
  return `
    <div class="dice-grid">
      ${diceCategories.map((category) => {
        const dice = state.dice[category];
        return `
          <div class="dice-row">
            <span>${categoryLabels[category]}</span>
            <div class="dice-list">
              ${dice.map((die, dieIndex) => renderDie(category, dieIndex, die.faces, options.compareTo)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${renderRunEffects(state)}
  `;
}

function renderDie(category: DiceCategory, dieIndex: number, faces: number[], compareTo?: DiceGridState): string {
  const compareDie = compareTo?.dice[category][dieIndex];
  const isNewDie = compareTo !== undefined && compareDie === undefined;

  return `
    <div class="die ${isNewDie ? 'new' : ''}">
      <span class="die-label">D${dieIndex + 1}</span>
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

function renderRunEffects(state: Pick<GameState, 'runCards' | 'autoRerollLowest'>): string {
  const effects = [
    ...(state.autoRerollLowest > 0 ? [`Auto lowest reroll x${state.autoRerollLowest}`] : []),
    ...state.runCards.flatMap((card) => rollEffectLabel(card)),
  ];

  if (effects.length === 0) {
    return '<div class="run-effects"><span>-</span></div>';
  }

  return `
    <div class="run-effects">
      ${effects.map((effect) => `<span>${effect}</span>`).join('')}
    </div>
  `;
}

function rollEffectLabel(card: CardSpec): string[] {
  switch (card.effect.type) {
    case 'doubleHighestRoll':
      return ['2x highest'];
    case 'categoryDelta':
      return [
        `${card.effect.amount >= 0 ? '+' : ''}${card.effect.amount} ${categoryLabels[card.effect.category]}`,
        ...card.effect.penaltyCategory && card.effect.penaltyAmount
          ? [`${card.effect.penaltyAmount >= 0 ? '+' : ''}${card.effect.penaltyAmount} ${categoryLabels[card.effect.penaltyCategory]}`]
          : [],
      ];
    case 'topBottomDelta':
      return [`+${card.effect.topAmount} highest`, `${card.effect.bottomAmount} lowest`];
    case 'multiplyDice':
      return [`x${card.effect.multiplier} ${categoryLabels[card.effect.category]} dice`];
    case 'addFaceValue':
    case 'addAllFaces':
    case 'autoRerollLowest':
      return [];
  }
}
