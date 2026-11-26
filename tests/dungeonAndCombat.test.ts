import { describe, expect, it } from 'vitest';
import { BIOMES } from '../src/content/biomes';
import { createWeaponInstance } from '../src/content/weapons';
import { generateFloor } from '../src/sim/dungeon/generator';
import { SeededRNG } from '../src/sim/rng';
import { SIM_DT } from '../src/sim/types';
import { GameWorld } from '../src/sim/world';

describe('v2.0 Exploration, Multi-Portals, Vault/Sticker Bag & Combat', () => {
  it('generates zero-dead-end forward floors with guaranteed shop, multiple portals, and Boss every 3 floors', () => {
    const biomes = Object.keys(BIOMES) as Array<keyof typeof BIOMES>;
    for (let floor = 1; floor <= 12; floor++) {
      const biome = biomes[(floor - 1) % biomes.length];
      const gen = generateFloor(floor, biome, new SeededRNG(floor * 1337));
      expect(gen.map.rooms.some((r) => r.kind === 'start')).toBe(true);
      expect(gen.map.rooms.some((r) => r.kind === 'shop')).toBe(true);
      expect(gen.map.rooms.some((r) => r.kind === 'chest')).toBe(true);

      const portals = gen.interactables.filter((i) => i.kind === 'portal');
      if (floor % 3 === 0) {
        expect(gen.map.rooms.some((r) => r.kind === 'boss')).toBe(true);
        // Side rooms still give forward portals!
        expect(portals.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(gen.map.rooms.some((r) => r.kind === 'portal')).toBe(true);
        // Multi-exit portal hub + side-room portals >= 5!
        expect(portals.length).toBeGreaterThanOrEqual(5);
        // Optional Field Bounty Boss spawns neutrally (no surprise jumpscare!)
        const bounty = gen.initialEnemies.find((e) => e.isBounty);
        expect(bounty).toBeDefined();
        expect(bounty?.bountyAwake).toBe(false);
      }
    }
  });

  it('supports sticker bag free attach/detach, 6-slot weapon vault, and batch weapon recycling', () => {
    const gw = new GameWorld({ seed: 2026, heroId: 'bucket_knight', petId: 'orange_cat' });
    const p = gw.getMainPlayer();
    const initialCoins = p.coins;

    // Add stickers to bag & attach/detach freely
    gw.addStickerToBag('homing');
    gw.addStickerToBag('laserize');
    expect(p.stickerBag).toEqual(['homing', 'laserize']);

    expect(gw.attachBagStickerToWeapon(0, 'equipped', 0)).toBe(true);
    expect(p.weapons[0].stickers).toContain('homing');
    expect(p.stickerBag).toEqual(['laserize']);

    expect(gw.detachStickerToBag('equipped', 0, 0)).toBe(true);
    expect(p.weapons[0].stickers.length).toBe(0);
    expect(p.stickerBag).toContain('homing');

    // Vault storage & batch recycle (returning stickers on recycled weapons to bag!)
    const extraWpn = createWeaponInstance('salted_fish');
    extraWpn.stickers.push('fire_pepper');
    p.weaponVault.push(extraWpn, createWeaponInstance('pixel_shotgun'));
    const gained = gw.recycleAllVaultWeapons();
    expect(gained).toBeGreaterThan(30);
    expect(p.coins).toBe(initialCoins + gained);
    expect(p.weaponVault.length).toBe(0);
    expect(p.stickerBag).toContain('fire_pepper');
  });

  it('enforces Blue Shield protection, auto shield regen, and passive mana regen', () => {
    const gw = new GameWorld({ seed: 900, heroId: 'bucket_knight', heroLevel: 6, petId: 'orange_cat' });
    const p = gw.getMainPlayer();
    const initialHp = p.hp;
    p.shield = 2;
    p.mana = 50;

    gw.damagePlayer(p, 10);
    expect(p.shield).toBe(0);
    expect(p.hp).toBe(initialHp);

    for (let i = 0; i < 60 * 5; i++) {
      gw.step([], SIM_DT);
    }
    expect(p.shield).toBeGreaterThan(0);
    expect(p.mana).toBeGreaterThan(100);
  });

  it('exports and restores v2 checkpoint including weaponVault and stickerBag', () => {
    const gw = new GameWorld({ seed: 2026, heroId: 'blade_ashura', heroLevel: 5, petId: 'mecha_duck' });
    const p = gw.getMainPlayer();
    p.coins = 188;
    p.stickerBag.push('giant', 'egg_chicken');
    p.weaponVault.push(createWeaponInstance('rubber_chicken'));
    const cp = gw.exportCheckpoint(0);

    const restored = GameWorld.fromCheckpoint(cp);
    const rp = restored.getMainPlayer();
    expect(rp.coins).toBe(188);
    expect(rp.stickerBag).toEqual(['giant', 'egg_chicken']);
    expect(rp.weaponVault.length).toBe(1);
    expect(rp.weaponVault[0].defId).toBe('rubber_chicken');
  });
});
