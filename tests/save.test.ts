import { describe, expect, it } from 'vitest';
import { clearSave, saveGame } from '../src/sim/save';
import { createInitialState } from '../src/sim/game';

describe('save helpers', () => {
  it('clears the saved game', () => {
    const storage = new MapStorage();
    saveGame(createInitialState(1), storage);

    expect(storage.length).toBe(1);
    clearSave(storage);
    expect(storage.length).toBe(0);
  });
});

class MapStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
