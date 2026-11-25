import { describe, expect, it } from 'vitest';
import { BIOMES } from '../src/content/biomes';
import { generateFloor } from '../src/sim/dungeon/generator';
import { SeededRNG } from '../src/sim/rng';
import { SIM_DT } from '../src/sim/types';
import { GameWorld } from '../src/sim/world';

describe('Dungeon Generation & Core Combat Rules', () => {
  it('generates valid floors across all 6 biomes and 15 stages with boss rooms on stage 5', () => {
    const biomes = Object.keys(BIOMES) as Array<keyof typeof BIOMES>;
    for (let floor = 1; floor <= 15; floor++) {
      const biome = biomes[(floor - 1) % biomes.length];
      const gen = generateFloor(floor, biome, new SeededRNG(floor * 1337));
      expect(gen.map.rooms.length).toBeGreaterThanOrEqual(6);
      expect(gen.map.rooms.some((r) => r.kind === 'start')).toBe(true);
      expect(gen.map.rooms.some((r) => r.kind === 'chest')).toBe(true);
      expect(gen.map.rooms.some((r) => r.kind === 'curiosity')).toBe(true);
      if (floor % 5 === 0) {
        expect(gen.map.rooms.some((r) => r.kind === 'boss')).toBe(true);
      } else {
        expect(gen.map.rooms.some((r) => r.kind === 'portal')).toBe(true);
      }
    }
  });

  it('enforces Blue Shield overflow protection and auto shield regeneration after 3.5s', () => {
    const gw = new GameWorld({ seed: 900, heroId: 'bucket_knight', heroLevel: 6, petId: 'orange_cat' });
    const p = gw.getMainPlayer();
    const initialHp = p.hp;
    p.shield = 2;

    // Massive 10-dmg hit breaks shield, but Bucket Knight Lv.6 Blue Shield prevents overflow to HP!
    gw.damagePlayer(p, 10);
    expect(p.shield).toBe(0);
    expect(p.hp).toBe(initialHp);

    // Advance 5 seconds safely -> shield starts regenerating!
    for (let i = 0; i < 60 * 5; i++) {
      gw.step([], SIM_DT);
    }
    expect(p.shield).toBeGreaterThan(0);
  });

  it('exports and restores mid-run checkpoint accurately', () => {
    const gw = new GameWorld({ seed: 2026, heroId: 'blade_ashura', heroLevel: 5, petId: 'mecha_duck' });
    const p = gw.getMainPlayer();
    p.coins = 188;
    p.weapons[0].stickers.push('homing', 'fire_pepper');
    const cp = gw.exportCheckpoint(0);

    const restored = GameWorld.fromCheckpoint(cp);
    const rp = restored.getMainPlayer();
    expect(rp.heroId).toBe('blade_ashura');
    expect(rp.coins).toBe(188);
    expect(rp.weapons[0].stickers).toEqual(['homing', 'fire_pepper']);
  });
});
