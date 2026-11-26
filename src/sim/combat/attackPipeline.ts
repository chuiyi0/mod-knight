import { getHeroStatsAtLevel, HEROES } from '../../content/heroes';
import { NON_CHAOS_STICKER_IDS, STICKERS } from '../../content/stickers';
import { WEAPONS } from '../../content/weapons';
import { SeededRNG } from '../rng';
import {
  DailyFactorId,
  ElementTag,
  PlayerState,
  StickerId,
  WeaponDef,
  WeaponInstance
} from '../types';

export interface AttackContext {
  weaponDef: WeaponDef;
  weapon: WeaponInstance;
  effectiveStickers: StickerId[];
  damage: number;
  manaCost: number;
  coinCost: number;
  critChance: number;
  critMult: number;
  fireRate: number;
  projectileCount: number;
  spreadRad: number;
  scale: number;
  speed: number;
  range: number;
  pierce: number;
  mode: 'melee' | 'bullet' | 'laser' | 'lob';
  meleeHasBonusBeam: boolean;
  meleeRadius: number;
  meleeArcRad: number;
  homingStrength: number;
  bounces: number;
  boomerangReturn: boolean;
  elements: ElementTag[];
  explosiveChance: number;
  chainLightning: boolean;
  poisonPool: boolean;
  nukeOnEnd: boolean;
  reflectBullets: boolean;
  vampireDrop: boolean;
  killChain: boolean;
  spawnChicken: boolean;
  duckChance: number;
  coinDropBonus: boolean;
  sonicRing: boolean;
  shadowClone: boolean;
  canBreakCrackedWall: boolean;
  laserWidthMult: number;
  onePunchReady: boolean;
}

export function getWeaponMaxSlots(
  player: PlayerState,
  weapon: WeaponInstance,
  dailyFactors: DailyFactorId[] = []
): number {
  const def = WEAPONS[weapon.defId];
  const heroStats = getHeroStatsAtLevel(player.heroId, player.heroLevel);
  const smithBonus = player.heroId === 'sticker_smith' && heroStats.hasPassive ? 1 : 0;
  const talentBonus = player.talents.includes('sticker_slot_plus') ? 1 : 0;
  const factorBonus = dailyFactors.includes('sticker_sale') ? 1 : 0;
  const starterLv7Bonus =
    heroStats.isMaxSkill && weapon.defId === HEROES[player.heroId].starterWeapon ? 1 : 0;
  return Math.min(
    4,
    def.baseSlots + weapon.extraSlots + smithBonus + talentBonus + factorBonus + starterLv7Bonus
  );
}

export function buildAttackContext(
  player: PlayerState,
  weapon: WeaponInstance,
  rng: SeededRNG,
  options?: {
    halfManaCost?: boolean;
    overrideStickers?: StickerId[];
    dailyFactors?: DailyFactorId[];
    isShadowClone?: boolean;
  }
): AttackContext {
  const def = WEAPONS[weapon.defId];
  const hero = HEROES[player.heroId];
  const heroStats = getHeroStatsAtLevel(player.heroId, player.heroLevel);
  const factors = options?.dailyFactors ?? [];

  const glueBoost = player.talents.includes('glue_boost') ? 0.25 : 0;
  const stickerPowerMult = 1 + (def.stickerPowerBonus ?? 0) + glueBoost;

  const rawStickers = options?.overrideStickers ?? weapon.stickers;
  const effectiveStickers: StickerId[] = [];
  for (const s of rawStickers) {
    if (s === 'chaos_random') {
      const pool = NON_CHAOS_STICKER_IDS.filter((id) => !rawStickers.includes(id));
      const shuffled = rng.shuffle(pool);
      if (shuffled[0]) effectiveStickers.push(shuffled[0]);
      if (shuffled[1]) effectiveStickers.push(shuffled[1]);
    } else {
      effectiveStickers.push(s);
    }
  }

  const onePunchReady = Boolean(def.onePunch && !weapon.onePunchSpent);
  let damage = onePunchReady
    ? def.damage
    : (def.onePunch ? 8 : def.damage) + weapon.damageBonus;
  let manaCost = def.manaCost;
  const coinCost = def.coinCost ?? 0;
  let critChance = def.critChance + hero.critChance;
  let critMult = 2.0;
  let fireRate = def.fireRate;
  let projectileCount = def.projectileCount;
  let spreadRad = def.spreadRad;
  let scale = 1.0;
  const speed = def.projectileSpeed * (factors.includes('turbo_speed') ? 1.25 : 1);
  const range = def.range;
  let pierce = def.pierce ?? 0;
  let mode: AttackContext['mode'] = def.mode;
  let meleeHasBonusBeam =
    def.id === 'goblin_totem' ||
    def.id === 'yeti_frostfist' ||
    def.id === 'glitch_404_sword';
  let meleeRadius = def.meleeRadius ?? 28;
  const meleeArcRad = def.meleeArcRad ?? 2.0;
  let homingStrength = def.id === 'goose_bill_cannon' ? 4.8 : 0;
  let bounces = player.talents.includes('bullet_bounce') ? 1 : 0;
  let boomerangReturn = Boolean(def.boomerang);
  const elementsSet = new Set<ElementTag>();
  let explosiveChance = def.mode === 'lob' ? 1 : 0;
  let chainLightning = def.id === 'thunder_staff';
  let poisonPool = false;
  let nukeOnEnd = false;
  let reflectBullets =
    def.id === 'rubber_chicken' ||
    def.id === 'skull_trumpet' ||
    def.id === 'yeti_frostfist';
  let vampireDrop = false;
  let killChain = false;
  let spawnChicken = false;
  let duckChance = def.id === 'glitch_404_sword' ? 0.22 : 0;
  let coinDropBonus = def.id === 'goose_bill_cannon';
  let sonicRing = def.id === 'rubber_chicken';
  let shadowClone = false;
  let laserWidthMult = player.talents.includes('laser_thick') ? 1.5 : 1.0;
  let canBreakCrackedWall =
    def.id === 'medieval_mortar' ||
    def.id === 'takeout_box' ||
    def.id === 'goblin_totem' ||
    def.id === 'meteor_tome' ||
    def.id === 'sword_40m' ||
    def.mode === 'laser';

  // Innate weapon elementals
  if (def.id === 'salted_fish' || def.id === 'frost_prism' || def.id === 'yeti_frostfist') {
    elementsSet.add('ice');
  }
  if (
    def.id === 'twin_flamethrower' ||
    def.id === 'meteor_tome' ||
    def.id === 'ramen_launcher' ||
    def.id === 'solar_cannon' ||
    def.id === 'mech_laser_arm'
  ) {
    elementsSet.add('fire');
  }
  if (def.id === 'twin_lightsaber' || def.id === 'dragon_twin_breath') {
    elementsSet.add(weapon.shotCounter % 2 === 0 ? 'ice' : 'fire');
  }

  // Hero Lv.6 Passives
  if (player.heroId === 'blade_ashura' && heroStats.hasPassive) {
    meleeRadius *= 1.25;
  }

  // Talents
  if (player.talents.includes('shotgun_plus') && def.projectileCount >= 2) {
    projectileCount += 2;
  }
  if (player.talents.includes('crit_precision')) {
    spreadRad *= 0.5;
    critChance += 0.1;
  }
  if (player.talents.includes('charge_fast') && (def.category === 'bow' || def.category === 'staff')) {
    fireRate *= 1.25;
    damage *= 1.15;
  }
  if (player.talents.includes('attack_speed')) {
    fireRate *= 1.18;
    meleeRadius *= 1.2;
  }

  // Gentler mana economy: scale down heavy base mana costs & cap sticker mana penalty at +2!
  manaCost = manaCost <= 1 ? manaCost : Math.max(1, Math.round(manaCost * 0.65));
  let stickerManaDelta = 0;
  for (const s of rawStickers) {
    let delta = STICKERS[s].manaDelta;
    if (delta > 0 && player.talents.includes('glue_boost')) {
      delta = Math.floor(delta / 2);
    }
    stickerManaDelta += delta;
  }
  manaCost += Math.min(2, stickerManaDelta);

  // Apply sticker hooks
  for (const s of effectiveStickers) {
    switch (s) {
      case 'homing':
        homingStrength = Math.max(homingStrength, 6.2 * stickerPowerMult);
        if (def.mode === 'melee') meleeHasBonusBeam = true;
        break;
      case 'triple_split': {
        const extra = player.talents.includes('shotgun_plus') ? 3 : 2;
        projectileCount += extra;
        spreadRad = Math.max(spreadRad, 0.42);
        damage *= 0.78 * (1 + (stickerPowerMult - 1) * 0.4);
        if (def.mode === 'melee') meleeHasBonusBeam = true;
        break;
      }
      case 'laserize':
        if (def.mode === 'melee') meleeHasBonusBeam = true;
        mode = 'laser';
        canBreakCrackedWall = true;
        break;
      case 'bounce':
        bounces += 2;
        if (def.mode === 'melee') meleeHasBonusBeam = true;
        break;
      case 'giant':
        scale *= 1.65;
        meleeRadius *= 1.45;
        damage *= 1 + 0.35 * stickerPowerMult;
        break;
      case 'boomerang_return':
        boomerangReturn = true;
        pierce = Math.max(pierce, 3);
        if (def.mode === 'melee') meleeHasBonusBeam = true;
        break;
      case 'fire_pepper':
        elementsSet.add('fire');
        explosiveChance = Math.max(explosiveChance, 0.4 * stickerPowerMult);
        canBreakCrackedWall = true;
        break;
      case 'subzero':
        elementsSet.add('ice');
        critChance += 0.1 * stickerPowerMult;
        break;
      case 'volt_chain':
        elementsSet.add('lightning');
        chainLightning = true;
        break;
      case 'snail_poison':
        elementsSet.add('poison');
        poisonPool = true;
        break;
      case 'nuclear_nuke':
        if ((weapon.shotCounter + 1) % 5 === 0) {
          nukeOnEnd = true;
          canBreakCrackedWall = true;
        }
        break;
      case 'ice_fire_duo':
        elementsSet.add(weapon.shotCounter % 2 === 0 ? 'ice' : 'fire');
        break;
      case 'rapid_fire':
        fireRate *= 1 + 0.5 * stickerPowerMult;
        spreadRad += 0.1;
        break;
      case 'eco_mana':
        break;
      case 'reflect_armor':
        reflectBullets = true;
        break;
      case 'crit_overdrive':
        critChance += 0.2 * stickerPowerMult;
        critMult = Math.max(critMult, 2.8);
        break;
      case 'vampire_mosquito':
        vampireDrop = true;
        break;
      case 'kill_chain':
        killChain = true;
        break;
      case 'egg_chicken':
        if ((weapon.shotCounter + 1) % 3 === 0) {
          spawnChicken = true;
        }
        if (def.mode === 'melee') meleeHasBonusBeam = true;
        break;
      case 'duck_curse':
        duckChance = Math.max(duckChance, 0.16 * stickerPowerMult);
        break;
      case 'coin_shower':
        coinDropBonus = true;
        damage += Math.floor(player.coinsSpentTotal / 100);
        break;
      case 'boombox_sonic':
        sonicRing = true;
        critChance += 0.12;
        break;
      case 'shadow_clone':
        if (!options?.isShadowClone) shadowClone = true;
        break;
      case 'chaos_random':
        break;
    }
  }

  // Berserker statue buff
  if (player.berserkStatueTimer > 0) {
    scale *= 1.35;
    damage += 3;
  }

  // Daily factors
  if (factors.includes('giant_weapons')) {
    scale *= 1.4;
    damage *= 1.25;
  }
  if (factors.includes('glass_cannon')) {
    damage *= 2;
  }

  // Laser talent boost
  if (mode === 'laser' && player.talents.includes('laser_thick')) {
    damage *= 1.25;
  }

  // Fire & poison talent boosts
  if (elementsSet.has('fire') && player.talents.includes('fire_shield')) {
    damage *= 1.25;
  }
  if (elementsSet.has('poison') && player.talents.includes('poison_shield')) {
    damage *= 1.25;
  }

  // Ranger Cat guaranteed crit window
  if (player.guaranteedCritTimer > 0) {
    critChance = 1.0;
  }

  // Carrot Gatling every 10th giant golden carrot
  if (def.id === 'carrot_gatling' && (weapon.shotCounter + 1) % 10 === 0) {
    damage *= 3;
    scale *= 1.8;
    pierce += 4;
  }

  // Coin gun degrades gracefully if broke
  if (def.id === 'coin_gun' && player.coins < coinCost) {
    damage = Math.max(4, Math.round(damage * 0.3));
  }

  if (options?.isShadowClone) {
    damage *= 0.65;
    manaCost = 0;
  }

  manaCost = Math.max(0, manaCost);
  if (options?.halfManaCost || factors.includes('infinite_mana')) {
    manaCost = Math.floor(manaCost / 2);
  }

  return {
    weaponDef: def,
    weapon,
    effectiveStickers,
    damage: Math.max(1, Math.round(damage)),
    manaCost,
    coinCost: !options?.isShadowClone && player.coins >= coinCost ? coinCost : 0,
    critChance: Math.min(1, critChance),
    critMult,
    fireRate,
    projectileCount: Math.max(1, projectileCount),
    spreadRad,
    scale,
    speed,
    range,
    pierce,
    mode,
    meleeHasBonusBeam,
    meleeRadius,
    meleeArcRad,
    homingStrength,
    bounces,
    boomerangReturn,
    elements: Array.from(elementsSet),
    explosiveChance,
    chainLightning,
    poisonPool,
    nukeOnEnd,
    reflectBullets,
    vampireDrop,
    killChain,
    spawnChicken,
    duckChance,
    coinDropBonus,
    sonicRing,
    shadowClone,
    canBreakCrackedWall,
    laserWidthMult,
    onePunchReady
  };
}
