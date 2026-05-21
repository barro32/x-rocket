import { describe, expect, it } from 'vitest';
import { buyMetaNode, canBuyMetaNode, metaNodes, positionedMetaNodes } from '../src/sim/meta';
import { diceCategories } from '../src/sim/categories';
import { startingDice } from '../src/sim/dice';
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
    expect(nodesById['unlock-plus3-side1-fuel']).toMatchObject({
      effect: { type: 'unlockCard', cardId: 'plus3-side1-fuel' },
    });
    expect(nodesById['unlock-rare-die-guidance']?.label).toContain('x2 Guidance');
    expect(nodesById['unlock-all-faces-weight']).toBeDefined();
    expect(nodesById['upgrade-random-face-card-thrusters']).toMatchObject({
      effect: { type: 'upgradeRandomFaceCard', category: 'thrusters', amount: 2 },
    });
    expect(nodesById['reroll-lowest-0']).toMatchObject({
      effect: { type: 'autoRerollLowest', amount: 1 },
    });
    expect(nodesById['reroll-lowest-1']).toMatchObject({
      effect: { type: 'autoRerollLowest', amount: 1 },
    });
    expect(nodesById['unlock-s6-three-stats']).toMatchObject({
      effect: { type: 'unlockCard', cardId: 's6-three-stats' },
    });
    expect(nodesById['thrusters-4']).toBeDefined();
    expect(nodesById['weight-4']).toBeDefined();
  });

  it('has enough face upgrades for every stat to reach 543210', () => {
    for (const category of diceCategories) {
      const nodeIds = metaNodes
        .filter((node) => node.effect.type === 'addFaceValue' && node.effect.category === category)
        .map((node) => node.id);
      const dice = startingDice(nodeIds);

      expect(dice[category].faces).toEqual([5, 4, 3, 2, 1, 0]);
    }
  });

  it('derives unique valid cube coordinates for every meta node', () => {
    const coords = new Set<string>();
    const ids = new Set<string>();

    for (const node of positionedMetaNodes) {
      expect(node.x + node.y + node.z).toBe(0);
      coords.add(`${node.x},${node.y},${node.z}`);
      ids.add(node.id);
    }

    expect(coords.size).toBe(metaNodes.length);
    expect(ids.size).toBe(metaNodes.length);
  });
});
