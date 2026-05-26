import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from 'react';
import { canBuyMetaNode, isMetaNodeUnlocked, positionedMetaNodes } from '../sim/meta';
import { categoryColors, categoryLabels, diceCategories } from '../sim/categories';
import type { DiceCategory, GameState, MetaNodeEffect, MetaNodeId } from '../sim/types';

export type ViewBox = { x: number; y: number; width: number; height: number };

interface MetaGridProps {
  state: GameState;
  viewBox?: ViewBox;
  suppressClickUntil: number;
  onBuyNode: (id: MetaNodeId) => void;
  onHoverNode: (id: MetaNodeId) => void;
  onSuppressClickUntil: (time: number) => void;
  onViewBoxChange: (viewBox: ViewBox) => void;
}

export function MetaGrid({
  state,
  viewBox,
  suppressClickUntil,
  onBuyNode,
  onHoverNode,
  onSuppressClickUntil,
  onViewBoxChange,
}: MetaGridProps): ReactNode {
  const metrics = useMemo(metaGridMetrics, []);
  const activeViewBox = viewBox ?? metrics.defaultViewBox;
  const dragStart = useRef<
    | { pointerId: number; clientX: number; clientY: number; viewBox: ViewBox; moved: boolean }
    | undefined
  >(undefined);
  const svgRef = useRef<SVGSVGElement>(null);

  function zoom(multiplier: number): void {
    const minWidth = metrics.fitViewBox.width * 0.22;
    const maxWidth = metrics.fitViewBox.width * 1.25;
    const width = Math.min(maxWidth, Math.max(minWidth, activeViewBox.width * multiplier));
    const height = width * (activeViewBox.height / activeViewBox.width);
    const centerX = activeViewBox.x + activeViewBox.width / 2;
    const centerY = activeViewBox.y + activeViewBox.height / 2;
    onViewBoxChange({
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    });
  }

  function onWheel(event: WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.88 : 1.14);
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (event.button !== 0) {
      return;
    }

    dragStart.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewBox: activeViewBox,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    const start = dragStart.current;
    const map = svgRef.current;
    if (!start || !map || start.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.clientX;
    const deltaY = event.clientY - start.clientY;
    if (!start.moved && Math.hypot(deltaX, deltaY) < 4) {
      return;
    }

    start.moved = true;
    map.classList.add('panning');
    const scaleX = start.viewBox.width / map.clientWidth;
    const scaleY = start.viewBox.height / map.clientHeight;
    onViewBoxChange({
      ...start.viewBox,
      x: start.viewBox.x - (deltaX * scaleX),
      y: start.viewBox.y - (deltaY * scaleY),
    });
  }

  function onPointerEnd(event: ReactPointerEvent<SVGSVGElement>): void {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    if (start.moved) {
      onSuppressClickUntil(performance.now() + 250);
    }

    dragStart.current = undefined;
    event.currentTarget.classList.remove('panning');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="pointer-events-auto relative m-0 h-[min(720px,calc(100vh-142px))] min-h-0 w-full touch-none overflow-hidden rounded-lg border border-[rgba(160,181,210,0.2)] bg-[rgba(12,19,34,0.42)] max-[860px]:h-[min(520px,calc(100vh-180px))]">
      <div className="absolute left-3 top-3 z-1 flex gap-1.5" aria-label="Meta grid view controls">
        <button className="min-h-[34px] min-w-[34px] bg-[rgba(217,237,247,0.94)] px-2.5 py-1.5" onClick={() => zoom(0.82)} aria-label="Zoom in">+</button>
        <button className="min-h-[34px] min-w-[34px] bg-[rgba(217,237,247,0.94)] px-2.5 py-1.5" onClick={() => zoom(1.22)} aria-label="Zoom out">-</button>
        <button className="min-h-[34px] bg-[rgba(217,237,247,0.94)] px-2.5 py-1.5" onClick={() => onViewBoxChange(metrics.fitViewBox)}>Fit</button>
      </div>
      <svg
        className="hex-map"
        viewBox={viewBoxValue(activeViewBox)}
        ref={svgRef}
        role="group"
        aria-label="Meta Grid"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {metrics.positionedNodes.map(({ node, x, y }) => {
          const bought = state.boughtMetaNodes.includes(node.id);
          const unlocked = isMetaNodeUnlocked(state, node.id);
          const buyable = canBuyMetaNode(state, node.id);
          const temporary = node.effect.type === 'autoRerollLowest';
          const category = categoryForMetaEffect(node.effect);
          return (
            <g
              className={[
                'hex-node',
                'cursor-not-allowed outline-none',
                category ? 'stat-themed' : '',
                bought ? 'bought' : '',
                unlocked ? '' : 'locked',
                buyable ? 'buyable cursor-pointer' : '',
                temporary ? 'temporary' : '',
              ].filter(Boolean).join(' ')}
              key={node.id}
              style={category ? ({ '--stat-color': categoryColors[category] } as React.CSSProperties) : undefined}
              transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
              tabIndex={buyable ? 0 : -1}
              role="button"
              aria-disabled={buyable ? 'false' : 'true'}
              onMouseEnter={() => onHoverNode(node.id)}
              onFocus={() => onHoverNode(node.id)}
              onClick={() => {
                if (performance.now() >= suppressClickUntil) {
                  onBuyNode(node.id);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (performance.now() >= suppressClickUntil) {
                    onBuyNode(node.id);
                  }
                }
              }}
            >
              <polygon className="fill-[#152236] stroke-[#70839f] stroke-[1.5]" points={metrics.points} />
              <text className="pointer-events-none fill-rocket-text text-[9px] font-bold [dominant-baseline:middle] [text-anchor:middle]">{compactMetaLabel(node.effect)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function metaGridMetrics() {
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
  const fitViewBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  const defaultZoom = 0.72;
  const defaultWidth = fitViewBox.width * defaultZoom;
  const defaultHeight = fitViewBox.height * defaultZoom;
  const defaultViewBox = {
    x: minX + (fitViewBox.width - defaultWidth) / 2,
    y: minY + (fitViewBox.height - defaultHeight) / 2,
    width: defaultWidth,
    height: defaultHeight,
  };
  return { defaultViewBox, fitViewBox, points, positionedNodes };
}

function viewBoxValue(viewBox: ViewBox): string {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
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
