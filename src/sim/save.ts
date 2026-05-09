import { createInitialState } from './game';
import { defaultLessons } from './lessons';
import { defaultMetaUpgrades } from './metaUpgrades';
import { cloneParts, createBaseParts } from './parts';
import type { GameState } from './types';

const saveKey = 'x-rocket-save-v1';

export function loadGame(storage: Storage = window.localStorage): GameState {
  const raw = storage.getItem(saveKey);
  if (!raw) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1) {
      return createInitialState();
    }
    return {
      ...createInitialState(parsed.seed),
      ...parsed,
      metaUpgrades: { ...defaultMetaUpgrades, ...parsed.metaUpgrades },
      lessons: { ...defaultLessons, ...parsed.lessons },
      pendingLessonChoices: parsed.pendingLessonChoices ?? [],
      parts: parsed.parts
        ? cloneParts({ ...createBaseParts({ ...defaultMetaUpgrades, ...parsed.metaUpgrades }), ...parsed.parts })
        : createBaseParts({ ...defaultMetaUpgrades, ...parsed.metaUpgrades }),
    };
  } catch {
    return createInitialState();
  }
}

export function saveGame(state: GameState, storage: Storage = window.localStorage): void {
  storage.setItem(saveKey, JSON.stringify(state));
}
