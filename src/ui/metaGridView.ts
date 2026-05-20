import { canBuyMetaNode, isMetaNodeUnlocked, metaNodes } from '../sim/meta';
import type { GameState } from '../sim/types';

export function renderMetaGrid(state: GameState): string {
  const size = 36;
  const points = hexPoints(size);
  const positionedNodes = metaNodes.map((node) => {
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
        return `
          <g
            class="hex-node ${bought ? 'bought' : ''} ${unlocked ? '' : 'locked'} ${buyable ? 'buyable' : ''}"
            data-meta="${node.id}"
            transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"
            tabindex="${buyable ? '0' : '-1'}"
            role="button"
            aria-disabled="${buyable ? 'false' : 'true'}"
          >
            <polygon points="${points}" />
            <text class="hex-label" y="-4">${escapeHtml(node.label)}</text>
            <text class="hex-cost" y="15">${bought ? '1' : node.cost}</text>
          </g>
        `;
      }).join('')}
    </svg>
  `;
}

function hexPoints(size: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 180 * (60 * index - 30);
    return `${(Math.cos(angle) * size).toFixed(2)},${(Math.sin(angle) * size).toFixed(2)}`;
  }).join(' ');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
