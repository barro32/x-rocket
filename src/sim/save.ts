import { createInitialState } from './game';
import { diceCategories } from './categories';
import type { CardSpec, DiceCategory, GameState, LaunchResult } from './types';

const saveKey = 'x-rocket-save-v3';

type SavedCardSpec = Omit<CardSpec, 'effect'> & {
  effect:
    | CardSpec['effect']
    | { type: 'multiplyDice'; category: DiceCategory; multiplier: number }
    | { type: 'addRandomFaceValue'; category: DiceCategory; faceIndex: number; amount: number };
};

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
    const savedDie = dice[category];
    if (Array.isArray(savedDie)) {
      dice[category] = savedDie[0] ?? fallback.dice[category];
    } else if (!savedDie?.faces) {
      dice[category] = fallback.dice[category];
    }
  }

  return {
    ...fallback,
    ...parsed,
    dice,
    boughtMetaNodes: parsed.boughtMetaNodes ?? [],
    runCards: normalizeCards(parsed.runCards),
    autoRerollLowest: parsed.autoRerollLowest ?? 0,
    temporaryAutoRerollLowest: parsed.temporaryAutoRerollLowest ?? fallback.temporaryAutoRerollLowest,
    allTimeMilestoneClaims: parsed.allTimeMilestoneClaims ?? [],
    runMilestoneClaims: parsed.runMilestoneClaims ?? [],
    pendingCardAwards: parsed.pendingCardAwards ?? 0,
    pendingCardChoices: normalizeCards(parsed.pendingCardChoices),
    lastLaunch: normalizeLaunchResult(parsed.lastLaunch),
  };
}

function normalizeCards(cards: SavedCardSpec[] | undefined): CardSpec[] {
  return (cards ?? []).map((card) => {
    if (card.effect.type === 'multiplyDice') {
      return {
        ...card,
        effect: {
          type: 'multiplyStat',
          category: card.effect.category,
          multiplier: card.effect.multiplier,
        },
      };
    }

    if (card.effect.type === 'addRandomFaceValue' && 'faceIndex' in card.effect) {
      return {
        ...card,
        effect: {
          type: 'addRandomFaceValue',
          category: card.effect.category,
          faceIndexes: [card.effect.faceIndex],
          amount: card.effect.amount,
        },
      };
    }

    return card as CardSpec;
  });
}

function normalizeLaunchResult(result: LaunchResult | undefined): LaunchResult | undefined {
  if (!result) {
    return undefined;
  }

  return {
    ...result,
    roll: {
      ...result.roll,
      rolls: result.roll.rolls.map((roll) => ({
        ...roll,
        initialValue: roll.initialValue ?? roll.rerolledFrom ?? roll.value,
        modifiers: roll.modifiers ?? (roll.rerolledFrom === undefined
          ? []
          : [{ label: 'reroll', before: roll.rerolledFrom, after: roll.value }]),
      })),
    },
  };
}
