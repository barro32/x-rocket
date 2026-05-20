import { draftCards } from './cards';
import { applyCard, startingDice } from './dice';
import { rollDice } from './roll';
import { Mulberry32, type Rng } from './rng';
import type { GameState, LaunchResult, MetaNodeId } from './types';

export const launchCost = 1;
export const baseStartingMoney = 5;
export const doubledStartingMoney = 10;
export const milestones = [5, 10, 25, 50, 100];
export { applyCard, startingDice };

export function createInitialState(seed = Date.now()): GameState {
  const boughtMetaNodes: MetaNodeId[] = [];
  return {
    version: 3,
    money: startingMoneyFor(boughtMetaNodes),
    metaCurrency: 0,
    boughtMetaNodes,
    dice: startingDice(boughtMetaNodes),
    runCards: [],
    autoRerollLowest: 0,
    launchCount: 0,
    bankruptcies: 0,
    bankruptcyRewardClaimed: false,
    highestAltitudeMeters: 0,
    allTimeMilestoneClaims: [],
    runMilestoneClaims: [],
    pendingCardAwards: 0,
    pendingCardChoices: [],
    seed,
  };
}

export function restartRun(state: GameState): GameState {
  const claimed = claimBankruptcyReward(state);
  return {
    ...claimed,
    money: startingMoneyFor(claimed.boughtMetaNodes),
    dice: startingDice(claimed.boughtMetaNodes),
    runCards: [],
    autoRerollLowest: 0,
    launchCount: 0,
    bankruptcies: claimed.bankruptcies + 1,
    bankruptcyRewardClaimed: false,
    runMilestoneClaims: [],
    pendingCardAwards: 0,
    pendingCardChoices: [],
    lastLaunch: undefined,
    seed: claimed.seed + 1,
  };
}

export function isBankrupt(state: GameState): boolean {
  return state.money < launchCost;
}

export function claimBankruptcyReward(state: GameState): GameState {
  if (!isBankrupt(state) || state.bankruptcyRewardClaimed) {
    return state;
  }

  return {
    ...state,
    metaCurrency: state.metaCurrency + 1,
    bankruptcyRewardClaimed: true,
  };
}

export function simulateLaunch(state: GameState, rng: Rng = new Mulberry32(state.seed + state.launchCount)): GameState {
  if (state.pendingCardChoices.length > 0 || isBankrupt(state)) {
    return state;
  }

  const roll = rollDice(state.dice, rng, state.autoRerollLowest, state.runCards);
  const heightMeters = roll.exploded ? 0 : roll.score;
  const reachedRunMilestones = milestones.filter((milestone) => heightMeters >= milestone && !state.runMilestoneClaims.includes(milestone));
  const reachedAllTimeMilestones: number[] = [];
  const pendingCardAwards = state.pendingCardAwards + (roll.exploded ? 0 : 1);
  const nextPendingChoices = state.pendingCardChoices.length === 0 && pendingCardAwards > 0 ? draftCards(rng, 3, state.boughtMetaNodes) : state.pendingCardChoices;
  const result: LaunchResult = {
    roll,
    heightMeters,
    moneyDelta: -launchCost,
    reachedRunMilestones,
    reachedAllTimeMilestones,
    message: launchMessage(roll.exploded, heightMeters, roll.score),
  };

  return {
    ...state,
    money: state.money - launchCost,
    metaCurrency: state.metaCurrency + reachedRunMilestones.length,
    launchCount: state.launchCount + 1,
    highestAltitudeMeters: Math.max(state.highestAltitudeMeters, heightMeters),
    runMilestoneClaims: uniqueNumbers([...state.runMilestoneClaims, ...reachedRunMilestones]),
    pendingCardAwards,
    pendingCardChoices: nextPendingChoices,
    lastLaunch: result,
  };
}

export function chooseCard(state: GameState, index: number, rng: Rng = new Mulberry32(state.seed + state.launchCount + state.runCards.length + 99)): GameState {
  const card = state.pendingCardChoices[index];
  if (!card) {
    return state;
  }

  const nextState = applyCard({
    ...state,
    runCards: [...state.runCards, card],
    pendingCardAwards: Math.max(0, state.pendingCardAwards - 1),
    pendingCardChoices: [],
  }, card);

  return {
    ...nextState,
    pendingCardChoices: nextState.pendingCardAwards > 0 ? draftCards(rng, 3, nextState.boughtMetaNodes) : [],
  };
}

export function startingMoneyFor(boughtMetaNodes: MetaNodeId[]): number {
  return boughtMetaNodes.includes('startingCapital') ? doubledStartingMoney : baseStartingMoney;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function launchMessage(exploded: boolean, heightMeters: number, score: number): string {
  if (exploded) {
    return `Score ${score} | Height 0m | Exploded`;
  }

  return `Score ${score} | Height ${heightMeters}m`;
}
