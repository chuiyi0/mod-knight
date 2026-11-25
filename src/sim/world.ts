import { BIOMES, WORLD_BIOME_CHOICES } from '../content/biomes';
import { getHeroStatsAtLevel, HEROES } from '../content/heroes';
import { STICKERS, STICKER_IDS } from '../content/stickers';
import { createWeaponInstance, MELEE_QUIRK_WEAPONS, NORMAL_DROP_WEAPONS, WEAPONS } from '../content/weapons';
import {
  circleIntersectsSolidTile,
  getTileAt,
  isSolidTile,
  moveCircleWithCollisions,
  raycastSolid,
  setTileAt
} from './collision';
import { AttackContext, buildAttackContext, getWeaponMaxSlots } from './combat/attackPipeline';
import {
  buyShopItemFromInteractable,
  CuriosityContext,
  handleInteractable,
  pickThreeTalents
} from './dungeon/curiosities';
import { createEnemy, spawnRoomWave } from './dungeon/enemies';
import { stepEnemyAI } from './dungeon/enemyAI';
import { generateFloor } from './dungeon/generator';
import { SeededRNG } from './rng';
import { updateAutoAim } from './targeting';
import {
  BiomeId,
  DailyFactorId,
  ElementTag,
  EnemyState,
  HeroId,
  InputCommand,
  InteractableState,
  MAX_PLAYER_PROJECTILES,
  MAX_SUMMONS,
  PetId,
  PickupState,
  PlayerState,
  ProjectileState,
  RoomData,
  RunCheckpoint,
  SHIELD_REGEN_DELAY,
  SHIELD_REGEN_INTERVAL,
  StickerId,
  TalentId,
  TILE_SIZE,
  TileType,
  WeaponId,
  WeaponInstance,
  WorldState
} from './types';

let simUid = 1;
const uid = (p: string) => `${p}_${simUid++}`;
const KEYBOARD_WORDS = ['急', '典', '孝', '破防', '乐', '绷'];

export interface NewRunOptions {
  seed?: number;
  heroId: HeroId;
  heroLevel?: number;
  petId: PetId;
  dailyFactors?: DailyFactorId[];
  preparedWeapon?: WeaponInstance | null;
  preparedStickers?: StickerId[];
  preparedTalents?: TalentId[];
  preparedLucky?: boolean;
  onUnlockAchievement?: (id: string) => void;
  onRecordWeapon?: (id: WeaponId) => void;
  onRecordSticker?: (id: StickerId) => void;
  onRecordBossKill?: (kind: string) => void;
}

export class GameWorld {
  state: WorldState;
  rng: SeededRNG;
  private hooks: {
    onUnlockAchievement?: (id: string) => void;
    onRecordWeapon?: (id: WeaponId) => void;
    onRecordSticker?: (id: StickerId) => void;
    onRecordBossKill?: (kind: string) => void;
  };

  constructor(opts: NewRunOptions) {
    const seed = opts.seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    this.rng = new SeededRNG(seed);
    this.hooks = {
      onUnlockAchievement: opts.onUnlockAchievement,
      onRecordWeapon: opts.onRecordWeapon,
      onRecordSticker: opts.onRecordSticker,
      onRecordBossKill: opts.onRecordBossKill
    };

    const biomePerWorld: Record<number, BiomeId> = {
      1: this.rng.pick(WORLD_BIOME_CHOICES[1]),
      2: this.rng.pick(WORLD_BIOME_CHOICES[2]),
      3: this.rng.pick(WORLD_BIOME_CHOICES[3])
    };
    const dailyFactors = opts.dailyFactors ?? [];
    const heroLevel = opts.heroLevel ?? 1;
    const hDef = HEROES[opts.heroId];
    const hStats = getHeroStatsAtLevel(opts.heroId, heroLevel);

    const starter = createWeaponInstance(hDef.starterWeapon);
    if (opts.preparedStickers && opts.preparedStickers.length > 0) {
      starter.stickers.push(opts.preparedStickers[0]);
    }
    const weapons: WeaponInstance[] = [starter];
    if (opts.preparedWeapon) {
      weapons.push({
        ...opts.preparedWeapon,
        stickers: opts.preparedWeapon.stickers.slice()
      });
    }

    const maxShieldBase = dailyFactors.includes('glass_cannon')
      ? Math.max(1, Math.floor(hStats.maxShield / 2))
      : hStats.maxShield;
    const skillCd =
      hStats.skillCooldown * (dailyFactors.includes('half_skill_cd') ? 0.5 : 1);

    const p1: PlayerState = {
      id: 'p1',
      heroId: opts.heroId,
      heroLevel,
      petId: opts.petId,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 6,
      facingX: 1,
      facingY: 0,
      aimAngle: 0,
      lockedEnemyId: null,
      hp: hStats.maxHp,
      maxHp: hStats.maxHp,
      shield: maxShieldBase,
      maxShield: maxShieldBase,
      mana: hStats.maxMana,
      maxMana: hStats.maxMana,
      coins: 20,
      coinsSpentTotal: 0,
      gemsEarned: 0,
      materialsEarned: {},
      seedsEarned: {},
      weapons,
      activeWeaponIndex: weapons.length - 1,
      attackCooldown: 0,
      skillCooldown: 0,
      skillMaxCooldown: skillCd,
      skillCharges: opts.heroId === 'ranger_cat' && hStats.isMaxSkill ? 2 : 1,
      maxSkillCharges: opts.heroId === 'ranger_cat' && hStats.isMaxSkill ? 2 : 1,
      dualWieldTimer: 0,
      guaranteedCritTimer: 0,
      berserkStatueTimer: 0,
      paladinBarrier: false,
      statueId: null,
      invulnTimer: 0,
      shieldDelayTimer: 0,
      shieldRegenTimer: 0,
      hitFlashTimer: 0,
      miniPlayerScale: 1,
      talents: (opts.preparedTalents ?? []).slice(),
      enhancedTalents: [],
      kills: 0,
      vampireKillCounter: 0,
      merchantAngered: false,
      demonDealsBought: 0,
      luckyBlessing: Boolean(opts.preparedLucky),
      alive: true,
      reviveUsed: false
    };

    this.state = this.buildFloorState(seed, 1, biomePerWorld, p1, dailyFactors, false);
    this.hooks.onRecordWeapon?.(starter.defId);
  }

  static fromCheckpoint(
    cp: RunCheckpoint,
    hooks?: {
      onUnlockAchievement?: (id: string) => void;
      onRecordWeapon?: (id: WeaponId) => void;
      onRecordSticker?: (id: StickerId) => void;
      onRecordBossKill?: (kind: string) => void;
    }
  ): GameWorld {
    const gw = new GameWorld({
      seed: cp.seed,
      heroId: cp.heroId,
      heroLevel: cp.heroLevel,
      petId: cp.petId,
      dailyFactors: cp.dailyFactors,
      ...hooks
    });
    const p1 = gw.getMainPlayer();
    p1.hp = cp.hp;
    p1.maxHp = cp.maxHp;
    p1.shield = cp.shield;
    p1.maxShield = cp.maxShield;
    p1.mana = cp.mana;
    p1.maxMana = cp.maxMana;
    p1.coins = cp.coins;
    p1.coinsSpentTotal = cp.coinsSpentTotal;
    p1.gemsEarned = cp.gemsEarned;
    p1.materialsEarned = { ...cp.materialsEarned };
    p1.seedsEarned = { ...cp.seedsEarned };
    p1.weapons = cp.weapons.map((w) => ({ ...w, stickers: w.stickers.slice() }));
    p1.activeWeaponIndex = Math.min(cp.activeWeaponIndex, p1.weapons.length - 1);
    p1.talents = cp.talents.slice();
    p1.enhancedTalents = cp.enhancedTalents.slice();
    p1.statueId = cp.statueId;
    p1.kills = cp.kills;
    p1.merchantAngered = cp.merchantAngered;
    p1.luckyBlessing = cp.luckyBlessing;
    p1.reviveUsed = cp.reviveUsed;

    gw.state = gw.buildFloorState(
      cp.seed + cp.floor * 7919,
      cp.floor,
      cp.biomePerWorld,
      p1,
      cp.dailyFactors,
      cp.endlessMode
    );
    return gw;
  }

  exportCheckpoint(retriesUsedOnFloor = 0): RunCheckpoint {
    const p = this.getMainPlayer();
    return {
      version: 1,
      seed: this.state.seed,
      floor: this.state.floor,
      endlessMode: this.state.endlessMode,
      biomePerWorld: { ...this.state.biomePerWorld },
      dailyFactors: this.state.dailyFactors.slice(),
      heroId: p.heroId,
      heroLevel: p.heroLevel,
      petId: p.petId,
      hp: p.hp,
      maxHp: p.maxHp,
      shield: p.shield,
      maxShield: p.maxShield,
      mana: p.mana,
      maxMana: p.maxMana,
      coins: p.coins,
      coinsSpentTotal: p.coinsSpentTotal,
      gemsEarned: p.gemsEarned,
      materialsEarned: { ...p.materialsEarned },
      seedsEarned: { ...p.seedsEarned },
      weapons: p.weapons.map((w) => ({ ...w, stickers: w.stickers.slice() })),
      activeWeaponIndex: p.activeWeaponIndex,
      talents: p.talents.slice(),
      enhancedTalents: p.enhancedTalents.slice(),
      statueId: p.statueId,
      kills: p.kills,
      merchantAngered: p.merchantAngered,
      luckyBlessing: p.luckyBlessing,
      reviveUsed: p.reviveUsed,
      retriesUsedOnFloor
    };
  }

  private buildFloorState(
    seed: number,
    floor: number,
    biomePerWorld: Record<number, BiomeId>,
    p1: PlayerState,
    dailyFactors: DailyFactorId[],
    endlessMode: boolean
  ): WorldState {
    const worldIndex = Math.floor((floor - 1) / 5) + 1;
    const stageIndex = ((floor - 1) % 5) + 1;
    const cyclicWorld = (((worldIndex - 1) % 3) + 1) as 1 | 2 | 3;
    const biome = biomePerWorld[cyclicWorld] ?? WORLD_BIOME_CHOICES[cyclicWorld][0];

    const floorRng = new SeededRNG(seed ^ (floor * 0x9e3779b9));
    const discountMult =
      (p1.talents.includes('vip_discount') ? 0.6 : 1) *
      (p1.heroId === 'slacker_priest' && p1.heroLevel >= 6 ? 0.9 : 1);

    const gen = generateFloor(floor, biome, floorRng, {
      extraCuriosities: p1.talents.includes('curiosity_sense') ? 1 : 0,
      dailyFactors,
      merchantAngered: p1.merchantAngered,
      discountMult
    });

    const startRoom = gen.map.rooms.find((r) => r.id === gen.map.startRoomId)!;
    p1.x = startRoom.cx;
    p1.y = startRoom.cy + 14;
    p1.vx = 0;
    p1.vy = 0;
    p1.shield = this.getEffectiveMaxShield(p1);
    p1.lockedEnemyId = null;

    // Weapon roulette daily factor
    if (floor > 1 && dailyFactors.includes('weapon_roulette')) {
      const pool = dailyFactors.includes('melee_only') ? MELEE_QUIRK_WEAPONS : NORMAL_DROP_WEAPONS;
      for (let i = 0; i < p1.weapons.length; i++) {
        const old = p1.weapons[i];
        const nw = createWeaponInstance(this.rng.pick(pool));
        nw.stickers = old.stickers.slice();
        nw.extraSlots = old.extraSlots;
        p1.weapons[i] = nw;
      }
    }

    return {
      seed,
      floor,
      worldIndex,
      stageIndex,
      biome,
      biomePerWorld,
      time: 0,
      status: 'playing',
      endlessMode,
      dailyFactors,
      floorMutator: 'none',
      weaponSwapTimer: 20,
      bonusTimer: 0,
      map: gen.map,
      players: { [p1.id]: p1 },
      pet: {
        id: p1.petId,
        ownerId: p1.id,
        x: p1.x - 16,
        y: p1.y + 8,
        vx: 0,
        vy: 0,
        hp: 20,
        sleepTimer: 0,
        attackCooldown: 0,
        abilityCooldown: 2,
        roomsClearedCounter: 0,
        facingX: 1
      },
      mercs: [],
      turrets: [],
      summons: [],
      sanctuaries: [],
      blackHoles: [],
      enemies: [],
      projectiles: [],
      lasers: [],
      slashes: [],
      hazards: [],
      props: gen.props,
      pickups: gen.pickups,
      interactables: gen.interactables,
      floatingTexts: [],
      particles: [],
      activeRoomId: startRoom.id,
      bossBannerTimer: 0,
      bossBannerName: '',
      glitchBlueScreenTimer: 0,
      pendingTalentOptions: null,
      pendingStickerOffer: null,
      activeWorkshopId: null,
      events: []
    };
  }

  getMainPlayer(): PlayerState {
    return this.state.players.p1;
  }

  getEffectiveMaxShield(p: PlayerState): number {
    const goldBonus = p.talents.includes('gold_armor') ? Math.min(3, Math.floor(p.coins / 100)) : 0;
    return p.maxShield + goldBonus;
  }

  consumeEvents() {
    const evs = this.state.events;
    this.state.events = [];
    return evs;
  }

  step(commands: InputCommand[], dt: number): void {
    const st = this.state;
    if (st.status !== 'playing') return;

    st.time += dt;
    if (st.bossBannerTimer > 0) st.bossBannerTimer = Math.max(0, st.bossBannerTimer - dt);
    if (st.glitchBlueScreenTimer > 0) st.glitchBlueScreenTimer = Math.max(0, st.glitchBlueScreenTimer - dt);

    // Bonus dimension timer
    if (st.bonusTimer > 0) {
      st.bonusTimer -= dt;
      if (st.bonusTimer <= 0) {
        st.enemies = st.enemies.filter((e) => e.kind !== 'gold_slime');
        this.emitToast('🛸 异次元赏金时间结束！满载而归！', '#ffd54f');
      }
    }

    // Floor mutator: weapon swap every 20s
    if (st.floorMutator === 'weapon_swap') {
      st.weaponSwapTimer -= dt;
      if (st.weaponSwapTimer <= 0) {
        st.weaponSwapTimer = 20;
        const p = this.getMainPlayer();
        const cur = p.weapons[p.activeWeaponIndex];
        const nw = createWeaponInstance(this.rng.pick(NORMAL_DROP_WEAPONS));
        nw.stickers = cur.stickers.slice();
        p.weapons[p.activeWeaponIndex] = nw;
        this.emitToast(`🎲 转盘随机换枪：【${WEAPONS[nw.defId].name}】！`, '#ff80ab');
      }
    }

    const cmdMap = new Map<string, InputCommand>();
    for (const c of commands) cmdMap.set(c.playerId, c);

    // Step players
    for (const player of Object.values(st.players)) {
      if (!player.alive) continue;
      const cmd = cmdMap.get(player.id) ?? {
        playerId: player.id,
        moveX: 0,
        moveY: 0,
        fireHeld: false,
        firePressed: false,
        skillPressed: false,
        switchPressed: false,
        interactPressed: false
      };
      this.stepPlayer(player, cmd, dt);
    }

    const mainPlayer = this.getMainPlayer();
    this.stepPet(mainPlayer, dt);
    this.stepMercs(mainPlayer, dt);
    this.stepTurrets(mainPlayer, dt);
    this.stepSummons(mainPlayer, dt);
    this.stepSanctuaries(mainPlayer, dt);
    this.stepBlackHoles(mainPlayer, dt);
    this.stepEnemies(mainPlayer, dt);
    this.stepProjectiles(dt);
    this.stepHazards(dt);
    this.stepPickups(mainPlayer, dt);
    this.stepVisualEffects(dt);
    this.checkRoomState(mainPlayer);
  }

  private stepPlayer(p: PlayerState, cmd: InputCommand, dt: number): void {
    const st = this.state;
    const hDef = HEROES[p.heroId];

    // Timers
    if (p.attackCooldown > 0) p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.hitFlashTimer > 0) p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
    if (p.dualWieldTimer > 0) p.dualWieldTimer = Math.max(0, p.dualWieldTimer - dt);
    if (p.guaranteedCritTimer > 0) p.guaranteedCritTimer = Math.max(0, p.guaranteedCritTimer - dt);
    if (p.berserkStatueTimer > 0) p.berserkStatueTimer = Math.max(0, p.berserkStatueTimer - dt);

    // Skill recharge
    if (p.skillCharges < p.maxSkillCharges) {
      const cdrMult = p.talents.includes('skill_cdr') ? 0.78 : 1;
      p.skillCooldown -= dt / cdrMult;
      if (p.skillCooldown <= 0) {
        p.skillCharges++;
        p.skillCooldown = p.skillCharges < p.maxSkillCharges ? p.skillMaxCooldown : 0;
        this.emitSfx('ready');
      }
    }

    // Infinite mana factor regen
    if (st.dailyFactors.includes('infinite_mana')) {
      p.mana = Math.min(p.maxMana, p.mana + 25 * dt);
    }

    // Auto shield regen (3.5s delay, then +1 per 0.85s)
    const effMaxShield = this.getEffectiveMaxShield(p);
    if (p.shield < effMaxShield) {
      if (p.shieldDelayTimer > 0) {
        p.shieldDelayTimer -= dt;
      } else {
        p.shieldRegenTimer += dt;
        const regenSpeed = p.heroId === 'slacker_priest' && p.heroLevel >= 6 ? 1.4 : 1;
        if (p.shieldRegenTimer >= SHIELD_REGEN_INTERVAL / regenSpeed) {
          p.shieldRegenTimer = 0;
          p.shield = Math.min(effMaxShield, p.shield + 1);
          if (p.shield === effMaxShield) this.emitSfx('shield_full');
        }
      }
    }

    // Movement + biome floor tiles (ice / lava / conveyor)
    const mag = Math.hypot(cmd.moveX, cmd.moveY);
    const nx = mag > 1 ? cmd.moveX / mag : cmd.moveX;
    const ny = mag > 1 ? cmd.moveY / mag : cmd.moveY;
    const spd = hDef.moveSpeed * (st.dailyFactors.includes('turbo_speed') ? 1.25 : 1);

    const underTile = getTileAt(st.map, Math.floor(p.x / TILE_SIZE), Math.floor(p.y / TILE_SIZE));
    if (underTile === TileType.ICE && !p.talents.includes('ice_shield')) {
      // Gentle ice inertia
      p.vx += (nx * spd - p.vx) * Math.min(1, dt * 6.5);
      p.vy += (ny * spd - p.vy) * Math.min(1, dt * 6.5);
    } else {
      p.vx = nx * spd;
      p.vy = ny * spd;
    }

    let pushX = 0;
    if (underTile === TileType.CONVEYOR_R) pushX = 32;
    if (underTile === TileType.LAVA && !p.talents.includes('fire_shield') && p.invulnTimer <= 0) {
      this.damagePlayer(p, 1, 'fire');
    }

    const mv = moveCircleWithCollisions(
      st.map,
      st.props,
      p.x,
      p.y,
      (p.vx + pushX) * dt,
      p.vy * dt,
      p.radius
    );
    p.x = mv.x;
    p.y = mv.y;
    if (Math.abs(nx) > 0.1) p.facingX = nx >= 0 ? 1 : -1;

    // Auto-aim
    const { isPointBlank } = updateAutoAim(p, st.enemies, st.map, cmd.aimX, cmd.aimY);

    // Switch weapon
    if (cmd.switchPressed && p.weapons.length > 1) {
      p.activeWeaponIndex = (p.activeWeaponIndex + 1) % p.weapons.length;
      this.emitSfx('switch');
    }

    // Active Hero Skill
    if (cmd.skillPressed && p.skillCharges > 0) {
      this.triggerHeroSkill(p);
    }

    // Interact check (either explicit interactPressed OR firePressed while next to interactable/ground pickup)
    const nearbyTarget = this.findNearestInteractableOrPickup(p);
    if (cmd.interactPressed || (cmd.firePressed && nearbyTarget && !isPointBlank)) {
      if (nearbyTarget) {
        this.executeNearbyInteraction(p, nearbyTarget);
        return;
      }
    }

    // Attack!
    if ((cmd.fireHeld || cmd.firePressed) && p.attackCooldown <= 0) {
      const weapon = p.weapons[p.activeWeaponIndex];
      const wDef = WEAPONS[weapon.defId];
      // Point-blank bare-hand slap when holding a gun!
      if (isPointBlank && wDef.mode !== 'melee') {
        this.performBareHandSlap(p);
        p.attackCooldown = 0.24;
      } else {
        this.performWeaponAttack(p, weapon, false);
        // Dual wield offhand copy!
        if (p.dualWieldTimer > 0) {
          this.performWeaponAttack(p, weapon, true);
        }
      }
    }
  }

  private triggerHeroSkill(p: PlayerState): void {
    const st = this.state;
    const hStats = getHeroStatsAtLevel(p.heroId, p.heroLevel);
    p.skillCharges--;
    if (p.skillCooldown <= 0) p.skillCooldown = p.skillMaxCooldown;
    this.emitSfx('skill');

    switch (p.heroId) {
      case 'bucket_knight':
        p.dualWieldTimer = 5.0;
        this.addFloatingText(p.x, p.y - 16, '双持狂热！', '#6bb8ff', 1.15);
        break;

      case 'sticker_smith': {
        const curW = p.weapons[p.activeWeaponIndex];
        if (st.turrets.length >= 2) st.turrets.shift();
        st.turrets.push({
          id: uid('tur'),
          ownerId: p.id,
          x: p.x + Math.cos(p.aimAngle) * 18,
          y: p.y + Math.sin(p.aimAngle) * 18,
          life: 10,
          maxLife: 10,
          fireCooldown: 0.2,
          stickers: curW.stickers.slice(),
          damage: Math.max(5, Math.round(WEAPONS[curW.defId].damage * 0.7))
        });
        this.addFloatingText(p.x, p.y - 16, '万能胶炮台就绪！', '#ffb74d', 1.1);
        break;
      }

      case 'ranger_cat': {
        const dashAng = Math.hypot(p.vx, p.vy) > 5 ? Math.atan2(p.vy, p.vx) : p.aimAngle;
        const dashDist = 56;
        const steps = 8;
        for (let i = 0; i < steps; i++) {
          const mv = moveCircleWithCollisions(
            st.map,
            st.props,
            p.x,
            p.y,
            (Math.cos(dashAng) * dashDist) / steps,
            (Math.sin(dashAng) * dashDist) / steps,
            p.radius
          );
          p.x = mv.x;
          p.y = mv.y;
          this.spawnParticles(p.x, p.y, '#ff4d6d', 2, 20);
        }
        p.invulnTimer = Math.max(p.invulnTimer, 0.48);
        p.guaranteedCritTimer = 1.6;
        if (hStats.isMaxSkill) {
          st.projectiles = st.projectiles.filter(
            (pr) => pr.fromPlayer || Math.hypot(pr.x - p.x, pr.y - p.y) > 36
          );
        }
        this.addFloatingText(p.x, p.y - 16, '瞬步必暴！', '#ff80ab', 1.1);
        break;
      }

      case 'alchemist_quirk': {
        const angles = hStats.isMaxSkill ? [-0.36, -0.12, 0.12, 0.36] : [-0.28, 0, 0.28];
        const elems: Array<'poison' | 'fire' | 'ice' | 'lightning'> = ['poison', 'fire', 'ice', 'lightning'];
        angles.forEach((off, idx) => {
          const a = p.aimAngle + off;
          const dist = 74;
          const tx = p.x + Math.cos(a) * dist;
          const ty = p.y + Math.sin(a) * dist;
          const el = elems[idx];
          if (el === 'lightning') {
            this.triggerChainLightning(tx, ty, 18, p);
          } else {
            st.hazards.push({
              id: uid('alc'),
              kind: el === 'poison' ? 'poison_pool' : el === 'fire' ? 'fire_pool' : 'ice_pool',
              x: tx,
              y: ty,
              radius: 30,
              timer: 4.0,
              maxTimer: 4.0,
              damage: 5,
              fromPlayer: true
            });
          }
        });
        // Instant toxic combustion bonus if enemies are in front!
        this.triggerExplosion(p.x + Math.cos(p.aimAngle) * 70, p.y + Math.sin(p.aimAngle) * 70, 44, 24, true, true);
        this.addFloatingText(p.x, p.y - 16, '剧毒爆燃！', '#69f0ae', 1.15);
        break;
      }

      case 'slacker_priest': {
        st.sanctuaries.push({
          x: p.x,
          y: p.y,
          radius: 56,
          timer: 6.0,
          healTick: 0.2,
          levelMax: hStats.isMaxSkill
        });
        this.addFloatingText(p.x, p.y - 16, '摸鱼结界展开~', '#fff59d', 1.1);
        break;
      }

      case 'blade_ashura': {
        // Massive crescent slash slicing bullets into homing swords!
        st.slashes.push({
          id: uid('iai'),
          x: p.x,
          y: p.y,
          angle: p.aimAngle,
          arcRad: 2.6,
          radius: 78,
          color: '#e040fb',
          life: 0.24,
          maxLife: 0.24
        });
        let sliced = 0;
        const keep: ProjectileState[] = [];
        for (const pr of st.projectiles) {
          if (!pr.fromPlayer && Math.hypot(pr.x - p.x, pr.y - p.y) <= 84) {
            sliced++;
            if (sliced <= 8) {
              keep.push({
                ...pr,
                fromPlayer: true,
                ownerId: p.id,
                damage: 16,
                color: '#ce93d8',
                homingStrength: 7.5,
                vx: Math.cos(p.aimAngle) * 260,
                vy: Math.sin(p.aimAngle) * 260,
                life: 2.0,
                maxLife: 2.0,
                hitIds: []
              });
            }
          } else {
            keep.push(pr);
          }
        }
        st.projectiles = keep;
        for (const e of st.enemies) {
          if (Math.hypot(e.x - p.x, e.y - p.y) <= 84) {
            this.damageEnemy(e, 26, true, p, ['lightning']);
          }
        }
        if (hStats.isMaxSkill && sliced >= 5) {
          p.skillCooldown *= 0.5;
        }
        this.emitShake(4, 0.14);
        this.addFloatingText(p.x, p.y - 16, sliced > 0 ? `居合斩 ${sliced} 弹反击！` : '居合月牙斩！', '#ce93d8', 1.15);
        break;
      }
    }

    // Trigger Statue blessing on skill use!
    this.triggerStatueBlessing(p);
  }

  private triggerStatueBlessing(p: PlayerState): void {
    if (!p.statueId) return;
    switch (p.statueId) {
      case 'paladin':
        p.paladinBarrier = true;
        this.addFloatingText(p.x, p.y - 24, '圣盾庇护！', '#ffd54f', 0.9);
        break;
      case 'berserker':
        p.berserkStatueTimer = 5.0;
        this.addFloatingText(p.x, p.y - 24, '狂战巨化！', '#ff5252', 0.9);
        break;
      case 'priest':
        p.mana = Math.min(p.maxMana, p.mana + 25);
        this.addFloatingText(p.x, p.y - 24, '+25 蓝', '#4fc3f7', 0.9);
        break;
      case 'assassin':
        for (let i = -1; i <= 1; i++) {
          this.spawnPlayerProjectile(p, p.aimAngle + i * 0.25, 280, 14, false, '#ce93d8', 4, 'bolt', 1.2, { homingStrength: 5 });
        }
        break;
      case 'fortune_cat':
        for (let i = 0; i < 6; i++) {
          this.spawnPlayerProjectile(p, (i * Math.PI * 2) / 6, 200, 12, false, '#ffd54f', 5, 'coin', 1.4, { homingStrength: 4.5 });
        }
        break;
      case 'knight':
        this.spawnSummon(p, 'skeleton', p.x, p.y, 12);
        break;
    }
  }

  private performBareHandSlap(p: PlayerState): void {
    this.emitSfx('melee');
    this.state.slashes.push({
      id: uid('slp'),
      x: p.x,
      y: p.y,
      angle: p.aimAngle,
      arcRad: 1.9,
      radius: 26,
      color: '#ffffff',
      life: 0.14,
      maxLife: 0.14
    });
    this.applyMeleeArc(p, 28, 2.0, 6, 0.15, 2.0, [], false, false, false);
  }

  private performWeaponAttack(
    p: PlayerState,
    weapon: WeaponInstance,
    isDualOffhand: boolean,
    isShadowClone = false
  ): void {
    const st = this.state;
    const ctx = buildAttackContext(p, weapon, this.rng, {
      halfManaCost: isDualOffhand && p.heroLevel >= 7,
      dailyFactors: st.dailyFactors,
      isShadowClone
    });

    if (p.mana < ctx.manaCost) {
      if (!isDualOffhand && !isShadowClone) {
        this.addFloatingText(p.x, p.y - 16, '蓝量不足！切近战！', '#4fc3f7', 0.9);
        this.emitSfx('error');
        p.attackCooldown = 0.25;
      }
      return;
    }

    p.mana -= ctx.manaCost;
    if (ctx.coinCost > 0) {
      p.coins -= ctx.coinCost;
      p.coinsSpentTotal += ctx.coinCost;
    }
    if (!isShadowClone) {
      weapon.shotCounter++;
      if (!isDualOffhand) {
        p.attackCooldown = 1 / ctx.fireRate;
      }
    }
    if (ctx.onePunchReady) {
      weapon.onePunchSpent = true;
      this.emitShake(8, 0.25);
      this.addFloatingText(p.x, p.y - 22, '认真一拳！！', '#ff1744', 1.45);
    }

    // Consume guaranteed crit window
    const guaranteedCrit = p.guaranteedCritTimer > 0;
    if (guaranteedCrit && !isShadowClone) p.guaranteedCritTimer = 0;

    // Boombox sonic ring clears point-blank bullets
    if (ctx.sonicRing) {
      st.projectiles = st.projectiles.filter(
        (pr) => pr.fromPlayer || Math.hypot(pr.x - p.x, pr.y - p.y) > 42
      );
      this.spawnParticles(p.x, p.y, '#18ffff', 8, 90);
    }

    // Sound selection
    if (ctx.weaponDef.id === 'rubber_chicken') this.emitSfx('chicken');
    else if (ctx.weaponDef.id === 'salted_fish') this.emitSfx('fish');
    else if (ctx.weaponDef.id === 'golden_pan') this.emitSfx('pan');
    else if (ctx.mode === 'laser') this.emitSfx('laser');
    else if (ctx.weaponDef.mode === 'melee') this.emitSfx('melee');
    else this.emitSfx('shoot');

    // Special weapon: Slime Staff spawns bouncing slime summons!
    if (ctx.weaponDef.id === 'slime_staff' && !isShadowClone) {
      this.spawnSummon(p, 'slime', p.x + Math.cos(p.aimAngle) * 14, p.y + Math.sin(p.aimAngle) * 14, ctx.damage, ctx.elements[0]);
    }
    // Special weapon: Magic Hat drops occasional real coins!
    if (ctx.weaponDef.id === 'magic_hat' && this.rng.chance(0.2)) {
      p.coins += 2;
      this.addFloatingText(p.x, p.y - 16, '🎩 +2金', '#ffd54f', 0.9);
    }
    // Special weapon: Mech Laser Arm every 8th shot steam-clears bullets
    if (ctx.weaponDef.id === 'mech_laser_arm' && weapon.shotCounter % 8 === 0) {
      st.projectiles = st.projectiles.filter((pr) => pr.fromPlayer || Math.hypot(pr.x - p.x, pr.y - p.y) > 70);
      this.spawnParticles(p.x, p.y, '#ffffff', 14, 110);
    }
    // Special weapon: Goblin Totem summons meteor rain!
    if (ctx.weaponDef.id === 'goblin_totem' && !isShadowClone) {
      for (let i = 0; i < 2; i++) {
        st.hazards.push({
          id: uid('tm'),
          kind: 'meteor_warn',
          x: p.x + Math.cos(p.aimAngle) * 85 + this.rng.float(-35, 35),
          y: p.y + Math.sin(p.aimAngle) * 85 + this.rng.float(-35, 35),
          radius: 28,
          timer: 0.45,
          maxTimer: 0.45,
          damage: ctx.damage + 6,
          fromPlayer: true,
          canBreakWall: true
        });
      }
    }

    // 1. Melee swing (always executes for melee weapons even when laserized/split!)
    if (ctx.weaponDef.mode === 'melee') {
      st.slashes.push({
        id: uid('sl'),
        x: p.x,
        y: p.y,
        angle: p.aimAngle,
        arcRad: ctx.meleeArcRad,
        radius: ctx.meleeRadius,
        color: ctx.weaponDef.color,
        life: 0.16,
        maxLife: 0.16
      });
      this.applyMeleeArc(
        p,
        ctx.meleeRadius,
        ctx.meleeArcRad,
        ctx.damage,
        guaranteedCrit ? 1 : ctx.critChance,
        ctx.critMult,
        ctx.elements,
        ctx.weaponDef.id === 'bug_zapper',
        ctx.canBreakCrackedWall,
        ctx.reflectBullets
      );
    }

    // 2. Laser mode (or melee with laserize sticker!)
    if (ctx.mode === 'laser') {
      this.fireLasers(p, ctx, guaranteedCrit);
    } else if (ctx.weaponDef.mode !== 'melee' || ctx.meleeHasBonusBeam) {
      // 3. Fire projectiles / lob bombs / melee sword beams
      this.fireProjectiles(p, ctx, guaranteedCrit);
    }

    // 4. Shadow Clone sticker follow-up!
    if (ctx.shadowClone && !isShadowClone) {
      this.performWeaponAttack(p, weapon, isDualOffhand, true);
    }
  }

  private fireLasers(p: PlayerState, ctx: AttackContext, guaranteedCrit: boolean): void {
    const st = this.state;
    const count = ctx.projectileCount;
    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i / (count - 1) - 0.5) * ctx.spreadRad;
      const ang = p.aimAngle + off;
      const maxDist = Math.max(240, ctx.range);
      const tx = p.x + Math.cos(ang) * maxDist;
      const ty = p.y + Math.sin(ang) * maxDist;
      const hit = raycastSolid(st.map, p.x, p.y, tx, ty, 4);

      if (hit.blocked && hit.hitTile === TileType.CRACKED_WALL && ctx.canBreakCrackedWall) {
        this.blastCrackedWallAt(hit.hitX, hit.hitY);
      }

      const color = ctx.elements.includes('fire')
        ? '#ff5722'
        : ctx.elements.includes('ice')
          ? '#4fc3f7'
          : ctx.weaponDef.color;

      st.lasers.push({
        id: uid('lsr'),
        x1: p.x,
        y1: p.y,
        x2: hit.hitX,
        y2: hit.hitY,
        width: 5 * ctx.scale * ctx.laserWidthMult,
        color,
        life: 0.14,
        maxLife: 0.14,
        fromPlayer: true
      });

      // Line-circle hits on enemies & props
      const segDx = hit.hitX - p.x;
      const segDy = hit.hitY - p.y;
      const segLenSq = segDx * segDx + segDy * segDy || 1;
      for (const e of st.enemies) {
        if (e.hp <= 0) continue;
        const t = Math.max(0, Math.min(1, ((e.x - p.x) * segDx + (e.y - p.y) * segDy) / segLenSq));
        const px = p.x + segDx * t;
        const py = p.y + segDy * t;
        if (Math.hypot(e.x - px, e.y - py) <= e.radius + 5 * ctx.scale * ctx.laserWidthMult) {
          const isCrit = guaranteedCrit || this.rng.chance(ctx.critChance);
          this.damageEnemy(e, isCrit ? Math.round(ctx.damage * ctx.critMult) : ctx.damage, isCrit, p, ctx.elements, ctx);
        }
      }
      for (const prop of st.props) {
        if (prop.hp <= 0 || prop.kind === 'pillar') continue;
        const t = Math.max(0, Math.min(1, ((prop.x - p.x) * segDx + (prop.y - p.y) * segDy) / segLenSq));
        const px = p.x + segDx * t;
        const py = p.y + segDy * t;
        if (Math.hypot(prop.x - px, prop.y - py) <= prop.radius + 6) {
          this.damageProp(prop, ctx.damage);
        }
      }
      if (ctx.nukeOnEnd) {
        this.triggerExplosion(hit.hitX, hit.hitY, 54, ctx.damage * 2, true, true);
      }
    }
    this.emitShake(2.2, 0.1);
  }

  private fireProjectiles(p: PlayerState, ctx: AttackContext, guaranteedCrit: boolean): void {
    const count = ctx.projectileCount;
    const bigHeadCrit = this.state.floorMutator === 'big_head' ? 2 : 1;
    const effectiveCritChance = Math.min(1, ctx.critChance * bigHeadCrit);

    for (let i = 0; i < count; i++) {
      const baseOff = count === 1 ? 0 : (i / (count - 1) - 0.5) * ctx.spreadRad;
      const jitter = this.rng.float(-ctx.spreadRad * 0.18, ctx.spreadRad * 0.18);
      const ang = p.aimAngle + baseOff + jitter;
      const isCrit = guaranteedCrit || this.rng.chance(effectiveCritChance);
      const dmg = isCrit ? Math.round(ctx.damage * ctx.critMult) : ctx.damage;

      let shape: ProjectileState['shape'] = 'orb';
      let labelText: string | undefined;
      if (ctx.weaponDef.id === 'salted_fish') shape = 'fish';
      else if (ctx.weaponDef.id === 'coin_gun') shape = 'coin';
      else if (ctx.weaponDef.id === 'carrot_gatling') shape = 'carrot';
      else if (ctx.weaponDef.id === 'rubber_chicken' || ctx.weaponDef.id === 'skull_trumpet') shape = 'wave';
      else if (ctx.weaponDef.id === 'keyboard_bible') {
        shape = 'text';
        labelText = this.rng.pick(KEYBOARD_WORDS);
      } else if (ctx.weaponDef.id === 'hero_multibow' || ctx.weaponDef.id === 'dwarf_sniper') shape = 'arrow';
      else if (ctx.boomerangReturn) shape = 'boomerang';
      else if (ctx.weaponDef.id === 'goose_bill_cannon') shape = 'bill';
      else if (ctx.weaponDef.id === 'magic_hat') shape = 'card';
      else if (ctx.mode === 'lob') shape = 'bomb';

      const col =
        ctx.weaponDef.id === 'dragon_twin_breath'
          ? i % 2 === 0
            ? '#4fc3f7'
            : '#ff5722'
          : ctx.elements.includes('fire')
            ? '#ff6d00'
            : ctx.elements.includes('ice')
              ? '#4fc3f7'
              : ctx.elements.includes('poison')
                ? '#76ff03'
                : ctx.weaponDef.color;

      const life = Math.max(0.35, ctx.range / ctx.speed);
      const rangerPierce =
        p.heroId === 'ranger_cat' && p.heroLevel >= 6 && isCrit ? 2 : 0;

      this.spawnPlayerProjectile(
        p,
        ang,
        ctx.speed,
        dmg,
        isCrit,
        col,
        Math.round(4.5 * ctx.scale),
        shape,
        life,
        {
          pierce: ctx.pierce + rangerPierce,
          bouncesLeft: ctx.bounces,
          homingStrength: ctx.homingStrength,
          boomerangReturn: ctx.boomerangReturn,
          elements: ctx.elements.slice(),
          explosiveRadius:
            ctx.mode === 'lob' || this.rng.chance(ctx.explosiveChance) ? Math.round(32 * ctx.scale) : undefined,
          canBreakCrackedWall: ctx.canBreakCrackedWall,
          destroysEnemyBullets: ctx.reflectBullets,
          isLob: ctx.mode === 'lob',
          spawnChickenOnEnd: ctx.spawnChicken && i === 0,
          duckChance: ctx.duckChance,
          nukeOnEnd: ctx.nukeOnEnd && i === 0,
          vampireDrop: ctx.vampireDrop,
          killChain: ctx.killChain,
          coinDropBonus: ctx.coinDropBonus,
          sourceWeaponId: ctx.weaponDef.id,
          labelText
        }
      );
    }

    if (ctx.weaponDef.id === 'pixel_shotgun' || ctx.weaponDef.id === 'dwarf_sniper') {
      this.emitShake(2.2, 0.1);
    }
  }

  private spawnPlayerProjectile(
    p: PlayerState,
    angle: number,
    speed: number,
    damage: number,
    isCrit: boolean,
    color: string,
    radius: number,
    shape: ProjectileState['shape'],
    life: number,
    extra: Partial<ProjectileState> = {}
  ): void {
    const st = this.state;
    // Performance cap: 180 player projectiles -> merge damage into latest projectile
    const playerProjs = st.projectiles.filter((pr) => pr.fromPlayer);
    if (playerProjs.length >= MAX_PLAYER_PROJECTILES) {
      const latest = playerProjs[playerProjs.length - 1];
      latest.damage += damage;
      latest.radius = Math.min(14, latest.radius + 0.5);
      return;
    }

    st.projectiles.push({
      id: uid('pr'),
      ownerId: p.id,
      fromPlayer: true,
      x: p.x + Math.cos(angle) * 8,
      y: p.y + Math.sin(angle) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      damage,
      isCrit,
      life,
      maxLife: life,
      color,
      shape,
      pierce: extra.pierce ?? 0,
      bouncesLeft: extra.bouncesLeft ?? 0,
      homingStrength: extra.homingStrength ?? 0,
      boomerangReturn: extra.boomerangReturn,
      elements: extra.elements ?? [],
      explosiveRadius: extra.explosiveRadius,
      canBreakCrackedWall: extra.canBreakCrackedWall,
      destroysEnemyBullets: extra.destroysEnemyBullets,
      isLob: extra.isLob,
      spawnChickenOnEnd: extra.spawnChickenOnEnd,
      duckChance: extra.duckChance,
      nukeOnEnd: extra.nukeOnEnd,
      vampireDrop: extra.vampireDrop,
      killChain: extra.killChain,
      coinDropBonus: extra.coinDropBonus,
      sourceWeaponId: extra.sourceWeaponId,
      labelText: extra.labelText,
      hitIds: []
    });
  }

  private applyMeleeArc(
    p: PlayerState,
    radius: number,
    arcRad: number,
    damage: number,
    critChance: number,
    critMult: number,
    elements: ElementTag[],
    isBugZapper: boolean,
    canBreakWall: boolean,
    reflectSticker: boolean
  ): void {
    const st = this.state;
    const halfArc = arcRad / 2;
    const canReflect =
      reflectSticker ||
      p.talents.includes('melee_reflect') ||
      (p.heroId === 'blade_ashura' && p.heroLevel >= 6);

    // 1. Slice or reflect enemy projectiles!
    let slicedCount = 0;
    const kept: ProjectileState[] = [];
    for (const pr of st.projectiles) {
      if (!pr.fromPlayer) {
        const dx = pr.x - p.x;
        const dy = pr.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= radius + pr.radius + 4) {
          const diff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - p.aimAngle));
          if (diff <= halfArc + 0.25) {
            slicedCount++;
            this.spawnParticles(pr.x, pr.y, '#ffffff', 3, 55);
            if (canReflect) {
              kept.push({
                ...pr,
                fromPlayer: true,
                ownerId: p.id,
                vx: -pr.vx * 1.5,
                vy: -pr.vy * 1.5,
                damage: Math.max(8, pr.damage * 6),
                color: '#80d8ff',
                hitIds: []
              });
            }
            continue;
          }
        }
      }
      kept.push(pr);
    }
    st.projectiles = kept;

    if (slicedCount > 0) {
      this.emitSfx('clang');
      if (isBugZapper) {
        this.triggerChainLightning(p.x, p.y, 12 + slicedCount * 4, p);
      }
    }

    // 2. Hit enemies in arc
    for (const e of st.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius + e.radius) {
        const diff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - p.aimAngle));
        if (diff <= halfArc + 0.15) {
          const isCrit = this.rng.chance(critChance);
          const dmg = isCrit ? Math.round(damage * critMult) : damage;
          this.damageEnemy(e, dmg, isCrit, p, elements);
          // Knockback (3x in low gravity!)
          const kb = (st.floorMutator === 'low_gravity' ? 28 : 10) / (e.isBoss ? 4 : 1);
          const mv = moveCircleWithCollisions(
            st.map,
            st.props,
            e.x,
            e.y,
            (dx / (dist || 1)) * kb,
            (dy / (dist || 1)) * kb,
            e.radius
          );
          e.x = mv.x;
          e.y = mv.y;
        }
      }
    }

    // 3. Hit props & black merchant (robbery trigger!)
    for (const prop of st.props) {
      if (prop.hp <= 0 || prop.kind === 'pillar') continue;
      if (Math.hypot(prop.x - p.x, prop.y - p.y) <= radius + prop.radius) {
        this.damageProp(prop, damage);
      }
    }
    for (const inter of st.interactables) {
      if (inter.kind === 'merchant_npc' && !inter.used && Math.hypot(inter.x - p.x, inter.y - p.y) <= radius + inter.radius) {
        this.damageBlackMerchant(inter, damage, p);
      }
    }

    // 4. Heavy melee breaks cracked walls
    if (canBreakWall) {
      this.blastCrackedWallAt(
        p.x + Math.cos(p.aimAngle) * (radius * 0.8),
        p.y + Math.sin(p.aimAngle) * (radius * 0.8)
      );
    }
  }

  private stepProjectiles(dt: number): void {
    const st = this.state;
    const p1 = this.getMainPlayer();
    const keep: ProjectileState[] = [];

    for (const pr of st.projectiles) {
      pr.life -= dt;
      if (pr.life <= 0) {
        this.onProjectileEnd(pr, p1);
        continue;
      }

      // Boomerang return half-way
      if (pr.boomerangReturn && !pr.returning && pr.life < pr.maxLife * 0.5) {
        pr.returning = true;
        pr.hitIds = [];
      }
      if (pr.returning && pr.fromPlayer) {
        const dx = p1.x - pr.x;
        const dy = p1.y - pr.y;
        const d = Math.hypot(dx, dy) || 1;
        const spd = Math.hypot(pr.vx, pr.vy) || 200;
        pr.vx = (dx / d) * spd;
        pr.vy = (dy / d) * spd;
        if (d < 14) continue;
      }

      // Homing steering
      if (pr.homingStrength > 0) {
        const target = pr.fromPlayer ? this.findNearestEnemy(pr.x, pr.y, 175) : p1;
        if (target) {
          const desired = Math.atan2(target.y - pr.y, target.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          const spd = Math.hypot(pr.vx, pr.vy) || 160;
          const diff = normalizeAngle(desired - cur);
          const nextAng = cur + Math.max(-pr.homingStrength * dt, Math.min(pr.homingStrength * dt, diff));
          pr.vx = Math.cos(nextAng) * spd;
          pr.vy = Math.sin(nextAng) * spd;
        }
      }

      // Slacker priest sanctuary slows enemy bullets!
      let bMult = 1;
      if (!pr.fromPlayer) {
        for (const s of st.sanctuaries) {
          if (Math.hypot(pr.x - s.x, pr.y - s.y) <= s.radius) {
            bMult = 0.52;
            break;
          }
        }
      }

      const nx = pr.x + pr.vx * dt * bMult;
      const ny = pr.y + pr.vy * dt * bMult;

      // Wall collision (lob ignores low props, still hits walls)
      const hitWallX = circleIntersectsSolidTile(st.map, nx, pr.y, pr.radius * 0.6);
      const hitWallY = circleIntersectsSolidTile(st.map, pr.x, ny, pr.radius * 0.6);
      if (hitWallX || hitWallY) {
        if (pr.canBreakCrackedWall) {
          this.blastCrackedWallAt(nx, ny);
        }
        if (pr.bouncesLeft > 0) {
          pr.bouncesLeft--;
          if (hitWallX) pr.vx = -pr.vx;
          if (hitWallY) pr.vy = -pr.vy;
          pr.damage = Math.round(pr.damage * 1.15);
          this.spawnParticles(pr.x, pr.y, pr.color, 3, 40);
        } else {
          this.onProjectileEnd(pr, p1);
          continue;
        }
      } else {
        pr.x = nx;
        pr.y = ny;
      }

      // Bullet-destroys-enemy-bullets (Rubber Chicken / Reflect sticker)
      if (pr.fromPlayer && pr.destroysEnemyBullets) {
        st.projectiles = st.projectiles.filter(
          (other) => other.fromPlayer || Math.hypot(other.x - pr.x, other.y - pr.y) > pr.radius + other.radius + 6
        );
      }

      // Prop collision (non-lob)
      let consumed = false;
      if (!pr.isLob) {
        for (const prop of st.props) {
          if (prop.hp <= 0) continue;
          if (Math.hypot(pr.x - prop.x, pr.y - prop.y) <= pr.radius + prop.radius) {
            if (prop.kind !== 'pillar') this.damageProp(prop, pr.damage);
            if (pr.bouncesLeft > 0) {
              pr.bouncesLeft--;
              pr.vx = -pr.vx;
              pr.vy = -pr.vy;
            } else {
              consumed = true;
            }
            break;
          }
        }
      }
      if (consumed) {
        this.onProjectileEnd(pr, p1);
        continue;
      }

      // Hit entities
      if (pr.fromPlayer) {
        // Check hitting Black Merchant -> ROBBERY!!
        for (const inter of st.interactables) {
          if (inter.kind === 'merchant_npc' && !inter.used && Math.hypot(pr.x - inter.x, pr.y - inter.y) <= pr.radius + inter.radius) {
            this.damageBlackMerchant(inter, pr.damage, p1);
            consumed = true;
            break;
          }
        }
        if (consumed) {
          this.onProjectileEnd(pr, p1);
          continue;
        }

        for (const e of st.enemies) {
          if (e.hp <= 0 || pr.hitIds.includes(e.id)) continue;
          if (Math.hypot(pr.x - e.x, pr.y - e.y) <= pr.radius + e.radius) {
            pr.hitIds.push(e.id);
            this.damageEnemy(e, pr.damage, pr.isCrit, p1, pr.elements, undefined, pr);
            if (pr.pierce > 0) {
              pr.pierce--;
            } else {
              consumed = true;
              break;
            }
          }
        }
      } else {
        // Enemy bullet hitting player
        if (p1.alive && Math.hypot(pr.x - p1.x, pr.y - p1.y) <= pr.radius + p1.radius) {
          // Golden Frying Pan on back blocks bullets from behind!
          const hasPan = p1.weapons.some((w) => WEAPONS[w.defId].backShield);
          if (hasPan) {
            const bulletIncomingAng = Math.atan2(pr.y - p1.y, pr.x - p1.x);
            const behindDiff = Math.abs(normalizeAngle(bulletIncomingAng - (p1.aimAngle + Math.PI)));
            if (behindDiff < 1.05) {
              this.emitSfx('pan');
              this.addFloatingText(p1.x, p1.y - 14, '咣当！(平底锅挡弹)', '#ffd54f', 0.9);
              this.spawnParticles(pr.x, pr.y, '#ffd54f', 5, 65);
              continue;
            }
          }
          this.damagePlayer(p1, pr.damage);
          consumed = true;
        }
      }

      if (consumed) {
        this.onProjectileEnd(pr, p1);
        continue;
      }

      keep.push(pr);
    }
    st.projectiles = keep;
  }

  private onProjectileEnd(pr: ProjectileState, p: PlayerState): void {
    const st = this.state;
    if (pr.explosiveRadius) {
      this.triggerExplosion(pr.x, pr.y, pr.explosiveRadius, Math.round(pr.damage * 0.9), pr.fromPlayer, Boolean(pr.canBreakCrackedWall));
    }
    if (pr.nukeOnEnd) {
      this.triggerExplosion(pr.x, pr.y, 58, Math.round(pr.damage * 2.2), true, true);
      st.projectiles = st.projectiles.filter((o) => o.fromPlayer || Math.hypot(o.x - pr.x, o.y - pr.y) > 72);
      this.addFloatingText(pr.x, pr.y - 16, '☢️ 微型核爆！', '#b2ff59', 1.2);
    }
    if (pr.sourceWeaponId === 'blackhole_vacuum') {
      st.blackHoles.push({
        id: uid('bh'),
        ownerId: p.id,
        x: pr.x,
        y: pr.y,
        radius: 62,
        timer: 2.5,
        damageTick: 0.25
      });
    }
    if (pr.sourceWeaponId === 'takeout_box') {
      const pick = this.rng.pick(['fire_pool', 'ice_pool', 'poison_pool'] as const);
      st.hazards.push({
        id: uid('tk'),
        kind: pick,
        x: pr.x,
        y: pr.y,
        radius: 30,
        timer: 3.2,
        maxTimer: 3.2,
        damage: 4,
        fromPlayer: true
      });
    }
    if (pr.elements.includes('poison')) {
      st.hazards.push({
        id: uid('ps'),
        kind: 'poison_pool',
        x: pr.x,
        y: pr.y,
        radius: 26,
        timer: 3.0,
        maxTimer: 3.0,
        damage: 3,
        fromPlayer: true
      });
    }
    if (pr.spawnChickenOnEnd) {
      this.spawnSummon(p, 'chicken', pr.x, pr.y, Math.max(10, Math.round(pr.damage * 1.1)));
    }
  }

  private damageEnemy(
    e: EnemyState,
    amount: number,
    isCrit: boolean,
    attacker: PlayerState,
    elements: ElementTag[] = [],
    ctx?: AttackContext,
    proj?: ProjectileState
  ): void {
    if (e.hp <= 0) return;

    let dmg = amount;
    // Duck curse takes +50% damage!
    if (e.duckTimer > 0) dmg = Math.round(dmg * 1.5);

    // Ice + Fire Steam Blast reaction!
    if (elements.includes('fire') && e.freezeTimer > 0) {
      e.freezeTimer = 0;
      dmg += 18;
      this.triggerExplosion(e.x, e.y, 40, 14, true, false);
      this.addFloatingText(e.x, e.y - 20, '💨 冰火蒸汽核爆！', '#80d8ff', 1.15);
    } else if (elements.includes('ice') && e.burnTimer > 0) {
      e.burnTimer = 0;
      dmg += 18;
      this.triggerExplosion(e.x, e.y, 40, 14, true, false);
      this.addFloatingText(e.x, e.y - 20, '💨 冰火蒸汽核爆！', '#ff8a80', 1.15);
    }

    // Lightning vs frozen = 2x!
    if (elements.includes('lightning') && e.freezeTimer > 0) {
      dmg *= 2;
    }

    e.hp -= dmg;
    e.hitFlashTimer = 0.065;
    this.emitSfx(isCrit ? 'crit' : 'hit');
    if (isCrit) this.emitHitstop(0.028);

    const color = isCrit
      ? '#ffd54f'
      : elements.includes('fire')
        ? '#ff7043'
        : elements.includes('ice')
          ? '#4fc3f7'
          : elements.includes('lightning')
            ? '#ffee58'
            : '#ffffff';
    this.addFloatingText(
      e.x + this.rng.float(-6, 6),
      e.y - e.radius - 4,
      isCrit ? `${dmg}!` : `${dmg}`,
      color,
      isCrit ? 1.18 : 0.92
    );
    this.spawnParticles(e.x, e.y, color, isCrit ? 6 : 3, 60);

    // Daily factor: crit explodes!
    if (isCrit && this.state.dailyFactors.includes('crit_explode')) {
      this.triggerExplosion(e.x, e.y, 28, Math.round(dmg * 0.5), true, false);
    }

    // Element & CC applications (with Boss CC diminishing protection!)
    const ccScale = e.isBoss ? (e.ccDiminishTimer > 0 ? 0.1 : 0.3) : 1.0;
    if (elements.includes('fire')) {
      e.burnTimer = 2.5;
    }
    if (elements.includes('poison')) {
      e.poisonTimer = 3.0;
    }
    if (elements.includes('ice') && (isCrit || this.rng.chance(0.25))) {
      const dur = 1.45 * (attacker.talents.includes('ice_shield') ? 1.4 : 1) * ccScale;
      if (dur > 0.2) {
        e.freezeTimer = Math.max(e.freezeTimer, dur);
        if (e.isBoss) e.ccDiminishTimer = 5;
      }
    }
    if (
      (proj?.sourceWeaponId === 'keyboard_bible' || proj?.sourceWeaponId === 'slingshot' || proj?.sourceWeaponId === 'rubber_chicken') &&
      isCrit
    ) {
      e.stunTimer = Math.max(e.stunTimer, 1.0 * ccScale);
    }

    // Duck curse!
    const duckChance = ctx?.duckChance ?? proj?.duckChance ?? 0;
    if (!e.isBoss && duckChance > 0 && this.rng.chance(duckChance)) {
      e.duckTimer = 3.0;
      this.addFloatingText(e.x, e.y - 16, '🦆 变小黄鸭啦！', '#ffee58', 1.05);
    }

    // Chain lightning
    if (ctx?.chainLightning || elements.includes('lightning')) {
      this.triggerChainLightning(e.x, e.y, Math.max(4, Math.round(dmg * 0.45)), attacker, e.id);
    }

    // Goose Bill Cannon drops coins on hit!
    if (proj?.sourceWeaponId === 'goose_bill_cannon' && this.rng.chance(0.35)) {
      attacker.coins += 1;
    }

    // Death!
    if (e.hp <= 0) {
      this.onEnemyKilled(e, attacker, isCrit, proj);
    }
  }

  private onEnemyKilled(
    e: EnemyState,
    attacker: PlayerState,
    isCrit: boolean,
    proj?: ProjectileState
  ): void {
    const st = this.state;
    attacker.kills++;
    this.emitSfx(e.isBoss ? 'jackpot' : 'kill');
    this.spawnParticles(e.x, e.y, e.isBoss ? '#ffd54f' : '#ff7043', e.isBoss ? 24 : 10, 95);

    // Bucket knight Lv.7 dual wield extend
    if (attacker.dualWieldTimer > 0 && attacker.heroId === 'bucket_knight' && attacker.heroLevel >= 7) {
      attacker.dualWieldTimer = Math.min(8, attacker.dualWieldTimer + 0.6);
    }

    // Kill mana talent
    if (attacker.talents.includes('kill_mana')) {
      attacker.mana = Math.min(attacker.maxMana, attacker.mana + 4);
    }

    // Vampire aura talent
    if (attacker.talents.includes('vampire_aura')) {
      attacker.vampireKillCounter++;
      if (attacker.vampireKillCounter >= 10) {
        attacker.vampireKillCounter = 0;
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + 1);
        this.addFloatingText(attacker.x, attacker.y - 16, '+1 HP', '#ff5252', 1.0);
      }
    }

    // Vampire mosquito sticker blood drop
    if (proj?.vampireDrop && isCrit && this.rng.chance(0.25)) {
      st.pickups.push({
        id: uid('bd'),
        kind: 'blood_drop',
        x: e.x,
        y: e.y,
        vx: 0,
        vy: 0,
        value: 1,
        roomId: e.roomId
      });
    }

    // Kill chain sticker 6-way burst!
    if (proj?.killChain) {
      for (let i = 0; i < 6; i++) {
        this.spawnPlayerProjectile(attacker, (i * Math.PI * 2) / 6, 220, Math.max(5, Math.round(proj.damage * 0.65)), false, proj.color, 4, 'orb', 0.8);
      }
    }

    // Skull Trumpet revives skeleton ally!
    if (proj?.sourceWeaponId === 'skull_trumpet') {
      this.spawnSummon(attacker, 'skeleton', e.x, e.y, 12);
    }

    // Coin & mana drops
    const coinMult = st.floorMutator === 'coin_rush' ? 3 : 1;
    const coinVal =
      (e.kind === 'gold_slime' ? 14 : e.isBoss ? 55 : e.isElite ? 12 : 4) * coinMult +
      (proj?.coinDropBonus ? 3 : 0);
    st.pickups.push({
      id: uid('cn'),
      kind: 'coin',
      x: e.x + this.rng.float(-8, 8),
      y: e.y + this.rng.float(-8, 8),
      vx: 0,
      vy: 0,
      value: coinVal,
      roomId: e.roomId
    });
    if (this.rng.chance(e.isBoss ? 1 : 0.72)) {
      st.pickups.push({
        id: uid('mn'),
        kind: 'mana',
        x: e.x + this.rng.float(-10, 10),
        y: e.y + this.rng.float(-10, 10),
        vx: 0,
        vy: 0,
        value: e.isBoss ? 40 : 10,
        roomId: e.roomId
      });
    }

    // Materials earned!
    if (this.rng.chance(e.isBoss ? 1 : e.isElite ? 0.65 : 0.16)) {
      const mat = e.isBoss
        ? 'core_crystal'
        : this.rng.pick(['iron', 'magic_shard', 'wood', 'quirk_part', 'glow_glue'] as const);
      attacker.materialsEarned[mat] = (attacker.materialsEarned[mat] ?? 0) + (e.isBoss ? 2 : 1);
    }

    // Special enemy death effects
    if (e.kind === 'armed_merchant') {
      this.hooks.onUnlockAchievement?.('rob_merchant');
      const inter = st.interactables.find((i) => i.roomId === e.roomId && i.kind === 'merchant_npc');
      if (inter?.shopItems) {
        for (const it of inter.shopItems) {
          if (it.weapon) {
            st.pickups.push({ id: uid('rob'), kind: 'weapon', x: e.x - 16, y: e.y, vx: 0, vy: 0, value: 0, weapon: it.weapon, roomId: e.roomId });
          } else if (it.stickerId) {
            st.pickups.push({ id: uid('rob'), kind: 'sticker', x: e.x + 16, y: e.y, vx: 0, vy: 0, value: 0, stickerId: it.stickerId, roomId: e.roomId });
          }
        }
      }
      this.emitToast('💥 干翻武装奸商！全摊商品免费白嫖！', '#ffd54f');
    } else if (e.kind === 'mimic_chest_boss' || e.kind === 'angry_frog') {
      const sid = this.rng.pick(STICKER_IDS);
      st.pickups.push({ id: uid('sp'), kind: 'sticker', x: e.x, y: e.y, vx: 0, vy: 0, value: 0, stickerId: sid, roomId: e.roomId });
    } else if (e.kind === 'boss_totem_pillar' || e.kind === 'boss_glitch_clone') {
      // Stun parent boss!
      const boss = st.enemies.find((b) => b.isBoss && b.hp > 0);
      if (boss) {
        boss.stunTimer = 2.0;
        this.addFloatingText(boss.x, boss.y - 20, '破防眩晕！', '#ffd54f', 1.2);
      }
    } else if (e.kind === 'boss_drone') {
      st.pickups.push({ id: uid('dr'), kind: 'hp_potion', x: e.x, y: e.y, vx: 0, vy: 0, value: 2, roomId: e.roomId });
    }

    // Daily factor: monster split
    if (!e.isBoss && !e.splitChild && e.kind !== 'gold_slime' && st.dailyFactors.includes('monster_split') && this.rng.chance(0.28)) {
      for (let i = 0; i < 2; i++) {
        const child = createEnemy(e.kind, e.roomId, e.x + (i === 0 ? -10 : 10), e.y, st.floor, false, 0.45);
        child.splitChild = true;
        child.radius = Math.max(5, Math.round(child.radius * 0.75));
        st.enemies.push(child);
      }
    }

    // Boss death rewards!
    if (e.isBoss) {
      attacker.gemsEarned += 180 + st.worldIndex * 80;
      this.hooks.onRecordBossKill?.(e.kind);
      if (e.kind === 'boss_goose_king') {
        this.hooks.onUnlockAchievement?.('goose_slayer');
        st.pickups.push(
          { id: uid('gw'), kind: 'weapon', x: e.x - 18, y: e.y, vx: 0, vy: 0, value: 0, weapon: createWeaponInstance('goose_bill_cannon'), roomId: e.roomId },
          { id: uid('gs'), kind: 'sticker', x: e.x + 18, y: e.y, vx: 0, vy: 0, value: 0, stickerId: 'shadow_clone', roomId: e.roomId }
        );
        this.emitToast('🪿 击败隐藏大鹅王！爆出限定红武【大鹅物业账单炮】！', '#ffeb3b');
      } else {
        const bdef = BIOMES[st.biome];
        st.pickups.push(
          { id: uid('bw'), kind: 'weapon', x: e.x - 20, y: e.y, vx: 0, vy: 0, value: 0, weapon: createWeaponInstance(bdef.bossRedWeapon), roomId: e.roomId },
          { id: uid('bs'), kind: 'sticker', x: e.x + 20, y: e.y, vx: 0, vy: 0, value: 0, stickerId: this.rng.pick(STICKER_IDS), roomId: e.roomId }
        );
        const seed = this.rng.pick(['fire_chili', 'frost_lotus', 'mandrake_poison', 'sticker_vine', 'lucky_clover'] as const);
        attacker.seedsEarned[seed] = (attacker.seedsEarned[seed] ?? 0) + 1;
        this.emitToast(`👑 击败【${e.name}】！掉落专属红武 + 稀有贴纸 + 魔法种子！`, '#ffd54f');
      }
    }
  }

  public damagePlayer(p: PlayerState, amount: number, element?: 'fire' | 'ice' | 'poison'): void {
    if (!p.alive || p.invulnTimer > 0) return;
    if (element === 'fire' && p.talents.includes('fire_shield')) return;
    if (element === 'poison' && (p.talents.includes('poison_shield') || (p.heroId === 'alchemist_quirk' && p.heroLevel >= 6))) return;

    // Paladin statue barrier blocks 1 hit completely
    if (p.paladinBarrier) {
      p.paladinBarrier = false;
      p.invulnTimer = 0.6;
      this.emitSfx('clang');
      this.addFloatingText(p.x, p.y - 14, '圣盾抵挡！', '#ffd54f', 1.0);
      return;
    }

    p.shieldDelayTimer = SHIELD_REGEN_DELAY;
    p.shieldRegenTimer = 0;
    p.hitFlashTimer = 0.14;
    this.emitShake(3.8, 0.14);
    this.emitSfx('player_hit');

    const hasBlueShield =
      p.talents.includes('blue_shield') || (p.heroId === 'bucket_knight' && p.heroLevel >= 6);

    if (p.shield > 0) {
      if (amount >= p.shield) {
        const overflow = amount - p.shield;
        p.shield = 0;
        // Ghost Lantern pet pulse on shield break!
        if (p.petId === 'ghost_lantern') {
          this.state.projectiles = this.state.projectiles.filter(
            (pr) => pr.fromPlayer || Math.hypot(pr.x - p.x, pr.y - p.y) > 76
          );
          p.shieldDelayTimer = 2.0;
          this.addFloatingText(p.x, p.y - 18, '幽灵提灯清弹！', '#b388ff', 0.95);
        }
        // Classic Blue Shield: overflow does NOT pierce HP!
        if (!hasBlueShield && overflow > 0) {
          p.hp = Math.max(0, p.hp - overflow);
        }
        p.invulnTimer = hasBlueShield ? 0.65 : 0.45;
        this.addFloatingText(p.x, p.y - 14, '破盾！', '#4fc3f7', 1.05);
      } else {
        p.shield -= amount;
        p.invulnTimer = 0.35;
        this.addFloatingText(p.x, p.y - 14, `-${amount}盾`, '#4fc3f7', 0.9);
      }
    } else {
      p.hp = Math.max(0, p.hp - amount);
      p.invulnTimer = 0.55;
      this.addFloatingText(p.x, p.y - 14, `-${amount}HP`, '#ff5252', 1.05);
    }

    if (p.hp <= 0) {
      p.alive = false;
      this.state.status = 'gameover';
      this.state.events.push({ type: 'run_gameover' });
    }
  }

  public triggerRevive(): boolean {
    const p = this.getMainPlayer();
    if (p.reviveUsed) return false;
    p.reviveUsed = true;
    p.alive = true;
    p.hp = p.maxHp;
    p.shield = this.getEffectiveMaxShield(p);
    p.invulnTimer = 2.2;
    this.state.projectiles = this.state.projectiles.filter((pr) => pr.fromPlayer);
    this.state.status = 'playing';
    this.emitSfx('jackpot');
    this.emitToast('✨ 女神庇佑复活！血盾全满并清空全场敌弹！', '#ffd54f');
    return true;
  }

  private damageBlackMerchant(inter: InteractableState, dmg: number, p: PlayerState): void {
    inter.hp = (inter.hp ?? 15) - dmg;
    this.addFloatingText(inter.x, inter.y - 16, `奸商怒气！`, '#ff5252', 1.0);
    if (inter.hp <= 0) {
      inter.used = true;
      p.merchantAngered = true;
      const boss = createEnemy('armed_merchant', inter.roomId, inter.x, inter.y, this.state.floor);
      boss.bossSpeech = '敢抢老子？！吃我双持加特林！！';
      boss.bossSpeechTimer = 3.0;
      this.state.enemies.push(boss);
      this.lockRoom(inter.roomId);
      this.emitSfx('explode');
      this.emitToast('🔫 触发黑商抢劫战！干翻他免费白嫖全部商品！', '#ff5252');
    }
  }

  private damageProp(prop: typeof this.state.props[number], dmg: number): void {
    if (prop.kind === 'pillar' || prop.hp <= 0) return;
    prop.hp -= dmg;
    prop.hitFlashTimer = 0.08;
    if (prop.hp <= 0) {
      this.spawnParticles(prop.x, prop.y, '#bcaaa4', 8, 70);
      if (prop.kind === 'barrel_red') {
        this.triggerExplosion(prop.x, prop.y, 48, 28, true, true);
      } else if (prop.kind === 'barrel_ice') {
        this.state.hazards.push({ id: uid('bi'), kind: 'ice_pool', x: prop.x, y: prop.y, radius: 42, timer: 3.5, maxTimer: 3.5, damage: 4, fromPlayer: true });
        for (const e of this.state.enemies) {
          if (Math.hypot(e.x - prop.x, e.y - prop.y) <= 50) e.freezeTimer = Math.max(e.freezeTimer, 2.2);
        }
      } else if (prop.kind === 'barrel_poison') {
        this.state.hazards.push({ id: uid('bp'), kind: 'poison_pool', x: prop.x, y: prop.y, radius: 44, timer: 4.0, maxTimer: 4.0, damage: 4, fromPlayer: true });
      } else if (prop.kind === 'coffee_machine') {
        // Developer room secret easter egg!
        const w = createWeaponInstance(this.rng.pick(['keyboard_bible', 'glitch_404_sword', 'rubber_chicken', 'one_punch_glove'] as const));
        w.stickers.push('rapid_fire', 'homing');
        this.state.pickups.push({ id: uid('dev'), kind: 'weapon', x: prop.x, y: prop.y + 8, vx: 0, vy: 0, value: 0, weapon: w, roomId: prop.roomId });
        this.getMainPlayer().gemsEarned += 200;
        this.emitToast('☕ 砸碎程序员咖啡机！掉出一把满贴纸彩蛋神兵 + 200 蓝币！', '#ff80ab');
      } else {
        const p1 = this.getMainPlayer();
        const extra = p1.talents.includes('crate_potions');
        if (this.rng.chance(extra ? 0.55 : 0.28)) {
          this.state.pickups.push({ id: uid('cr'), kind: 'mana', x: prop.x, y: prop.y, vx: 0, vy: 0, value: 12, roomId: prop.roomId });
        }
        if (this.rng.chance(extra ? 0.35 : 0.08)) {
          this.state.pickups.push({ id: uid('ch'), kind: 'hp_potion', x: prop.x + 6, y: prop.y, vx: 0, vy: 0, value: 1, roomId: prop.roomId });
        }
        if (this.rng.chance(0.4)) {
          this.state.pickups.push({ id: uid('cc'), kind: 'coin', x: prop.x - 5, y: prop.y, vx: 0, vy: 0, value: 5, roomId: prop.roomId });
        }
      }
    }
  }

  private triggerExplosion(
    x: number,
    y: number,
    radius: number,
    damage: number,
    fromPlayer: boolean,
    canBreakWall: boolean
  ): void {
    const st = this.state;
    this.emitSfx('explode');
    this.emitShake(4.2, 0.16);
    this.spawnParticles(x, y, '#ff6d00', 14, 115);
    this.spawnParticles(x, y, '#ffd54f', 8, 80);

    if (canBreakWall) this.blastCrackedWallAt(x, y, radius);

    const p1 = this.getMainPlayer();
    for (const e of st.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= radius + e.radius) {
        this.damageEnemy(e, damage, false, p1, ['fire']);
      }
    }
    for (const prop of st.props) {
      if (prop.hp > 0 && prop.kind !== 'pillar' && Math.hypot(prop.x - x, prop.y - y) <= radius + prop.radius) {
        this.damageProp(prop, damage);
      }
    }
    if (!fromPlayer && Math.hypot(p1.x - x, p1.y - y) <= radius + p1.radius) {
      this.damagePlayer(p1, Math.max(1, Math.round(damage / 10)), 'fire');
    }
  }

  public blastCrackedWallAt(px: number, py: number, radius = 32): boolean {
    const st = this.state;
    let opened = false;
    for (const room of st.map.rooms) {
      if (room.kind !== 'secret' || room.secretRevealed || !room.secretWallTiles) continue;
      for (const tile of room.secretWallTiles) {
        const wx = (tile.x + 0.5) * TILE_SIZE;
        const wy = (tile.y + 0.5) * TILE_SIZE;
        if (Math.hypot(wx - px, wy - py) <= radius + TILE_SIZE) {
          for (const t of room.secretWallTiles) {
            setTileAt(st.map, t.x, t.y, TileType.FLOOR);
            this.spawnParticles((t.x + 0.5) * TILE_SIZE, (t.y + 0.5) * TILE_SIZE, '#bcaaa4', 8, 80);
          }
          room.secretRevealed = true;
          room.discovered = true;
          opened = true;
          this.emitSfx('jackpot');
          this.hooks.onUnlockAchievement?.('secret_finder');
          this.emitToast('🕳️ 轰隆！炸开了隐藏裂纹墙，发现了秘密密室！', '#ffd54f');
          break;
        }
      }
    }
    return opened;
  }

  private triggerChainLightning(
    x: number,
    y: number,
    damage: number,
    attacker: PlayerState,
    skipEnemyId?: string
  ): void {
    const targets = this.state.enemies
      .filter((e) => e.hp > 0 && e.id !== skipEnemyId && Math.hypot(e.x - x, e.y - y) <= 105)
      .slice(0, 3);
    let prevX = x;
    let prevY = y;
    for (const t of targets) {
      this.state.lasers.push({
        id: uid('lgt'),
        x1: prevX,
        y1: prevY,
        x2: t.x,
        y2: t.y,
        width: 2.5,
        color: '#ffee58',
        life: 0.14,
        maxLife: 0.14,
        fromPlayer: true
      });
      t.hp -= damage;
      t.hitFlashTimer = 0.06;
      this.addFloatingText(t.x, t.y - 10, `${damage}⚡`, '#ffee58', 0.9);
      if (t.hp <= 0) this.onEnemyKilled(t, attacker, false);
      prevX = t.x;
      prevY = t.y;
    }
  }

  private stepPet(p: PlayerState, dt: number): void {
    const pet = this.state.pet;
    const frenzy = p.talents.includes('pet_frenzy') ? 2 : 1;
    if (pet.alertTimer && pet.alertTimer > 0) pet.alertTimer -= dt;
    if (pet.sleepTimer > 0) {
      pet.sleepTimer -= dt;
      return;
    }

    // Mecha Duck alerts near hidden cracked walls!
    if (pet.id === 'mecha_duck' && (!pet.alertTimer || pet.alertTimer <= 0)) {
      for (const r of this.state.map.rooms) {
        if (r.kind === 'secret' && !r.secretRevealed && r.secretWallTiles?.[0]) {
          const t = r.secretWallTiles[0];
          if (Math.hypot((t.x + 0.5) * TILE_SIZE - p.x, (t.y + 0.5) * TILE_SIZE - p.y) < 110) {
            pet.alertText = '嘎嘎!! 墙有裂缝!!';
            pet.alertTimer = 2.5;
            this.emitSfx('chicken');
          }
        }
      }
    }

    // Move toward nearest enemy or follow player
    const nearEnemy = this.findNearestEnemy(p.x, p.y, 130);
    const goalX = nearEnemy ? nearEnemy.x : p.x - 16 * p.facingX;
    const goalY = nearEnemy ? nearEnemy.y : p.y + 10;
    const dx = goalX - pet.x;
    const dy = goalY - pet.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      const spd = 92;
      pet.x += (dx / d) * spd * dt;
      pet.y += (dy / d) * spd * dt;
      pet.facingX = dx >= 0 ? 1 : -1;
    }

    pet.attackCooldown -= dt * frenzy;
    if (nearEnemy && d < 22 && pet.attackCooldown <= 0) {
      this.damageEnemy(nearEnemy, 5 * frenzy, false, p);
      pet.attackCooldown = 0.85;
    }

    // Special ranged pets
    pet.abilityCooldown -= dt * frenzy;
    if (nearEnemy && pet.abilityCooldown <= 0) {
      if (pet.id === 'mecha_duck') {
        const a = Math.atan2(nearEnemy.y - pet.y, nearEnemy.x - pet.x);
        this.spawnPlayerProjectile(p, a, 190, 9 * frenzy, false, '#ffd54f', 4, 'bomb', 1.4, { homingStrength: 5 });
        pet.abilityCooldown = 4.5;
      } else if (pet.id === 'mini_dragon') {
        const a = Math.atan2(nearEnemy.y - pet.y, nearEnemy.x - pet.x);
        for (let i = -1; i <= 1; i++) {
          this.spawnPlayerProjectile(p, a + i * 0.25, 195, 5 * frenzy, false, '#ff5722', 4, 'orb', 1.1, { elements: ['fire'] });
        }
        pet.abilityCooldown = 3.8;
      }
    }
  }

  private stepMercs(p: PlayerState, dt: number): void {
    const frenzy = p.talents.includes('pet_frenzy') ? 2 : 1;
    for (const m of this.state.mercs) {
      if (!m.alive) continue;
      if (m.speechTimer && m.speechTimer > 0) m.speechTimer -= dt;
      const e = this.findNearestEnemy(m.x, m.y, 160);
      const gx = e ? e.x : p.x + 20;
      const gy = e ? e.y : p.y + 12;
      const dx = gx - m.x;
      const dy = gy - m.y;
      const d = Math.hypot(dx, dy);
      if (d > (e ? 50 : 20)) {
        const mv = moveCircleWithCollisions(this.state.map, this.state.props, m.x, m.y, (dx / d) * 78 * dt, (dy / d) * 78 * dt, 6);
        m.x = mv.x;
        m.y = mv.y;
      }
      m.attackCooldown -= dt * frenzy;
      if (e && m.attackCooldown <= 0) {
        const a = Math.atan2(e.y - m.y, e.x - m.x);
        if (m.kind === 'archer') {
          this.spawnPlayerProjectile(p, a + this.rng.float(-0.12, 0.12), 260, 8 * frenzy, false, '#66bb6a', 4, 'arrow', 1.2);
          m.attackCooldown = 0.65;
        } else if (m.kind === 'bomber') {
          this.spawnPlayerProjectile(p, a, 170, 14 * frenzy, false, '#ff7043', 5, 'bomb', 1.0, { explosiveRadius: 30, canBreakCrackedWall: true });
          m.attackCooldown = 1.6;
        } else if (m.kind === 'mage') {
          this.spawnPlayerProjectile(p, a, 210, 9 * frenzy, false, '#4fc3f7', 4.5, 'orb', 1.2, { elements: ['ice'] });
          m.attackCooldown = 1.1;
        } else {
          // Chef slashes nearby bullets & hits
          this.state.projectiles = this.state.projectiles.filter((pr) => pr.fromPlayer || Math.hypot(pr.x - m.x, pr.y - m.y) > 28);
          if (d < 34) this.damageEnemy(e, 10 * frenzy, false, p);
          m.attackCooldown = 0.9;
        }
      }
    }
  }

  private stepTurrets(p: PlayerState, dt: number): void {
    const keep = [];
    for (const t of this.state.turrets) {
      t.life -= dt;
      if (t.life <= 0) {
        // Sticker smith Lv.7 turret explodes & drops mana!
        this.triggerExplosion(t.x, t.y, 34, 18, true, false);
        if (p.heroLevel >= 7) {
          this.state.pickups.push({ id: uid('tm'), kind: 'mana', x: t.x, y: t.y, vx: 0, vy: 0, value: 14 });
        }
        continue;
      }
      t.fireCooldown -= dt;
      const e = this.findNearestEnemy(t.x, t.y, 175);
      if (e && t.fireCooldown <= 0) {
        const fakeWpn: WeaponInstance = {
          uid: t.id,
          defId: 'worn_pistol',
          stickers: t.stickers,
          extraSlots: 0,
          damageBonus: t.damage - 5,
          shotCounter: Math.floor(this.state.time * 4)
        };
        const ctx = buildAttackContext(p, fakeWpn, this.rng, { dailyFactors: this.state.dailyFactors });
        const ang = Math.atan2(e.y - t.y, e.x - t.x);
        const savedX = p.x;
        const savedY = p.y;
        const savedAng = p.aimAngle;
        p.x = t.x;
        p.y = t.y;
        p.aimAngle = ang;
        if (ctx.mode === 'laser') this.fireLasers(p, ctx, false);
        else this.fireProjectiles(p, ctx, false);
        p.x = savedX;
        p.y = savedY;
        p.aimAngle = savedAng;
        t.fireCooldown = Math.max(0.22, 0.75 / (ctx.fireRate / 3.6));
      }
      keep.push(t);
    }
    this.state.turrets = keep;
  }

  private spawnSummon(p: PlayerState, kind: 'chicken' | 'slime' | 'skeleton', x: number, y: number, damage: number, element?: ElementTag): void {
    const st = this.state;
    if (st.summons.length >= MAX_SUMMONS) {
      const oldest = st.summons.shift()!;
      this.triggerExplosion(oldest.x, oldest.y, 28, oldest.damage, true, false);
    }
    st.summons.push({
      id: uid('sum'),
      ownerId: p.id,
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      life: 7.5,
      damage,
      radius: 6,
      element
    });
    const chickens = st.summons.filter((s) => s.kind === 'chicken').length;
    if (chickens >= 8) this.hooks.onUnlockAchievement?.('chicken_farm');
  }

  private stepSummons(p: PlayerState, dt: number): void {
    const keep = [];
    for (const s of this.state.summons) {
      s.life -= dt;
      if (s.life <= 0) continue;
      const e = this.findNearestEnemy(s.x, s.y, 190);
      if (e) {
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        s.x += (dx / d) * 108 * dt;
        s.y += (dy / d) * 108 * dt;
        if (d <= s.radius + e.radius + 4) {
          if (s.kind === 'chicken' || s.kind === 'slime') {
            this.triggerExplosion(s.x, s.y, 30, s.damage, true, false);
            if (s.element) this.damageEnemy(e, 4, false, p, [s.element]);
            continue;
          } else {
            this.damageEnemy(e, s.damage, false, p);
            s.life -= 1.2;
          }
        }
      }
      keep.push(s);
    }
    this.state.summons = keep;
  }

  private stepSanctuaries(p: PlayerState, dt: number): void {
    const keep = [];
    for (const s of this.state.sanctuaries) {
      s.timer -= dt;
      if (s.timer <= 0) continue;
      s.healTick -= dt;
      if (s.healTick <= 0 && Math.hypot(p.x - s.x, p.y - s.y) <= s.radius) {
        s.healTick = 1.0;
        p.hp = Math.min(p.maxHp, p.hp + 1);
        p.shield = Math.min(this.getEffectiveMaxShield(p), p.shield + 1);
        p.mana = Math.min(p.maxMana, p.mana + 10);
        this.addFloatingText(p.x, p.y - 16, '✨摸鱼回血盾蓝', '#fff59d', 0.85);
      }
      keep.push(s);
    }
    this.state.sanctuaries = keep;
  }

  private stepBlackHoles(p: PlayerState, dt: number): void {
    const keep = [];
    for (const bh of this.state.blackHoles) {
      bh.timer -= dt;
      if (bh.timer <= 0) continue;
      // Pull enemies and swallow enemy bullets!
      for (const e of this.state.enemies) {
        if (e.hp <= 0) continue;
        const dx = bh.x - e.x;
        const dy = bh.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d > 4 && d < bh.radius) {
          const pull = (e.isBoss ? 25 : 85) * dt;
          const mv = moveCircleWithCollisions(this.state.map, this.state.props, e.x, e.y, (dx / d) * pull, (dy / d) * pull, e.radius);
          e.x = mv.x;
          e.y = mv.y;
        }
      }
      this.state.projectiles = this.state.projectiles.filter(
        (pr) => pr.fromPlayer || Math.hypot(pr.x - bh.x, pr.y - bh.y) > bh.radius * 0.65
      );
      bh.damageTick -= dt;
      if (bh.damageTick <= 0) {
        bh.damageTick = 0.3;
        for (const e of this.state.enemies) {
          if (e.hp > 0 && Math.hypot(e.x - bh.x, e.y - bh.y) < bh.radius) {
            this.damageEnemy(e, 5, false, p);
          }
        }
      }
      keep.push(bh);
    }
    this.state.blackHoles = keep;
  }

  private stepEnemies(p: PlayerState, dt: number): void {
    const helpers = {
      damagePlayer: (pl: PlayerState, amt: number, el?: 'fire' | 'ice' | 'poison') => this.damagePlayer(pl, amt, el),
      spawnParticles: (x: number, y: number, c: string, n: number, spd?: number) => this.spawnParticles(x, y, c, n, spd),
      addFloatingText: (x: number, y: number, t: string, c: string, s?: number) => this.addFloatingText(x, y, t, c, s)
    };
    for (const e of this.state.enemies) {
      stepEnemyAI(this.state, e, p, dt, this.rng, helpers);
    }
    this.state.enemies = this.state.enemies.filter((e) => e.hp > 0);
  }

  private stepHazards(dt: number): void {
    const p1 = this.getMainPlayer();
    const keep: WorldState['hazards'] = [];
    for (const h of this.state.hazards) {
      h.timer -= dt;
      if (h.kind === 'meteor_warn' || h.kind === 'bomb_warn') {
        if (h.timer <= 0) {
          this.triggerExplosion(h.x, h.y, h.radius, h.damage, h.fromPlayer, Boolean(h.canBreakWall));
          if (h.kind === 'meteor_warn') {
            keep.push({
              id: uid('fp'),
              kind: 'fire_pool',
              x: h.x,
              y: h.y,
              radius: h.radius * 0.85,
              timer: 2.2,
              maxTimer: 2.2,
              damage: 1,
              fromPlayer: h.fromPlayer
            });
          }
          continue;
        }
      } else {
        if (h.timer <= 0) continue;
        // Pool ticks roughly twice per second
        if (Math.floor((h.timer + dt) * 2) !== Math.floor(h.timer * 2)) {
          if (h.fromPlayer) {
            for (const e of this.state.enemies) {
              if (e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) <= h.radius + e.radius) {
                const el: ElementTag = h.kind === 'fire_pool' ? 'fire' : h.kind === 'ice_pool' ? 'ice' : 'poison';
                this.damageEnemy(e, h.damage, false, p1, [el]);
              }
            }
          } else if (Math.hypot(p1.x - h.x, p1.y - h.y) <= h.radius) {
            const el = h.kind === 'fire_pool' ? 'fire' : h.kind === 'ice_pool' ? 'ice' : 'poison';
            this.damagePlayer(p1, h.damage, el);
          }
        }
      }
      keep.push(h);
    }
    this.state.hazards = keep;
  }

  private stepPickups(p: PlayerState, dt: number): void {
    const magnetRange = p.petId === 'greedy_slime' ? 190 : 48;
    const keep = [];
    for (const pk of this.state.pickups) {
      if (pk.kind === 'weapon' || pk.kind === 'sticker') {
        keep.push(pk);
        continue;
      }
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy);
      if (d < magnetRange) {
        const pull = p.petId === 'greedy_slime' ? 210 : 155;
        pk.x += (dx / (d || 1)) * pull * dt;
        pk.y += (dy / (d || 1)) * pull * dt;
      }
      if (d < 14) {
        if (pk.kind === 'coin') {
          p.coins += pk.value;
          this.emitSfx('coin');
        } else if (pk.kind === 'mana') {
          p.mana = Math.min(p.maxMana, p.mana + pk.value);
          this.emitSfx('mana');
        } else if (pk.kind === 'hp_potion') {
          p.hp = Math.min(p.maxHp, p.hp + pk.value);
          this.addFloatingText(p.x, p.y - 14, `+${pk.value}HP`, '#69f0ae', 1.0);
          this.emitSfx('heal');
        } else if (pk.kind === 'blood_drop') {
          if (p.hp < p.maxHp) p.hp += 1;
          else p.shield = Math.min(this.getEffectiveMaxShield(p), p.shield + 2);
          this.emitSfx('heal');
        }
        continue;
      }
      keep.push(pk);
    }
    this.state.pickups = keep;
  }

  private stepVisualEffects(dt: number): void {
    const st = this.state;
    st.lasers = st.lasers.filter((l) => {
      l.life -= dt;
      return l.life > 0;
    });
    st.slashes = st.slashes.filter((s) => {
      s.life -= dt;
      return s.life > 0;
    });
    st.floatingTexts = st.floatingTexts.filter((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
      return f.life > 0;
    });
    st.particles = st.particles.filter((pt) => {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      return pt.life > 0;
    });
    st.props = st.props.filter((pr) => {
      if (pr.hitFlashTimer > 0) pr.hitFlashTimer -= dt;
      return pr.hp > 0;
    });
  }

  private checkRoomState(p: PlayerState): void {
    const st = this.state;
    const room = this.findRoomContaining(p.x, p.y);
    if (!room) return;
    st.activeRoomId = room.id;
    room.discovered = true;

    // Gold slimes secret room spawn on first entry
    if (room.kind === 'secret' && room.secretContent === 'gold_slimes' && !room.cleared) {
      room.cleared = true;
      for (let i = 0; i < 6; i++) {
        st.enemies.push(createEnemy('gold_slime', room.id, room.cx + this.rng.float(-45, 45), room.cy + this.rng.float(-30, 30), st.floor));
      }
    }

    // Trigger combat / boss room when stepping inside margin
    const innerLeft = (room.x + 1.4) * TILE_SIZE;
    const innerRight = (room.x + room.w - 1.4) * TILE_SIZE;
    const innerTop = (room.y + 1.4) * TILE_SIZE;
    const innerBot = (room.y + room.h - 1.4) * TILE_SIZE;
    const deeplyInside = p.x > innerLeft && p.x < innerRight && p.y > innerTop && p.y < innerBot;

    if (!room.cleared && !room.locked && deeplyInside) {
      this.lockRoom(room.id);
      room.wave = 1;
      const spawned = spawnRoomWave(
        room,
        st.biome,
        st.floor,
        this.rng,
        st.dailyFactors.includes('double_boss')
      );
      st.enemies.push(...spawned);
      if (room.kind === 'boss') {
        const bdef = BIOMES[st.biome];
        st.bossBannerTimer = 2.8;
        st.bossBannerName = `${bdef.bossName} · ${bdef.bossTitle}`;
        this.emitSfx('boss_intro');
      }
    }

    // Check if locked room is cleared!
    if (room.locked) {
      const remaining = st.enemies.filter((e) => e.roomId === room.id && e.hp > 0);
      if (remaining.length === 0) {
        if (room.wave < room.maxWaves) {
          room.wave++;
          const nextWave = spawnRoomWave(room, st.biome, st.floor, this.rng);
          if (room.arenaActive) nextWave.forEach((e) => (e.isElite = true));
          st.enemies.push(...nextWave);
          this.emitToast(`⚔️ 第 ${room.wave}/${room.maxWaves} 波增援抵达！`, '#ff9f1c');
        } else {
          this.unlockRoom(room);
        }
      }
    }
  }

  private lockRoom(roomId: string): void {
    const room = this.state.map.rooms.find((r) => r.id === roomId);
    if (!room) return;
    room.locked = true;
    for (const d of room.doorTiles) {
      setTileAt(this.state.map, d.x, d.y, TileType.DOOR_LOCKED);
    }
  }

  private unlockRoom(room: RoomData): void {
    const st = this.state;
    const p1 = this.getMainPlayer();
    room.locked = false;
    room.cleared = true;
    for (const d of room.doorTiles) {
      setTileAt(st.map, d.x, d.y, TileType.DOOR_OPEN);
    }
    // Clear enemy bullets on room clear!
    st.projectiles = st.projectiles.filter((pr) => pr.fromPlayer);
    this.emitSfx('room_clear');

    // Orange Cat pet digs up bonus coins every 3 rooms!
    if (p1.petId === 'orange_cat') {
      st.pet.roomsClearedCounter++;
      if (st.pet.roomsClearedCounter % 3 === 0 && this.rng.chance(0.55)) {
        const bonus = this.rng.int(6, 12);
        p1.coins += bonus;
        this.addFloatingText(st.pet.x, st.pet.y - 12, `大橘刨出 +${bonus}金!`, '#ff9e43', 1.0);
      }
    }

    // Arena reward chest
    if (room.arenaActive) {
      room.arenaActive = false;
      const s = this.rng.pick(STICKER_IDS);
      const w = createWeaponInstance(this.rng.pick(['goblin_gatling', 'dwarf_sniper', 'twin_lightsaber', 'blackhole_vacuum', 'meteor_tome', 'solar_cannon'] as const));
      st.pickups.push(
        { id: uid('arw'), kind: 'weapon', x: room.cx - 16, y: room.cy, vx: 0, vy: 0, value: 0, weapon: w, roomId: room.id },
        { id: uid('ars'), kind: 'sticker', x: room.cx + 16, y: room.cy, vx: 0, vy: 0, value: 0, stickerId: s, roomId: room.id }
      );
      this.emitToast('🏆 竞技场通关！传说武器 + 贴纸奉上！', '#ffd54f');
    } else if (room.kind === 'combat' && this.rng.chance(0.32 + (p1.petId === 'sticker_fairy' ? 0.18 : 0))) {
      // Combat room surprise sticker drop!
      const sid = this.rng.pick(STICKER_IDS);
      st.pickups.push({ id: uid('cs'), kind: 'sticker', x: room.cx, y: room.cy, vx: 0, vy: 0, value: 0, stickerId: sid, roomId: room.id });
    }

    // Boss room spawns next-floor portal!
    if (room.kind === 'boss') {
      st.interactables.push({
        id: uid('bp'),
        roomId: room.id,
        kind: 'portal',
        x: room.cx,
        y: room.cy - 22,
        radius: 18,
        used: false,
        usesCount: 0,
        cost: 0
      });
    }
  }

  public findNearestInteractableOrPickup(p: PlayerState):
    | { type: 'interactable'; target: InteractableState }
    | { type: 'pickup'; target: PickupState }
    | null {
    let bestDist = 30;
    let best:
      | { type: 'interactable'; target: InteractableState }
      | { type: 'pickup'; target: PickupState }
      | null = null;

    for (const pk of this.state.pickups) {
      if (pk.kind !== 'weapon' && pk.kind !== 'sticker') continue;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        best = { type: 'pickup', target: pk };
      }
    }
    for (const inter of this.state.interactables) {
      if (inter.used && inter.kind !== 'portal') continue;
      const d = Math.hypot(inter.x - p.x, inter.y - p.y);
      if (d < bestDist + 6) {
        bestDist = d;
        best = { type: 'interactable', target: inter };
      }
    }
    return best;
  }

  private executeNearbyInteraction(
    p: PlayerState,
    found: NonNullable<ReturnType<GameWorld['findNearestInteractableOrPickup']>>
  ): void {
    const st = this.state;
    if (found.type === 'pickup') {
      const pk = found.target;
      if (pk.kind === 'weapon' && pk.weapon) {
        st.pickups = st.pickups.filter((x) => x.id !== pk.id);
        this.equipGroundWeapon(p, pk.weapon, pk.x, pk.y, pk.roomId);
      } else if (pk.kind === 'sticker' && pk.stickerId) {
        st.pickups = st.pickups.filter((x) => x.id !== pk.id);
        this.openStickerOffer(pk.stickerId, pk.id);
      }
      return;
    }

    const inter = found.target;
    if (inter.kind === 'portal') {
      this.enterPortal();
      return;
    }
    handleInteractable(inter, this.makeCuriosityContext(p));
  }

  private equipGroundWeapon(
    p: PlayerState,
    newWpn: WeaponInstance,
    dropX: number,
    dropY: number,
    roomId?: string
  ): void {
    const maxW = p.talents.includes('extra_weapon_slot') ? 3 : 2;
    this.hooks.onRecordWeapon?.(newWpn.defId);
    this.emitSfx('switch');

    if (p.weapons.length < maxW) {
      p.weapons.push(newWpn);
      p.activeWeaponIndex = p.weapons.length - 1;
    } else {
      const old = p.weapons[p.activeWeaponIndex];
      // Sticker salvage talent auto-transfers 1 sticker!
      if (p.talents.includes('sticker_salvage') && old.stickers.length > 0) {
        const salvaged = old.stickers.pop()!;
        const maxSlots = getWeaponMaxSlots(p, newWpn, this.state.dailyFactors);
        if (newWpn.stickers.length < maxSlots && !newWpn.stickers.includes(salvaged)) {
          newWpn.stickers.push(salvaged);
          this.emitToast(`♻️ 贴纸回收师自动转移【${STICKERS[salvaged].name}】！`, '#69f0ae');
        }
      }
      p.weapons[p.activeWeaponIndex] = newWpn;
      this.state.pickups.push({
        id: uid('drop'),
        kind: 'weapon',
        x: dropX,
        y: dropY,
        vx: 0,
        vy: 0,
        value: 0,
        weapon: old,
        roomId
      });
    }
    this.emitToast(`🎒 装备【${WEAPONS[newWpn.defId].name}】！`, '#ffd54f');
  }

  private openStickerOffer(stickerId: StickerId, sourcePickupId?: string): void {
    this.hooks.onRecordSticker?.(stickerId);
    this.state.pendingStickerOffer = { stickerId, sourcePickupId };
    this.state.status = 'paused_modal';
    this.state.events.push({ type: 'sticker_pickup', stickerId, pickupId: sourcePickupId ?? '' });
  }

  public applyStickerToWeapon(weaponIndex: number, replaceSlotIndex?: number): boolean {
    const st = this.state;
    const offer = st.pendingStickerOffer;
    if (!offer) return false;
    const p = this.getMainPlayer();
    const w = p.weapons[weaponIndex];
    if (!w) return false;

    const maxSlots = getWeaponMaxSlots(p, w, st.dailyFactors);
    if (!st.endlessMode && w.stickers.includes(offer.stickerId)) {
      this.emitToast('同把武器不能重复贴同款贴纸（无尽模式除外）！', '#ffb74d');
      return false;
    }

    if (w.stickers.length < maxSlots) {
      w.stickers.push(offer.stickerId);
    } else if (replaceSlotIndex !== undefined && replaceSlotIndex >= 0 && replaceSlotIndex < w.stickers.length) {
      w.stickers[replaceSlotIndex] = offer.stickerId;
    } else {
      w.stickers[w.stickers.length - 1] = offer.stickerId;
    }

    st.pendingStickerOffer = null;
    st.status = 'playing';
    this.emitSfx('jackpot');
    this.emitToast(`🏷️ 给【${WEAPONS[w.defId].name}】贴上了【${STICKERS[offer.stickerId].name}】！`, STICKERS[offer.stickerId].color);
    return true;
  }

  public scrapPendingSticker(): void {
    const st = this.state;
    if (!st.pendingStickerOffer) return;
    const p = this.getMainPlayer();
    p.coins += 25;
    p.materialsEarned.glow_glue = (p.materialsEarned.glow_glue ?? 0) + 1;
    st.pendingStickerOffer = null;
    st.status = 'playing';
    this.emitSfx('coin');
    this.emitToast('💰 分解贴纸获得 25 金币 + 荧光胶水×1！', '#ffd54f');
  }

  public buyShopItem(interactableId: string, itemId: string): boolean {
    const inter = this.state.interactables.find((i) => i.id === interactableId);
    const item = inter?.shopItems?.find((it) => it.id === itemId);
    if (!inter || !item) return false;
    return buyShopItemFromInteractable(inter, item, this.makeCuriosityContext(this.getMainPlayer()));
  }

  public closeWorkshopModal(): void {
    this.state.activeWorkshopId = null;
    if (!this.state.pendingStickerOffer && !this.state.pendingTalentOptions) {
      this.state.status = 'playing';
    }
  }

  public pickTalent(talentId: TalentId): void {
    const p = this.getMainPlayer();
    if (!p.talents.includes(talentId)) {
      p.talents.push(talentId);
    }
    this.state.pendingTalentOptions = null;
    this.state.status = 'playing';
    this.emitSfx('jackpot');
    this.advanceToFloor(this.state.floor + 1);
  }

  private enterPortal(): void {
    const st = this.state;
    const p = this.getMainPlayer();
    p.gemsEarned += 50 + st.worldIndex * 35;

    // Victory at 3-5 (floor 15) if not already endless!
    if (st.floor === 15 && !st.endlessMode) {
      st.status = 'victory';
      p.gemsEarned += 600;
      this.hooks.onUnlockAchievement?.('first_clear');
      if (p.weapons.some((w) => w.defId === 'salted_fish' && w.stickers.length >= 2)) {
        this.hooks.onUnlockAchievement?.('salted_fish_win');
      }
      st.events.push({ type: 'run_victory', canEndless: true });
      return;
    }

    // Talent pick nodes: 1-1(1), 1-3(3), 1-5(5), 2-2(7), 2-5(10), 3-2(12), and every 3 floors in endless
    const talentFloors = [1, 3, 5, 7, 10, 12];
    const shouldOfferTalent =
      talentFloors.includes(st.floor) || (st.endlessMode && st.floor % 3 === 0);

    if (shouldOfferTalent && p.talents.length < 10) {
      const opts = pickThreeTalents(p, this.rng);
      if (opts.length > 0) {
        st.pendingTalentOptions = opts;
        st.status = 'paused_modal';
        st.events.push({ type: 'talent_choice', options: opts });
        return;
      }
    }

    this.advanceToFloor(st.floor + 1);
  }

  public continueIntoEndless(): void {
    this.state.endlessMode = true;
    this.hooks.onUnlockAchievement?.('endless_diver');
    this.advanceToFloor(16);
  }

  private advanceToFloor(nextFloor: number): void {
    const p = this.getMainPlayer();
    const prevMercs = this.state.mercs.map((m) => ({ ...m, alive: true, hp: m.maxHp }));
    const nextState = this.buildFloorState(
      this.state.seed,
      nextFloor,
      this.state.biomePerWorld,
      p,
      this.state.dailyFactors,
      this.state.endlessMode
    );
    nextState.mercs = prevMercs.map((m) => ({ ...m, x: p.x + 18, y: p.y + 8 }));
    this.state = nextState;
    this.state.events.push({ type: 'floor_complete', nextFloor });
    this.emitSfx('portal');
    this.emitToast(
      `🌀 抵达 ${nextState.worldIndex}-${nextState.stageIndex}【${BIOMES[nextState.biome].name}】！`,
      '#80d8ff'
    );
  }

  private makeCuriosityContext(p: PlayerState): CuriosityContext {
    return {
      world: this.state,
      player: p,
      rng: this.rng,
      toast: (t, c) => this.emitToast(t, c),
      sfx: (s, pitch) => this.emitSfx(s, pitch),
      addFloatingText: (x, y, t, c, sc) => this.addFloatingText(x, y, t, c, sc),
      lockRoom: (rid) => this.lockRoom(rid),
      offerSticker: (sid) => this.openStickerOffer(sid),
      openTalentChoice: () => {
        const opts = pickThreeTalents(p, this.rng);
        if (opts.length > 0) {
          this.state.pendingTalentOptions = opts;
          this.state.status = 'paused_modal';
          this.state.events.push({ type: 'talent_choice', options: opts });
        }
      },
      unlockAchievement: (id) => this.hooks.onUnlockAchievement?.(id),
      recordSticker: (id) => this.hooks.onRecordSticker?.(id),
      recordWeapon: (id) => this.hooks.onRecordWeapon?.(id)
    };
  }

  private findRoomContaining(x: number, y: number): RoomData | undefined {
    const tx = x / TILE_SIZE;
    const ty = y / TILE_SIZE;
    return this.state.map.rooms.find(
      (r) => tx >= r.x && tx <= r.x + r.w && ty >= r.y && ty <= r.y + r.h
    );
  }

  private findNearestEnemy(x: number, y: number, maxRange: number): EnemyState | null {
    let best: EnemyState | null = null;
    let bestD = maxRange;
    for (const e of this.state.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private addFloatingText(x: number, y: number, text: string, color: string, scale = 1): void {
    this.state.floatingTexts.push({
      id: uid('ft'),
      x,
      y,
      vy: -24,
      text,
      color,
      scale,
      life: 0.72,
      maxLife: 0.72
    });
  }

  private spawnParticles(x: number, y: number, color: string, count: number, speed = 70): void {
    if (this.state.particles.length > 260) return;
    for (let i = 0; i < count; i++) {
      const a = this.rng.float(0, Math.PI * 2);
      const s = this.rng.float(speed * 0.3, speed);
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: this.rng.int(2, 3),
        color,
        life: this.rng.float(0.18, 0.42),
        maxLife: 0.42
      });
    }
  }

  private emitSfx(sound: string, pitch?: number) {
    this.state.events.push({ type: 'sfx', sound, pitch });
  }
  private emitShake(intensity: number, duration: number) {
    this.state.events.push({ type: 'shake', intensity, duration });
  }
  private emitHitstop(duration: number) {
    this.state.events.push({ type: 'hitstop', duration });
  }
  private emitToast(text: string, color?: string) {
    this.state.events.push({ type: 'toast', text, color });
  }
}

function normalizeAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export { isSolidTile };
