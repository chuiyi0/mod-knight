import { describe, expect, it } from 'vitest';
import { getDailyChallengeFactors } from '../src/content/biomes';
import {
  createDefaultMetaSave,
  exportSaveCode,
  importSaveCode,
  settleRunIntoMeta
} from '../src/platform/storage';
import {
  forgeWeapon,
  harvestGardenPlot,
  isGardenPlotMature,
  plantSeedInPlot,
  prePrintSticker,
  pullGacha,
  unlockOrSelectHero,
  upgradeHero
} from '../src/sim/lobby';

describe('Deluxe Lobby Progression & Persistence', () => {
  it('supports hero upgrade, gacha pull, garden dual-maturity harvest, forge & sticker pre-print', () => {
    const meta = createDefaultMetaSave();
    meta.gems = 5000;

    // Unlock Ranger Cat & upgrade
    const u = unlockOrSelectHero(meta, 'ranger_cat');
    expect(u.ok).toBe(true);
    expect(meta.selectedHero).toBe('ranger_cat');
    const up = upgradeHero(meta, 'ranger_cat');
    expect(up.ok).toBe(true);
    expect(meta.heroLevels.ranger_cat).toBe(2);

    // Gacha
    const g = pullGacha(meta);
    expect(g.ok).toBe(true);
    expect(meta.gachaPullsToday).toBe(1);

    // Garden harvest starter mature gem_tree + fire_chili
    expect(isGardenPlotMature(meta.garden[0])).toBe(true);
    const h0 = harvestGardenPlot(meta, 0);
    expect(h0.ok).toBe(true);
    const h1 = harvestGardenPlot(meta, 1);
    expect(h1.ok).toBe(true);
    expect(meta.preparedTalents).toContain('fire_shield');

    // Plant new seed and mature via 2 completed runs!
    const pl = plantSeedInPlot(meta, 0, 'gem_tree');
    expect(pl.ok).toBe(true);
    expect(isGardenPlotMature(meta.garden[0])).toBe(false);
    settleRunIntoMeta(meta, { won: false, floor: 3, gemsEarned: 100, coinsRemaining: 20, materials: {}, seeds: {}, weaponsHeld: [], isDailyChallenge: false });
    settleRunIntoMeta(meta, { won: false, floor: 5, gemsEarned: 200, coinsRemaining: 40, materials: {}, seeds: {}, weaponsHeld: [], isDailyChallenge: false });
    expect(isGardenPlotMature(meta.garden[0])).toBe(true);

    // Forge starter unlocked weapon & pre-print starter sticker
    const f = forgeWeapon(meta, 'salted_fish');
    expect(f.ok).toBe(true);
    expect(meta.preparedWeapon?.defId).toBe('salted_fish');

    const pre = prePrintSticker(meta, 'homing');
    expect(pre.ok).toBe(true);
    expect(meta.preparedStickers).toContain('homing');
  });

  it('deterministically generates 2 positive + 2 challenge daily factors and roundtrips save code', () => {
    const f1 = getDailyChallengeFactors('2026-11-26', 0);
    const f2 = getDailyChallengeFactors('2026-11-26', 0);
    expect(f1).toEqual(f2);
    expect(f1.length).toBe(4);

    const meta = createDefaultMetaSave();
    meta.gems = 4321;
    const code = exportSaveCode(meta);
    const decoded = importSaveCode(code);
    expect(decoded?.gems).toBe(4321);
  });
});
