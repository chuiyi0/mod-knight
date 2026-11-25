import { describe, expect, it } from 'vitest';
import { createWeaponInstance } from '../src/content/weapons';
import { buildAttackContext, getWeaponMaxSlots } from '../src/sim/combat/attackPipeline';
import { SeededRNG } from '../src/sim/rng';
import { GameWorld } from '../src/sim/world';

describe('Weapon × Sticker Attack Pipeline', () => {
  it('applies laserize + triple_split + homing onto melee Salted Fish while keeping melee mode bonus', () => {
    const gw = new GameWorld({ seed: 42, heroId: 'bucket_knight', petId: 'orange_cat' });
    const p = gw.getMainPlayer();
    const fish = createWeaponInstance('salted_fish');
    fish.stickers.push('laserize', 'triple_split', 'homing');

    const ctx = buildAttackContext(p, fish, new SeededRNG(99));
    expect(ctx.mode).toBe('laser');
    expect(ctx.meleeHasBonusBeam).toBe(true);
    expect(ctx.projectileCount).toBe(3);
    expect(ctx.homingStrength).toBeGreaterThan(5);
    expect(ctx.canBreakCrackedWall).toBe(true);
  });

  it('clamps mana cost to 0 with Eco Mana sticker and boosts Folding Stool sticker scaling', () => {
    const gw = new GameWorld({ seed: 77, heroId: 'sticker_smith', heroLevel: 6, petId: 'orange_cat' });
    const p = gw.getMainPlayer();
    const stool = createWeaponInstance('folding_stool');
    stool.stickers.push('eco_mana', 'giant');

    const ctx = buildAttackContext(p, stool, new SeededRNG(77));
    expect(ctx.manaCost).toBe(0);
    expect(ctx.damage).toBeGreaterThan(13); // 10 * (1 + 0.35 * 1.2) = 14.2
    expect(getWeaponMaxSlots(p, stool)).toBe(3); // base 2 + sticker_smith Lv6 passive +1
  });

  it('handles chaos_random sticker safely without infinite recursion', () => {
    const gw = new GameWorld({ seed: 123, heroId: 'bucket_knight', petId: 'orange_cat' });
    const p = gw.getMainPlayer();
    const gun = createWeaponInstance('goblin_gatling');
    gun.stickers.push('chaos_random');

    const ctx = buildAttackContext(p, gun, new SeededRNG(123));
    expect(ctx.effectiveStickers.length).toBe(2);
    expect(ctx.effectiveStickers).not.toContain('chaos_random');
  });

  it('spends One-Punch Glove 500dmg on first strike and degrades gracefully afterward', () => {
    const gw = new GameWorld({ seed: 55, heroId: 'bucket_knight', petId: 'orange_cat' });
    const p = gw.getMainPlayer();
    const glove = createWeaponInstance('one_punch_glove');

    const first = buildAttackContext(p, glove, new SeededRNG(1));
    expect(first.onePunchReady).toBe(true);
    expect(first.damage).toBe(500);

    glove.onePunchSpent = true;
    const second = buildAttackContext(p, glove, new SeededRNG(1));
    expect(second.onePunchReady).toBe(false);
    expect(second.damage).toBeLessThan(20);
  });
});
