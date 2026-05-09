import { createInitialState } from './game';
import { defaultLessons } from './lessons';
import { defaultMetaUpgrades } from './metaUpgrades';
import { rebuildRocketStats } from './lessons';
import type { GameState } from './types';

const saveKey = 'x-rocket-save-v2';

export function loadGame(storage: Storage = window.localStorage): GameState {
  const raw = storage.getItem(saveKey);
  if (!raw) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 2) {
      return createInitialState();
    }

    const metaUpgrades = { ...defaultMetaUpgrades, ...parsed.metaUpgrades };
    const lessons = { ...defaultLessons, ...parsed.lessons };

    return {
      ...createInitialState(parsed.seed),
      ...parsed,
      metaUpgrades,
      bankruptcyRewardClaimed: parsed.bankruptcyRewardClaimed ?? false,
      safetyReviewUses: parsed.safetyReviewUses ?? 0,
      lessons,
      pendingLessonChoices: parsed.pendingLessonChoices ?? [],
      rocketStats: rebuildRocketStats(metaUpgrades, lessons),
    };
  } catch {
    return createInitialState();
  }
}

export function saveGame(state: GameState, storage: Storage = window.localStorage): void {
  storage.setItem(saveKey, JSON.stringify(state));
}

export function clearSave(storage: Storage = window.localStorage): void {
  storage.removeItem(saveKey);
}
