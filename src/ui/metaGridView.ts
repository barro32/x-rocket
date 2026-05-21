import { canBuyMetaNode, isMetaNodeUnlocked, positionedMetaNodes } from '../sim/meta';
import { categoryColors, diceCategories } from '../sim/categories';
import type { DiceCategory, GameState, MetaNodeEffect } from '../sim/types';

export function renderMetaGrid(state: GameState): string {
  const size = 36;
  const points = hexPoints(size);
  const positionedNodes = positionedMetaNodes.map((node) => {
    const x = Math.sqrt(3) * size * (node.x + node.z / 2);
    const y = 1.5 * size * node.z;
    return { node, x, y };
  });
  const xs = positionedNodes.map(({ x }) => x);
  const ys = positionedNodes.map(({ y }) => y);
  const padding = 72;
  const minX = Math.min(...xs) - size - padding;
  const maxX = Math.max(...xs) + size + padding;
  const minY = Math.min(...ys) - size - padding;
  const maxY = Math.max(...ys) + size + padding;

  return `
    <svg class="hex-map" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" role="group" aria-label="Meta Grid">
      ${positionedNodes.map(({ node, x, y }) => {
        const bought = state.boughtMetaNodes.includes(node.id);
        const unlocked = isMetaNodeUnlocked(state, node.id);
        const buyable = canBuyMetaNode(state, node.id);
        const temporary = node.effect.type === 'autoRerollLowest';
        const category = categoryForMetaEffect(node.effect);
        return `
          <g
            class="hex-node ${category ? 'stat-themed' : ''} ${bought ? 'bought' : ''} ${unlocked ? '' : 'locked'} ${buyable ? 'buyable' : ''} ${temporary ? 'temporary' : ''}"
            ${category ? `style="--stat-color: ${categoryColors[category]}"` : ''}
            data-meta="${node.id}"
            transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"
            tabindex="${buyable ? '0' : '-1'}"
            role="button"
            aria-disabled="${buyable ? 'false' : 'true'}"
          >
            <polygon points="${points}" />
            <text class="hex-label">${escapeHtml(node.label)}</text>
          </g>
        `;
      }).join('')}
    </svg>
  `;
}

function categoryForMetaEffect(effect: MetaNodeEffect): DiceCategory | undefined {
  switch (effect.type) {
    case 'addFaceValue':
    case 'upgradeRandomFaceCard':
      return effect.category;
    case 'unlockCard':
      return categoryFromCardId(effect.cardId);
    case 'startingMoney':
    case 'addWeakestFace':
    case 'autoRerollLowest':
      return undefined;
  }
}

function categoryFromCardId(cardId: string): DiceCategory | undefined {
  return diceCategories.find((category) => cardId.endsWith(`-${category}`));
}

function hexPoints(size: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 180 * (60 * index - 30);
    return `${(Math.cos(angle) * size).toFixed(2)},${(Math.sin(angle) * size).toFixed(2)}`;
  }).join(' ');
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
