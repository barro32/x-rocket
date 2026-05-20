export interface Rng {
  next(): number;
}

export class Mulberry32 implements Rng {
  private value: number;

  constructor(seed: number) {
    this.value = seed >>> 0;
  }

  next(): number {
    this.value += 0x6d2b79f5;
    let next = this.value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  }
}

export function pickOne<T>(items: T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng.next() * items.length))];
}
