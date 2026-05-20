import { describe, expect, it } from 'vitest';
import { buyMetaNode, canBuyMetaNode, metaNodes } from '../src/sim/meta';
import { createInitialState, restartRun, startingMoneyFor } from '../src/sim/game';

describe('meta progression', () => {
  it('doubles starting money after buying the center meta node', () => {
    const state = { ...createInitialState(1), metaCurrency: 1 };
    const bought = buyMetaNode(state, 'startingCapital');
    const restarted = restartRun({ ...bought, money: 0 });

    expect(startingMoneyFor(bought.boughtMetaNodes)).toBe(10);
    expect(restarted.money).toBe(10);
  });

  it('locks meta nodes until an adjacent cube-coordinate node is learned', () => {
    const state = { ...createInitialState(1), metaCurrency: 3 };

    expect(canBuyMetaNode(state, 'thrusters-0')).toBe(false);

    const center = buyMetaNode(state, 'startingCapital');
    expect(canBuyMetaNode(center, 'thrusters-0')).toBe(true);
    expect(canBuyMetaNode(center, 'thrusters-1')).toBe(false);

    const ringOne = buyMetaNode(center, 'thrusters-0');
    expect(canBuyMetaNode(ringOne, 'thrusters-1')).toBe(true);
  });

  it('adds the requested meta expansion nodes', () => {
    const nodesById = Object.fromEntries(metaNodes.map((node) => [node.id, node]));

    expect(nodesById['unlock-double-highest']).toBeDefined();
    expect(nodesById['unlock-top-bottom']).toBeDefined();
    expect(nodesById['unlock-plus3-minus1-thrusters']).toBeDefined();
    expect(nodesById['unlock-plus2-fuel']).toBeDefined();
    expect(nodesById['unlock-rare-die-guidance']?.label).toContain('x2 Guidance Dice');
    expect(nodesById['unlock-all-faces-weight']).toBeDefined();
    expect(nodesById['thrusters-4']).toBeDefined();
    expect(nodesById['weight-5']).toBeDefined();
  });

  it('uses unique valid cube coordinates for every meta node', () => {
    const coords = new Set<string>();

    for (const node of metaNodes) {
      expect(node.x + node.y + node.z).toBe(0);
      coords.add(`${node.x},${node.y},${node.z}`);
    }

    expect(coords.size).toBe(metaNodes.length);
  });
});
