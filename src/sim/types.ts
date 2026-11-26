export const TILE_SIZE = 16;
export const SIM_DT = 1 / 60;
export const MAX_PLAYER_PROJECTILES = 180;
export const MAX_SUMMONS = 16;
export const MAX_WEAPON_VAULT = 6;
export const SHIELD_REGEN_DELAY = 3.5;
export const SHIELD_REGEN_INTERVAL = 0.85;

export type PlayerId = string;

export type HeroId =
  | 'bucket_knight'
  | 'sticker_smith'
  | 'ranger_cat'
  | 'alchemist_quirk'
  | 'slacker_priest'
  | 'blade_ashura';

export type PetId =
  | 'orange_cat'
  | 'greedy_slime'
  | 'mecha_duck'
  | 'mini_dragon'
  | 'ghost_lantern'
  | 'sticker_fairy';

export type Rarity = 'white' | 'green' | 'blue' | 'purple' | 'orange' | 'red';
export type WeaponCategory = 'melee' | 'gun' | 'staff' | 'bow' | 'quirk' | 'boss';
export type ElementTag = 'fire' | 'ice' | 'lightning' | 'poison';

export type WeaponId =
  | 'salted_fish'
  | 'bug_zapper'
  | 'sword_40m'
  | 'folding_stool'
  | 'plunger_spear'
  | 'twin_lightsaber'
  | 'golden_pan'
  | 'worn_pistol'
  | 'goblin_gatling'
  | 'pixel_shotgun'
  | 'medieval_mortar'
  | 'coin_gun'
  | 'dwarf_sniper'
  | 'ramen_launcher'
  | 'twin_flamethrower'
  | 'thunder_staff'
  | 'meteor_tome'
  | 'slime_staff'
  | 'keyboard_bible'
  | 'frost_prism'
  | 'blackhole_vacuum'
  | 'slingshot'
  | 'hero_multibow'
  | 'solar_cannon'
  | 'boomerang_blade'
  | 'rubber_chicken'
  | 'carrot_gatling'
  | 'magic_hat'
  | 'takeout_box'
  | 'one_punch_glove'
  | 'goblin_totem'
  | 'yeti_frostfist'
  | 'skull_trumpet'
  | 'mech_laser_arm'
  | 'dragon_twin_breath'
  | 'glitch_404_sword'
  | 'goose_bill_cannon';

export type StickerId =
  | 'homing'
  | 'triple_split'
  | 'laserize'
  | 'bounce'
  | 'giant'
  | 'boomerang_return'
  | 'fire_pepper'
  | 'subzero'
  | 'volt_chain'
  | 'snail_poison'
  | 'nuclear_nuke'
  | 'ice_fire_duo'
  | 'rapid_fire'
  | 'eco_mana'
  | 'reflect_armor'
  | 'crit_overdrive'
  | 'vampire_mosquito'
  | 'kill_chain'
  | 'egg_chicken'
  | 'duck_curse'
  | 'coin_shower'
  | 'boombox_sonic'
  | 'shadow_clone'
  | 'chaos_random';

export type TalentId =
  | 'blue_shield'
  | 'fire_shield'
  | 'poison_shield'
  | 'ice_shield'
  | 'melee_reflect'
  | 'vampire_aura'
  | 'shotgun_plus'
  | 'bullet_bounce'
  | 'laser_thick'
  | 'crit_precision'
  | 'charge_fast'
  | 'attack_speed'
  | 'sticker_slot_plus'
  | 'glue_boost'
  | 'sticker_salvage'
  | 'vip_discount'
  | 'curiosity_sense'
  | 'gambler_luck'
  | 'extra_weapon_slot'
  | 'kill_mana'
  | 'crate_potions'
  | 'gold_armor'
  | 'skill_cdr'
  | 'pet_frenzy';

export type BiomeId =
  | 'goblin_ruins'
  | 'frost_castle'
  | 'skeleton_crypt'
  | 'alchemy_factory'
  | 'volcano_palace'
  | 'astral_void';

export type MaterialId =
  | 'iron'
  | 'magic_shard'
  | 'wood'
  | 'quirk_part'
  | 'glow_glue'
  | 'core_crystal';

export type PlantId =
  | 'gem_tree'
  | 'iron_cactus'
  | 'fire_chili'
  | 'mandrake_poison'
  | 'frost_lotus'
  | 'sticker_vine'
  | 'carrot_tree'
  | 'lucky_clover';

export type DailyFactorId =
  | 'sticker_sale'
  | 'infinite_mana'
  | 'giant_weapons'
  | 'half_skill_cd'
  | 'curiosity_boom'
  | 'crit_explode'
  | 'double_boss'
  | 'glass_cannon'
  | 'weapon_roulette'
  | 'monster_split'
  | 'melee_only'
  | 'turbo_speed';

export type RoomKind =
  | 'start'
  | 'combat'
  | 'shop'
  | 'chest'
  | 'curiosity'
  | 'bounty'
  | 'secret'
  | 'portal'
  | 'boss';

export type ZoneFlavor = 'normal' | 'treasure' | 'market' | 'boss_lair';

export interface PortalDestination {
  biome: BiomeId;
  flavor: ZoneFlavor;
  label: string;
}

export type CuriosityKind =
  | 'sticker_workshop'
  | 'reforge_forge'
  | 'recycle_bot'
  | 'ancient_statue'
  | 'slot_machine'
  | 'demon_altar'
  | 'wishing_well'
  | 'mimic_chest'
  | 'black_merchant'
  | 'fate_wheel'
  | 'tavern_merc'
  | 'quack_clinic'
  | 'arena_trial'
  | 'talent_enchanter'
  | 'weapon_collector'
  | 'bonus_dimension';

export type StatueId =
  | 'knight'
  | 'paladin'
  | 'berserker'
  | 'assassin'
  | 'priest'
  | 'fortune_cat';

export type MercKind = 'chef' | 'archer' | 'bomber' | 'mage';

export const enum TileType {
  VOID = 0,
  FLOOR = 1,
  WALL = 2,
  DOOR_OPEN = 3,
  DOOR_LOCKED = 4,
  CRACKED_WALL = 5,
  LAVA = 6,
  ICE = 7,
  CONVEYOR_R = 8
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputCommand {
  playerId: PlayerId;
  moveX: number;
  moveY: number;
  aimX?: number;
  aimY?: number;
  fireHeld: boolean;
  firePressed: boolean;
  skillPressed: boolean;
  switchPressed: boolean;
  interactPressed: boolean;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  rarity: Rarity;
  category: WeaponCategory;
  damage: number;
  manaCost: number;
  critChance: number;
  fireRate: number;
  projectileSpeed: number;
  projectileCount: number;
  spreadRad: number;
  range: number;
  baseSlots: number;
  mode: 'melee' | 'bullet' | 'laser' | 'lob';
  meleeArcRad?: number;
  meleeRadius?: number;
  coinCost?: number;
  stickerPowerBonus?: number;
  backShield?: boolean;
  onePunch?: boolean;
  pierce?: number;
  boomerang?: boolean;
  desc: string;
  jokeTag: string;
  color: string;
  forgeCost: Partial<Record<MaterialId, number>>;
}

export interface WeaponInstance {
  uid: string;
  defId: WeaponId;
  stickers: StickerId[];
  extraSlots: number;
  damageBonus: number;
  shotCounter: number;
  onePunchSpent?: boolean;
}

export interface StickerDef {
  id: StickerId;
  name: string;
  shortTag: string;
  rarity: Rarity;
  category: 'trajectory' | 'element' | 'stat' | 'meme';
  manaDelta: number;
  color: string;
  desc: string;
}

export interface TalentDef {
  id: TalentId;
  name: string;
  icon: string;
  category: 'defense' | 'offense' | 'mod' | 'utility';
  desc: string;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  baseHp: number;
  baseShield: number;
  baseMana: number;
  moveSpeed: number;
  critChance: number;
  starterWeapon: WeaponId;
  skillName: string;
  skillDesc: string;
  skillCooldown: number;
  passiveDesc: string;
  unlockCost: number;
  color: string;
  accentColor: string;
  lobbyLine: string;
}

export interface PetDef {
  id: PetId;
  name: string;
  unlockCost: number;
  unlockHint: string;
  desc: string;
  color: string;
}

export interface PlayerState {
  id: PlayerId;
  heroId: HeroId;
  heroLevel: number;
  petId: PetId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  facingX: number;
  facingY: number;
  aimAngle: number;
  lockedEnemyId: string | null;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  mana: number;
  maxMana: number;
  coins: number;
  coinsSpentTotal: number;
  gemsEarned: number;
  materialsEarned: Partial<Record<MaterialId, number>>;
  seedsEarned: Partial<Record<PlantId, number>>;
  weapons: WeaponInstance[];
  activeWeaponIndex: number;
  /** Up to 6 spare weapons stored in bag for swapping or batch recycling */
  weaponVault: WeaponInstance[];
  /** Auto-collected stickers waiting in bag to be attached/swapped anytime */
  stickerBag: StickerId[];
  attackCooldown: number;
  skillCooldown: number;
  skillMaxCooldown: number;
  skillCharges: number;
  maxSkillCharges: number;
  dualWieldTimer: number;
  guaranteedCritTimer: number;
  berserkStatueTimer: number;
  campfireBuffTimer: number;
  paladinBarrier: boolean;
  statueId: StatueId | null;
  invulnTimer: number;
  shieldDelayTimer: number;
  shieldRegenTimer: number;
  hitFlashTimer: number;
  miniPlayerScale: number;
  talents: TalentId[];
  enhancedTalents: TalentId[];
  kills: number;
  vampireKillCounter: number;
  merchantAngered: boolean;
  demonDealsBought: number;
  luckyBlessing: boolean;
  alive: boolean;
  reviveUsed: boolean;
}

export interface PetState {
  id: PetId;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  sleepTimer: number;
  attackCooldown: number;
  abilityCooldown: number;
  roomsClearedCounter: number;
  facingX: number;
  alertText?: string;
  alertTimer?: number;
}

export interface MercState {
  id: string;
  kind: MercKind;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  alive: boolean;
  weaponId?: WeaponId;
  speech?: string;
  speechTimer?: number;
}

export interface TurretState {
  id: string;
  ownerId: PlayerId;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  fireCooldown: number;
  stickers: StickerId[];
  damage: number;
}

export interface SummonState {
  id: string;
  ownerId: PlayerId;
  kind: 'chicken' | 'slime' | 'skeleton';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  element?: ElementTag;
}

export interface SanctuaryZone {
  x: number;
  y: number;
  radius: number;
  timer: number;
  healTick: number;
  levelMax: boolean;
}

export interface BlackHoleZone {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  timer: number;
  damageTick: number;
}

export type EnemyKind =
  | 'goblin_spear'
  | 'goblin_dart'
  | 'goblin_bomber'
  | 'goblin_shaman'
  | 'boar_rider'
  | 'snowman_roller'
  | 'ice_miner'
  | 'blizzard_sprite'
  | 'frost_troll'
  | 'skeleton_shield'
  | 'skeleton_archer'
  | 'skeleton_mage'
  | 'boom_skull'
  | 'headless_knight'
  | 'clockwork_gunner'
  | 'alchemy_turret'
  | 'goblin_chemist'
  | 'spring_boxer'
  | 'lava_slime_king'
  | 'obsidian_knight'
  | 'baby_drake'
  | 'inferno_warlock'
  | 'astral_eye'
  | 'void_tentacle'
  | 'glitch_ghost'
  | 'ufo_elite'
  | 'angry_frog'
  | 'mimic_chest_boss'
  | 'armed_merchant'
  | 'gold_slime'
  | 'boss_totem_pillar'
  | 'boss_drone'
  | 'boss_glitch_clone'
  // 6 World Bosses + 1 Secret Boss
  | 'boss_goblin_priest'
  | 'boss_yeti_king'
  | 'boss_skeleton_lord'
  | 'boss_steam_mech'
  | 'boss_twin_dragon'
  | 'boss_glitch_lord'
  | 'boss_goose_king';

export interface EnemyState {
  id: string;
  kind: EnemyKind;
  name: string;
  roomId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  isElite: boolean;
  isBoss: boolean;
  /** Optional clearly-marked Field Bounty Boss: stays neutral until player approaches or shoots! */
  isBounty?: boolean;
  bountyAwake?: boolean;
  attackCooldown: number;
  aiTimer: number;
  aiPhase: number;
  facingX: number;
  hitFlashTimer: number;
  burnTimer: number;
  burnTickTimer: number;
  poisonTimer: number;
  poisonTickTimer: number;
  freezeTimer: number;
  stunTimer: number;
  duckTimer: number;
  ccDiminishTimer: number;
  shieldBonus: number;
  stageTriggered?: boolean;
  bossSpeech?: string;
  bossSpeechTimer?: number;
  splitChild?: boolean;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isCrit: boolean;
  life: number;
  maxLife: number;
  color: string;
  shape:
    | 'orb'
    | 'bolt'
    | 'fish'
    | 'coin'
    | 'bomb'
    | 'wave'
    | 'carrot'
    | 'dart'
    | 'meteor'
    | 'text'
    | 'arrow'
    | 'boomerang'
    | 'bill'
    | 'card';
  labelText?: string;
  pierce: number;
  bouncesLeft: number;
  homingStrength: number;
  boomerangReturn?: boolean;
  returning?: boolean;
  elements: ElementTag[];
  explosiveRadius?: number;
  canBreakCrackedWall?: boolean;
  destroysEnemyBullets?: boolean;
  isLob?: boolean;
  targetX?: number;
  targetY?: number;
  spawnChickenOnEnd?: boolean;
  duckChance?: number;
  nukeOnEnd?: boolean;
  vampireDrop?: boolean;
  killChain?: boolean;
  coinDropBonus?: boolean;
  sourceWeaponId?: WeaponId;
  hitIds: string[];
}

export interface LaserBeamEffect {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  life: number;
  maxLife: number;
  fromPlayer: boolean;
}

export interface MeleeSlashEffect {
  id: string;
  x: number;
  y: number;
  angle: number;
  arcRad: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface HazardZone {
  id: string;
  kind: 'meteor_warn' | 'fire_pool' | 'poison_pool' | 'ice_pool' | 'bomb_warn' | 'laser_warn';
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  damage: number;
  fromPlayer: boolean;
  canBreakWall?: boolean;
}

export type PropKind =
  | 'pillar'
  | 'crate'
  | 'barrel_red'
  | 'barrel_ice'
  | 'barrel_poison'
  | 'tombstone'
  | 'coffee_machine'
  | 'ore_vein';

export interface PropState {
  id: string;
  roomId: string;
  kind: PropKind;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
}

export type PickupKind = 'coin' | 'mana' | 'hp_potion' | 'weapon' | 'sticker' | 'material' | 'seed' | 'blood_drop';

export interface PickupState {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  weapon?: WeaponInstance;
  stickerId?: StickerId;
  materialId?: MaterialId;
  plantId?: PlantId;
  price?: number;
  hpCost?: number;
  label?: string;
  roomId?: string;
}

export interface ShopItem {
  id: string;
  kind: 'sticker' | 'weapon' | 'heal' | 'transfer_sticker' | 'add_slot' | 'stat_boost' | 'reforge' | 'upgrade_dmg' | 'shield_boost';
  stickerId?: StickerId;
  weapon?: WeaponInstance;
  price: number;
  hpCost?: number;
  sold: boolean;
  label: string;
  desc?: string;
}

export interface InteractableState {
  id: string;
  roomId: string;
  kind:
    | 'chest'
    | 'portal'
    | 'secret_goose_door'
    | 'slot_machine'
    | 'wishing_well'
    | 'workshop_npc'
    | 'merchant_npc'
    | 'demon_npc'
    | 'forge_npc'
    | 'recycle_bot'
    | 'statue'
    | 'mimic_red'
    | 'mimic_blue'
    | 'fate_wheel'
    | 'tavern_npc'
    | 'clinic_npc'
    | 'arena_flag'
    | 'enchanter_npc'
    | 'collector_npc'
    | 'bonus_portal'
    | 'campfire'
    | 'rune_plate';
  x: number;
  y: number;
  radius: number;
  used: boolean;
  usesCount: number;
  cost: number;
  hp?: number;
  statueId?: StatueId;
  mercKind?: MercKind;
  portalDest?: PortalDestination;
  speech?: string;
  speechTimer?: number;
  shopItems?: ShopItem[];
}

export interface RoomData {
  id: string;
  gx: number;
  gy: number;
  kind: RoomKind;
  curiosityKind?: CuriosityKind;
  secretContent?: 'sticker_vault' | 'dev_room' | 'gold_slimes' | 'goose_door';
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  discovered: boolean;
  cleared: boolean;
  locked: boolean;
  wave: number;
  maxWaves: number;
  doorTiles: Vec2[];
  secretWallTiles?: Vec2[];
  secretRevealed?: boolean;
  arenaActive?: boolean;
  runeRewardGiven?: boolean;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity?: number;
}

export type FloorRuleMutator = 'none' | 'big_head' | 'coin_rush' | 'low_gravity' | 'weapon_swap';

export type SimEvent =
  | { type: 'sfx'; sound: string; pitch?: number }
  | { type: 'shake'; intensity: number; duration: number }
  | { type: 'hitstop'; duration: number }
  | { type: 'toast'; text: string; color?: string }
  | { type: 'sticker_pickup'; stickerId: StickerId; pickupId: string }
  | { type: 'workshop_open'; interactableId: string }
  | { type: 'talent_choice'; options: TalentId[] }
  | { type: 'floor_complete'; nextFloor: number }
  | { type: 'run_victory'; canEndless: boolean }
  | { type: 'run_gameover' }
  | { type: 'achievement'; id: string; title: string };

export interface FloorMap {
  width: number;
  height: number;
  tiles: Uint8Array;
  rooms: RoomData[];
  startRoomId: string;
  bossRoomId?: string;
}

export interface WorldState {
  seed: number;
  floor: number;
  worldIndex: number;
  stageIndex: number;
  biome: BiomeId;
  zoneFlavor: ZoneFlavor;
  biomePerWorld: Record<number, BiomeId>;
  time: number;
  status: 'playing' | 'paused_modal' | 'victory' | 'gameover';
  endlessMode: boolean;
  dailyFactors: DailyFactorId[];
  floorMutator: FloorRuleMutator;
  weaponSwapTimer: number;
  bonusTimer: number;
  explorationRewarded: boolean;
  map: FloorMap;
  players: Record<PlayerId, PlayerState>;
  pet: PetState;
  mercs: MercState[];
  turrets: TurretState[];
  summons: SummonState[];
  sanctuaries: SanctuaryZone[];
  blackHoles: BlackHoleZone[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  lasers: LaserBeamEffect[];
  slashes: MeleeSlashEffect[];
  hazards: HazardZone[];
  props: PropState[];
  pickups: PickupState[];
  interactables: InteractableState[];
  floatingTexts: FloatingText[];
  particles: Particle[];
  activeRoomId: string;
  bossBannerTimer: number;
  bossBannerName: string;
  glitchBlueScreenTimer: number;
  pendingTalentOptions: TalentId[] | null;
  pendingPortalDest: PortalDestination | null;
  activeWorkshopId: string | null;
  events: SimEvent[];
}

export interface GardenPlot {
  unlocked: boolean;
  plantId: PlantId | null;
  watered: boolean;
  plantedDay: string | null;
  runsSincePlanted: number;
  harvestedToday: boolean;
}

export interface RunCheckpoint {
  version: number;
  seed: number;
  floor: number;
  endlessMode: boolean;
  biome: BiomeId;
  zoneFlavor: ZoneFlavor;
  biomePerWorld: Record<number, BiomeId>;
  dailyFactors: DailyFactorId[];
  heroId: HeroId;
  heroLevel: number;
  petId: PetId;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  mana: number;
  maxMana: number;
  coins: number;
  coinsSpentTotal: number;
  gemsEarned: number;
  materialsEarned: Partial<Record<MaterialId, number>>;
  seedsEarned: Partial<Record<PlantId, number>>;
  weapons: WeaponInstance[];
  activeWeaponIndex: number;
  weaponVault: WeaponInstance[];
  stickerBag: StickerId[];
  talents: TalentId[];
  enhancedTalents: TalentId[];
  statueId: StatueId | null;
  kills: number;
  merchantAngered: boolean;
  luckyBlessing: boolean;
  reviveUsed: boolean;
  retriesUsedOnFloor: number;
}

export interface MetaSave {
  version: number;
  gems: number;
  selectedHero: HeroId;
  selectedPet: PetId;
  unlockedHeroes: HeroId[];
  heroLevels: Record<HeroId, number>;
  unlockedPets: PetId[];
  materials: Record<MaterialId, number>;
  seeds: Record<PlantId, number>;
  garden: GardenPlot[];
  gachaPullsToday: number;
  gachaDay: string;
  gachaPity: number;
  dailyCompletedDay: string | null;
  dailyRerollsDay: string;
  dailyRerollsUsed: number;
  dailySeedOffset: number;
  bountiesClaimed: Record<string, boolean>;
  runsPlayed: number;
  runsWon: number;
  bestFloor: number;
  weaponsSeen: Record<string, number>;
  weaponsGoldFrame: Record<string, boolean>;
  bossBlueprints: Record<string, boolean>;
  stickersSeen: Record<string, number>;
  bossKills: Record<string, number>;
  achievements: Record<string, boolean>;
  preparedWeapon: WeaponInstance | null;
  preparedStickers: StickerId[];
  preparedTalents: TalentId[];
  preparedLucky: boolean;
  settings: {
    sfxEnabled: boolean;
    bgmEnabled: boolean;
    shakeEnabled: boolean;
    buttonScale: number;
    swapHands: boolean;
    touchOffsets: {
      fire: Vec2;
      skill: Vec2;
      switch: Vec2;
    };
    keyBindings: {
      fire: string;
      interact: string;
      skill: string;
      switch: string;
      bag: string;
    };
  };
}
