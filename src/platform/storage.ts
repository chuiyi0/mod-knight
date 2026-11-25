import { ACHIEVEMENTS } from '../content/biomes';
import {
  HeroId,
  MaterialId,
  MetaSave,
  PetId,
  PlantId,
  RunCheckpoint,
  StickerId,
  WeaponId
} from '../sim/types';

const META_KEY = 'mod_knight_meta_v1';
const CHECKPOINT_KEY = 'mod_knight_checkpoint_v1';

export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createDefaultMetaSave(): MetaSave {
  const today = todayDateString();
  return {
    version: 1,
    gems: 800, // Friendly starter gems to try upgrades / gacha!
    selectedHero: 'bucket_knight',
    selectedPet: 'orange_cat',
    unlockedHeroes: ['bucket_knight', 'sticker_smith'], // Both flagship heroes ready to enjoy!
    heroLevels: {
      bucket_knight: 1,
      sticker_smith: 1,
      ranger_cat: 1,
      alchemist_quirk: 1,
      slacker_priest: 1,
      blade_ashura: 1
    },
    unlockedPets: ['orange_cat'],
    materials: {
      iron: 10,
      magic_shard: 6,
      wood: 10,
      quirk_part: 6,
      glow_glue: 4,
      core_crystal: 1
    },
    seeds: {
      gem_tree: 1,
      iron_cactus: 1,
      fire_chili: 1,
      mandrake_poison: 0,
      frost_lotus: 0,
      sticker_vine: 1,
      carrot_tree: 0,
      lucky_clover: 0
    },
    garden: [
      { unlocked: true, plantId: 'gem_tree', watered: true, plantedDay: '2020-01-01', runsSincePlanted: 2, harvestedToday: false },
      { unlocked: true, plantId: 'fire_chili', watered: true, plantedDay: '2020-01-01', runsSincePlanted: 2, harvestedToday: false },
      { unlocked: true, plantId: null, watered: false, plantedDay: null, runsSincePlanted: 0, harvestedToday: false },
      { unlocked: false, plantId: null, watered: false, plantedDay: null, runsSincePlanted: 0, harvestedToday: false },
      { unlocked: false, plantId: null, watered: false, plantedDay: null, runsSincePlanted: 0, harvestedToday: false },
      { unlocked: false, plantId: null, watered: false, plantedDay: null, runsSincePlanted: 0, harvestedToday: false }
    ],
    gachaPullsToday: 0,
    gachaDay: today,
    gachaPity: 0,
    dailyCompletedDay: null,
    dailyRerollsDay: today,
    dailyRerollsUsed: 0,
    dailySeedOffset: 0,
    bountiesClaimed: {},
    runsPlayed: 0,
    runsWon: 0,
    bestFloor: 0,
    weaponsSeen: { worn_pistol: 5, salted_fish: 5, folding_stool: 5 },
    weaponsGoldFrame: {},
    bossBlueprints: {},
    stickersSeen: { homing: 3, fire_pepper: 3, bounce: 3 },
    bossKills: {},
    achievements: {},
    preparedWeapon: null,
    preparedStickers: [],
    preparedTalents: [],
    preparedLucky: false,
    settings: {
      sfxEnabled: true,
      bgmEnabled: true,
      shakeEnabled: true
    }
  };
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadMetaSave(): MetaSave {
  const st = getStorage();
  if (!st) return createDefaultMetaSave();
  try {
    const raw = st.getItem(META_KEY);
    if (!raw) return createDefaultMetaSave();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    const def = createDefaultMetaSave();
    const merged: MetaSave = {
      ...def,
      ...parsed,
      heroLevels: { ...def.heroLevels, ...(parsed.heroLevels ?? {}) },
      materials: { ...def.materials, ...(parsed.materials ?? {}) },
      seeds: { ...def.seeds, ...(parsed.seeds ?? {}) },
      settings: { ...def.settings, ...(parsed.settings ?? {}) }
    };
    // Reset daily counters when date changes
    const today = todayDateString();
    if (merged.gachaDay !== today) {
      merged.gachaDay = today;
      merged.gachaPullsToday = 0;
    }
    if (merged.dailyRerollsDay !== today) {
      merged.dailyRerollsDay = today;
      merged.dailyRerollsUsed = 0;
      merged.dailySeedOffset = 0;
    }
    return merged;
  } catch {
    return createDefaultMetaSave();
  }
}

export function saveMetaSave(meta: MetaSave): void {
  const st = getStorage();
  if (!st) return;
  try {
    st.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadRunCheckpoint(): RunCheckpoint | null {
  const st = getStorage();
  if (!st) return null;
  try {
    const raw = st.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RunCheckpoint;
  } catch {
    return null;
  }
}

export function saveRunCheckpoint(cp: RunCheckpoint | null): void {
  const st = getStorage();
  if (!st) return;
  try {
    if (!cp) st.removeItem(CHECKPOINT_KEY);
    else st.setItem(CHECKPOINT_KEY, JSON.stringify(cp));
  } catch {
    // Ignore
  }
}

export function exportSaveCode(meta: MetaSave): string {
  const json = JSON.stringify(meta);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function importSaveCode(code: string): MetaSave | null {
  try {
    const bin = atob(code.trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as MetaSave;
    if (!parsed || typeof parsed.gems !== 'number') return null;
    const def = createDefaultMetaSave();
    const merged = { ...def, ...parsed };
    saveMetaSave(merged);
    return merged;
  } catch {
    return null;
  }
}

export function unlockAchievementInMeta(meta: MetaSave, achId: string): { unlockedNow: boolean; title: string; reward: number } {
  const def = ACHIEVEMENTS.find((a) => a.id === achId);
  if (!def || meta.achievements[achId]) {
    return { unlockedNow: false, title: def?.title ?? achId, reward: 0 };
  }
  meta.achievements[achId] = true;
  meta.gems += def.rewardGems;
  if (achId === 'first_clear' && !meta.unlockedHeroes.includes('blade_ashura')) {
    meta.unlockedHeroes.push('blade_ashura');
  }
  if (achId === 'first_clear' && !meta.unlockedPets.includes('mini_dragon')) {
    meta.unlockedPets.push('mini_dragon');
  }
  if (achId === 'sticker_collector_10' && !meta.unlockedPets.includes('sticker_fairy')) {
    meta.unlockedPets.push('sticker_fairy');
  }
  saveMetaSave(meta);
  return { unlockedNow: true, title: def.title, reward: def.rewardGems };
}

export function recordWeaponSeen(meta: MetaSave, id: WeaponId): void {
  meta.weaponsSeen[id] = (meta.weaponsSeen[id] ?? 0) + 1;
}

export function recordStickerSeen(meta: MetaSave, id: StickerId): boolean {
  meta.stickersSeen[id] = (meta.stickersSeen[id] ?? 0) + 1;
  if (Object.keys(meta.stickersSeen).length >= 10 && !meta.achievements.sticker_collector_10) {
    unlockAchievementInMeta(meta, 'sticker_collector_10');
    return true;
  }
  return false;
}

export function settleRunIntoMeta(
  meta: MetaSave,
  opts: {
    won: boolean;
    floor: number;
    gemsEarned: number;
    coinsRemaining: number;
    materials: Partial<Record<MaterialId, number>>;
    seeds: Partial<Record<PlantId, number>>;
    weaponsHeld: WeaponId[];
    isDailyChallenge: boolean;
  }
): { totalGems: number } {
  const coinBonusGems = Math.floor(opts.coinsRemaining * 1.2);
  let totalGems = opts.gemsEarned + coinBonusGems + opts.floor * 45;

  const today = todayDateString();
  if (opts.won && opts.isDailyChallenge && meta.dailyCompletedDay !== today) {
    meta.dailyCompletedDay = today;
    totalGems += 1500;
  }

  meta.gems += totalGems;
  meta.runsPlayed += 1;
  if (opts.won) meta.runsWon += 1;
  meta.bestFloor = Math.max(meta.bestFloor, opts.floor);

  for (const [k, v] of Object.entries(opts.materials)) {
    const mk = k as MaterialId;
    meta.materials[mk] = (meta.materials[mk] ?? 0) + (v ?? 0);
  }
  for (const [k, v] of Object.entries(opts.seeds)) {
    const pk = k as PlantId;
    meta.seeds[pk] = (meta.seeds[pk] ?? 0) + (v ?? 0);
  }

  // Gold frame weapons on 3-5 victory!
  if (opts.won) {
    for (const wid of opts.weaponsHeld) {
      meta.weaponsGoldFrame[wid] = true;
    }
  }

  // Advance garden dual-maturity run counter!
  for (const plot of meta.garden) {
    if (plot.unlocked && plot.plantId && plot.watered) {
      plot.runsSincePlanted += 1;
    }
  }

  // Clear one-time run preparations after completing run
  meta.preparedWeapon = null;
  meta.preparedStickers = [];
  meta.preparedTalents = [];
  meta.preparedLucky = false;

  saveMetaSave(meta);
  saveRunCheckpoint(null);
  return { totalGems };
}

export function canUnlockHero(meta: MetaSave, heroId: HeroId, cost: number): boolean {
  if (meta.unlockedHeroes.includes(heroId)) return false;
  if (cost < 0) return false;
  return meta.gems >= cost;
}

export function canUnlockPet(meta: MetaSave, petId: PetId, cost: number): boolean {
  if (meta.unlockedPets.includes(petId)) return false;
  if (cost < 0) return false;
  return meta.gems >= cost;
}
