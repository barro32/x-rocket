import { canBuyMetaNode, isMetaNodeUnlocked, positionedMetaNodes } from '../sim/meta';
import { categoryColors, categoryLabels, diceCategories } from '../sim/categories';
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
  const fitViewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  const defaultZoom = 0.72;
  const defaultWidth = (maxX - minX) * defaultZoom;
  const defaultHeight = (maxY - minY) * defaultZoom;
  const defaultX = minX + ((maxX - minX) - defaultWidth) / 2;
  const defaultY = minY + ((maxY - minY) - defaultHeight) / 2;
  const defaultViewBox = `${defaultX} ${defaultY} ${defaultWidth} ${defaultHeight}`;

  return `
    <div class="meta-map-shell">
      <div class="meta-map-controls" aria-label="Meta grid view controls">
        <button data-action="meta-zoom-in" aria-label="Zoom in">+</button>
        <button data-action="meta-zoom-out" aria-label="Zoom out">-</button>
        <button data-action="meta-fit">Fit</button>
      </div>
      <svg
        class="hex-map"
        viewBox="${defaultViewBox}"
        data-meta-map
        data-default-view-box="${defaultViewBox}"
        data-fit-view-box="${fitViewBox}"
        role="group"
        aria-label="Meta Grid"
      >
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
              <text class="hex-label">${escapeHtml(compactMetaLabel(node.effect))}</text>
            </g>
          `;
        }).join('')}
      </svg>
    </div>
  `;
}

function compactMetaLabel(effect: MetaNodeEffect): string {
  switch (effect.type) {
    case 'startingMoney':
      return '+$5 Start';
    case 'addFaceValue':
      return `+${effect.amount} ${categoryLabels[effect.category]}`;
    case 'addWeakestFace':
      return `+${effect.amount} Weakest`;
    case 'autoRerollLowest':
      return 'Reroll Low';
    case 'upgradeRandomFaceCard':
      return `Better ${categoryLabels[effect.category]}`;
    case 'unlockCard':
      return 'Unlock Card';
  }
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
