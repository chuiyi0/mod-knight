import { describe, expect, it } from 'vitest';
import { SeededRNG } from '../src/sim/rng';

describe('SeededRNG determinism', () => {
  it('produces identical sequences for the same seed', () => {
    const a = new SeededRNG(20261126);
    const b = new SeededRNG(20261126);
    for (let i = 0; i < 50; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces distinct sequences for different seeds', () => {
    const a = new SeededRNG(100);
    const b = new SeededRNG(101);
    const seqA = Array.from({ length: 10 }, () => a.int(0, 1000));
    const seqB = Array.from({ length: 10 }, () => b.int(0, 1000));
    expect(seqA).not.toEqual(seqB);
  });
});
