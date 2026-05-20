import { createInitialState } from './game';
import { diceCategories } from './categories';
import type { GameState } from './types';

const saveKey = 'x-rocket-save-v3';
export const saveFileName = `${saveKey}.json`;

export function loadGame(storage: Storage = window.localStorage): GameState {
  const raw = storage.getItem(saveKey);
  if (!raw) {
    return createInitialState();
  }

  try {
    return parseSave(raw);
  } catch {
    return createInitialState();
  }
}

export function parseSave(raw: string): GameState {
  const parsed = JSON.parse(raw) as GameState;
  if (parsed.version !== 3) {
    return createInitialState();
  }

  return normalizeSave(parsed);
}

export function serializeSave(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

export function saveGame(state: GameState, storage: Storage = window.localStorage): void {
  storage.setItem(saveKey, JSON.stringify(state));
}

export function clearSave(storage: Storage = window.localStorage): void {
  storage.removeItem(saveKey);
}

function normalizeSave(parsed: GameState): GameState {
  const fallback = createInitialState(parsed.seed);
  const dice = { ...fallback.dice, ...parsed.dice };
  for (const category of diceCategories) {
    if (!Array.isArray(dice[category]) || dice[category].length === 0) {
      dice[category] = fallback.dice[category];
    }
  }

  return {
    ...fallback,
    ...parsed,
    dice,
    boughtMetaNodes: parsed.boughtMetaNodes ?? [],
    runCards: parsed.runCards ?? [],
    autoRerollLowest: parsed.autoRerollLowest ?? 0,
    allTimeMilestoneClaims: parsed.allTimeMilestoneClaims ?? [],
    runMilestoneClaims: parsed.runMilestoneClaims ?? [],
    pendingCardAwards: parsed.pendingCardAwards ?? 0,
    pendingCardChoices: parsed.pendingCardChoices ?? [],
  };
}
