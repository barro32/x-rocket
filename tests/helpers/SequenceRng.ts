import type { Rng } from '../../src/sim/rng';

export class SequenceRng implements Rng {
  private index = 0;

  constructor(private readonly values: number[]) {}

  next(): number {
    const value = this.values[this.index] ?? this.values[this.values.length - 1] ?? 0;
    this.index += 1;
    return value;
  }
}
