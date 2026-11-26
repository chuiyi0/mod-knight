import { BIOMES } from '../../content/biomes';
import { STICKER_IDS } from '../../content/stickers';
import { createWeaponInstance, MELEE_QUIRK_WEAPONS, NORMAL_DROP_WEAPONS } from '../../content/weapons';
import { setTileAt } from '../collision';
import { SeededRNG } from '../rng';
import {
  BiomeId,
  CuriosityKind,
  DailyFactorId,
  EnemyState,
  FloorMap,
  InteractableState,
  MercKind,
  PickupState,
  PortalDestination,
  PropState,
  RoomData,
  RoomKind,
  ShopItem,
  StatueId,
  TILE_SIZE,
  TileType,
  Vec2,
  ZoneFlavor
} from '../types';
import { createEnemy } from './enemies';

const GRID_W = 6;
const GRID_H = 5;
const STRIDE_X = 24;
const STRIDE_Y = 18;
const MAP_W = GRID_W * STRIDE_X + 4;
const MAP_H = GRID_H * STRIDE_Y + 4;

const ALL_BIOMES: BiomeId[] = [
  'goblin_ruins',
  'frost_castle',
  'skeleton_crypt',
  'alchemy_factory',
  'volcano_palace',
  'astral_void'
];

const ALL_CURIOSITIES: CuriosityKind[] = [
  'sticker_workshop',
  'reforge_forge',
  'recycle_bot',
  'ancient_statue',
  'slot_machine',
  'demon_altar',
  'wishing_well',
  'mimic_chest',
  'fate_wheel',
  'tavern_merc',
  'quack_clinic',
  'arena_trial',
  'talent_enchanter',
  'weapon_collector',
  'bonus_dimension'
];

const STATUES: StatueId[] = ['knight', 'paladin', 'berserker', 'assassin', 'priest', 'fortune_cat'];
const MERCS: MercKind[] = ['chef', 'archer', 'bomber', 'mage'];

let idSeq = 1;
const nid = (p: string) => `${p}_${idSeq++}`;

export interface GeneratedFloor {
  map: FloorMap;
  props: PropState[];
  pickups: PickupState[];
  interactables: InteractableState[];
  initialEnemies: EnemyState[];
}

/**
 * Zero-Dead-End Forward Chain + Short Side Rooms WITH Direct Portals!
 * Layout on 6x5 grid:
 *   Main spine (row y=2): (0,2) Start -> (1,2) Combat/Explore -> (2,2) Guaranteed Shop/Campfire -> (3,2) Combat/Explore -> (4,2) Portal Hub or Boss (every 3 floors!)
 *   Short 1-step side alcoves (zero deep dead-ends! Every side alcove ALSO has a direct forward portal to a new map!):
 *     - Top side off (1,2) -> (1,1): Treasure Chest / Rune Puzzle + Portal!
 *     - Bottom side off (2,2) -> (2,3): Curiosity Room + Portal!
 *     - Top side off (3,2) -> (3,1): Clearly-marked Field Bounty Boss (optional, never jumpscares!) + Portal!
 *     - Optional Cracked Secret Wall off (3,2) -> (3,3): Secret Vault / Dev Room / Goose Office!
 */
export function generateFloor(
  floor: number,
  biome: BiomeId,
  rng: SeededRNG,
  options: {
    zoneFlavor?: ZoneFlavor;
    extraCuriosities?: number;
    dailyFactors?: DailyFactorId[];
    merchantAngered?: boolean;
    discountMult?: number;
  } = {}
): GeneratedFloor {
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const map: FloorMap = {
    width: MAP_W,
    height: MAP_H,
    tiles,
    rooms: [],
    startRoomId: ''
  };

  const flavor = options.zoneFlavor ?? 'normal';
  // Big World Boss every 3 floors (3, 6, 9, 12, 15...) OR when entering a Boss Lair portal!
  const isBossFloor = floor % 3 === 0 || flavor === 'boss_lair';
  const factors = options.dailyFactors ?? [];

  type Spec = { gx: number; gy: number; kind: RoomKind; parent?: string; isSecret?: boolean };
  const specs: Spec[] = [
    { gx: 0, gy: 2, kind: 'start' },
    { gx: 1, gy: 2, kind: flavor === 'market' ? 'curiosity' : flavor === 'treasure' ? 'chest' : 'combat', parent: '0,2' },
    { gx: 2, gy: 2, kind: 'shop', parent: '1,2' },
    { gx: 3, gy: 2, kind: flavor === 'treasure' ? 'chest' : 'combat', parent: '2,2' },
    { gx: 4, gy: 2, kind: isBossFloor ? 'boss' : 'portal', parent: '3,2' },
    // Short 1-step side rooms (NO backtracking needed — each has a direct portal to a new map!)
    { gx: 1, gy: 1, kind: 'chest', parent: '1,2' },
    { gx: 2, gy: 3, kind: 'curiosity', parent: '2,2' },
    { gx: 3, gy: 1, kind: isBossFloor ? 'curiosity' : 'bounty', parent: '3,2' }
  ];

  // 60% Cracked Secret Wall off (3,2) -> (3,3)
  if (rng.chance(0.6)) {
    specs.push({ gx: 3, gy: 3, kind: 'secret', parent: '3,2', isSecret: true });
  }

  const roomByKey = new Map<string, RoomData>();
  const key = (x: number, y: number) => `${x},${y}`;
  const curiosityPool = rng.shuffle(ALL_CURIOSITIES);
  if (floor === 1 || factors.includes('sticker_sale')) {
    const idx = curiosityPool.indexOf('sticker_workshop');
    if (idx > 0) {
      curiosityPool.splice(idx, 1);
      curiosityPool.unshift('sticker_workshop');
    }
  }

  for (const sp of specs) {
    const isBoss = sp.kind === 'boss';
    const w = isBoss ? 21 : sp.kind === 'secret' ? 13 : 17;
    const h = isBoss ? 15 : sp.kind === 'secret' ? 11 : 13;
    const centerTx = sp.gx * STRIDE_X + 12;
    const centerTy = sp.gy * STRIDE_Y + 9;
    const rx = centerTx - Math.floor(w / 2);
    const ry = centerTy - Math.floor(h / 2);

    const room: RoomData = {
      id: `room_${sp.gx}_${sp.gy}`,
      gx: sp.gx,
      gy: sp.gy,
      kind: sp.kind,
      curiosityKind: sp.kind === 'curiosity' ? curiosityPool.shift() ?? 'slot_machine' : undefined,
      x: rx,
      y: ry,
      w,
      h,
      cx: (rx + w / 2) * TILE_SIZE,
      cy: (ry + h / 2) * TILE_SIZE,
      discovered: sp.kind === 'start',
      cleared: sp.kind !== 'combat' && sp.kind !== 'boss',
      locked: false,
      wave: 0,
      maxWaves: sp.kind === 'combat' ? (floor >= 6 ? 2 : 1) : sp.kind === 'boss' ? 1 : 0,
      doorTiles: []
    };

    if (sp.kind === 'secret') {
      const secretOptions: Array<RoomData['secretContent']> =
        floor >= 3
          ? ['sticker_vault', 'dev_room', 'gold_slimes', 'goose_door']
          : ['sticker_vault', 'dev_room', 'gold_slimes'];
      room.secretContent = rng.pick(secretOptions);
      room.secretRevealed = false;
    }

    for (let ty = ry; ty < ry + h; ty++) {
      for (let tx = rx; tx < rx + w; tx++) {
        const border = tx === rx || tx === rx + w - 1 || ty === ry || ty === ry + h - 1;
        setTileAt(map, tx, ty, border ? TileType.WALL : TileType.FLOOR);
      }
    }

    // Biome floor accents
    if (sp.kind === 'combat' || sp.kind === 'boss' || sp.kind === 'bounty') {
      if (biome === 'frost_castle') {
        for (let ty = ry + 3; ty < ry + h - 3; ty++) {
          for (let tx = rx + 3; tx < rx + w - 3; tx++) {
            if (rng.chance(0.22)) setTileAt(map, tx, ty, TileType.ICE);
          }
        }
      } else if (biome === 'volcano_palace') {
        for (let ty = ry + 2; ty < ry + h - 2; ty++) {
          for (let tx = rx + 2; tx < rx + w - 2; tx++) {
            const nearEdge = tx === rx + 2 || tx === rx + w - 3 || ty === ry + 2 || ty === ry + h - 3;
            if (nearEdge && rng.chance(0.2)) setTileAt(map, tx, ty, TileType.LAVA);
          }
        }
      } else if (biome === 'alchemy_factory') {
        const midY = ry + Math.floor(h / 2);
        for (let tx = rx + 4; tx < rx + w - 4; tx++) {
          setTileAt(map, tx, midY, TileType.CONVEYOR_R);
        }
      }
    }

    map.rooms.push(room);
    roomByKey.set(key(sp.gx, sp.gy), room);
    if (sp.kind === 'start') map.startRoomId = room.id;
    if (sp.kind === 'boss') map.bossRoomId = room.id;
  }

  // Carve wide smooth corridors
  const carveCorridor = (a: RoomData, b: RoomData, isSecret: boolean) => {
    const aCx = a.x + Math.floor(a.w / 2);
    const aCy = a.y + Math.floor(a.h / 2);
    const secretTiles: Vec2[] = [];

    if (a.gx !== b.gx) {
      const left = a.gx < b.gx ? a : b;
      const right = a.gx < b.gx ? b : a;
      const xStart = left.x + left.w - 1;
      const xEnd = right.x;
      const yMid = aCy;
      for (let tx = xStart; tx <= xEnd; tx++) {
        setTileAt(map, tx, yMid - 2, TileType.WALL);
        setTileAt(map, tx, yMid + 2, TileType.WALL);
        for (let dy = -1; dy <= 1; dy++) {
          const isDoorLeft = tx === xStart;
          const isDoorRight = tx === xEnd;
          if (isSecret && (isDoorLeft || isDoorRight)) {
            setTileAt(map, tx, yMid + dy, TileType.CRACKED_WALL);
            secretTiles.push({ x: tx, y: yMid + dy });
          } else if (isDoorLeft || isDoorRight) {
            setTileAt(map, tx, yMid + dy, TileType.DOOR_OPEN);
            if (isDoorLeft) left.doorTiles.push({ x: tx, y: yMid + dy });
            if (isDoorRight) right.doorTiles.push({ x: tx, y: yMid + dy });
          } else {
            setTileAt(map, tx, yMid + dy, TileType.FLOOR);
          }
        }
      }
    } else {
      const top = a.gy < b.gy ? a : b;
      const bot = a.gy < b.gy ? b : a;
      const yStart = top.y + top.h - 1;
      const yEnd = bot.y;
      const xMid = aCx;
      for (let ty = yStart; ty <= yEnd; ty++) {
        setTileAt(map, xMid - 2, ty, TileType.WALL);
        setTileAt(map, xMid + 2, ty, TileType.WALL);
        for (let dx = -1; dx <= 1; dx++) {
          const isDoorTop = ty === yStart;
          const isDoorBot = ty === yEnd;
          if (isSecret && (isDoorTop || isDoorBot)) {
            setTileAt(map, xMid + dx, ty, TileType.CRACKED_WALL);
            secretTiles.push({ x: xMid + dx, y: ty });
          } else if (isDoorTop || isDoorBot) {
            setTileAt(map, xMid + dx, ty, TileType.DOOR_OPEN);
            if (isDoorTop) top.doorTiles.push({ x: xMid + dx, y: ty });
            if (isDoorBot) bot.doorTiles.push({ x: xMid + dx, y: ty });
          } else {
            setTileAt(map, xMid + dx, ty, TileType.FLOOR);
          }
        }
      }
    }
    if (isSecret) {
      const sRoom = a.kind === 'secret' ? a : b;
      sRoom.secretWallTiles = secretTiles;
    }
  };

  for (const sp of specs) {
    if (!sp.parent) continue;
    const parentRoom = roomByKey.get(sp.parent);
    const childRoom = roomByKey.get(key(sp.gx, sp.gy));
    if (parentRoom && childRoom) carveCorridor(parentRoom, childRoom, Boolean(sp.isSecret));
  }

  const props: PropState[] = [];
  const pickups: PickupState[] = [];
  const interactables: InteractableState[] = [];
  const initialEnemies: EnemyState[] = [];
  const priceMult = (options.discountMult ?? 1) * (options.merchantAngered ? 1.35 : 1);
  const wPool = factors.includes('melee_only') ? MELEE_QUIRK_WEAPONS : NORMAL_DROP_WEAPONS;

  const makePortalDest = (preferFlavor?: ZoneFlavor): PortalDestination => {
    const otherBiomes = ALL_BIOMES.filter((b) => b !== biome);
    const nextBiome = rng.pick(otherBiomes);
    const nextFloor = floor + 1;
    if (nextFloor % 3 === 0 || preferFlavor === 'boss_lair') {
      return {
        biome: nextBiome,
        flavor: 'boss_lair',
        label: `👑 ${BIOMES[nextBiome].name}·Boss巢穴`
      };
    }
    const fl = preferFlavor ?? rng.pick(['normal', 'treasure', 'market'] as const);
    const tag =
      fl === 'treasure'
        ? '💎 宝藏秘境'
        : fl === 'market'
          ? '🛒 神秘集市'
          : '🗺️ 未知探索区';
    return {
      biome: nextBiome,
      flavor: fl,
      label: `${BIOMES[nextBiome].name} · ${tag}`
    };
  };

  for (const room of map.rooms) {
    if (room.kind === 'start') {
      // Floor 1 welcome gift + cozy guide!
      if (floor === 1) {
        pickups.push({
          id: nid('pk'),
          kind: 'weapon',
          x: room.cx - 42,
          y: room.cy - 22,
          vx: 0,
          vy: 0,
          value: 0,
          weapon: createWeaponInstance(rng.pick(['salted_fish', 'pixel_shotgun', 'rubber_chicken', 'bug_zapper', 'takeout_box'])),
          roomId: room.id
        });
        pickups.push({
          id: nid('pk'),
          kind: 'sticker',
          x: room.cx + 42,
          y: room.cy - 22,
          vx: 0,
          vy: 0,
          value: 0,
          stickerId: rng.pick(['homing', 'triple_split', 'laserize', 'fire_pepper', 'egg_chicken', 'bounce']),
          roomId: room.id
        });
      }
      // Glowing ore vein right in start room for fun mining!
      props.push({
        id: nid('ore'),
        roomId: room.id,
        kind: 'ore_vein',
        x: room.cx - 64,
        y: room.cy + 34,
        radius: 9,
        hp: 16,
        maxHp: 16,
        hitFlashTimer: 0
      });
    } else if (room.kind === 'shop') {
      // GUARANTEED Traveler's Shop + Cozy Campfire on EVERY floor! Coins are ALWAYS fun to spend!
      const p = (base: number) => Math.max(8, Math.round(base * priceMult));
      const w1 = createWeaponInstance(rng.pick(wPool));
      const s1 = rng.pick(STICKER_IDS);
      const s2 = rng.pick(STICKER_IDS.filter((id) => id !== s1));
      const items: ShopItem[] = [
        { id: nid('sh'), kind: 'heal', price: p(18), sold: false, label: '❤️ 旅途回血大药水 (回满HP)' },
        { id: nid('sh'), kind: 'weapon', weapon: w1, price: p(45), sold: false, label: `⚔️ 出售武器` },
        { id: nid('sh'), kind: 'sticker', stickerId: s1, price: p(35), sold: false, label: '🏷️ 精选贴纸 A' },
        { id: nid('sh'), kind: 'sticker', stickerId: s2, price: p(35), sold: false, label: '🏷️ 精选贴纸 B' },
        { id: nid('sh'), kind: 'upgrade_dmg', price: p(40), sold: false, label: '🔨 武器强化 (+3基础伤害)' },
        { id: nid('sh'), kind: 'add_slot', price: p(65), sold: false, label: '🔧 贴纸扩槽 (+1贴纸槽)' },
        { id: nid('sh'), kind: 'shield_boost', price: p(55), sold: false, label: '🛡️ 永久护盾上限 +1' }
      ];
      interactables.push(
        {
          id: nid('int'),
          roomId: room.id,
          kind: 'merchant_npc',
          x: room.cx - 28,
          y: room.cy - 10,
          radius: 16,
          used: false,
          usesCount: 0,
          cost: 0,
          hp: 9999, // Safe friendly traveler shop (no accidental aggro!)
          speech: '旅途集市摊主：金币随便花！武器贴纸强化全都有！',
          speechTimer: 999,
          shopItems: items
        },
        {
          id: nid('int'),
          roomId: room.id,
          kind: 'campfire',
          x: room.cx + 38,
          y: room.cy - 6,
          radius: 15,
          used: false,
          usesCount: 0,
          cost: 0,
          speech: '暖心营火：免费烤火回血回蓝+攻速祝福！',
          speechTimer: 999
        }
      );
    } else if (room.kind === 'combat' || room.kind === 'boss') {
      const ox = room.kind === 'boss' ? 76 : 56;
      const oy = room.kind === 'boss' ? 50 : 38;
      for (const [dx, dy] of [[-ox, -oy], [ox, -oy], [-ox, oy], [ox, oy]]) {
        props.push({
          id: nid('prop'),
          roomId: room.id,
          kind: biome === 'skeleton_crypt' && rng.chance(0.45) ? 'tombstone' : 'pillar',
          x: room.cx + dx,
          y: room.cy + dy,
          radius: 9,
          hp: biome === 'skeleton_crypt' ? 28 : 99999,
          maxHp: biome === 'skeleton_crypt' ? 28 : 99999,
          hitFlashTimer: 0
        });
      }
      const barrelKind =
        biome === 'frost_castle'
          ? 'barrel_ice'
          : biome === 'skeleton_crypt' || biome === 'alchemy_factory'
            ? 'barrel_poison'
            : 'barrel_red';
      const propCount = room.kind === 'boss' ? 2 : rng.int(2, 4);
      for (let i = 0; i < propCount; i++) {
        const px = room.cx + rng.float(-ox + 18, ox - 18);
        const py = room.cy + rng.float(-oy + 12, oy - 12);
        if (Math.hypot(px - room.cx, py - room.cy) < 26) continue;
        const kind = i === 0 ? 'ore_vein' : rng.chance(0.45) ? barrelKind : 'crate';
        props.push({
          id: nid('prop'),
          roomId: room.id,
          kind,
          x: px,
          y: py,
          radius: 8,
          hp: kind === 'ore_vein' ? 16 : 11,
          maxHp: kind === 'ore_vein' ? 16 : 11,
          hitFlashTimer: 0
        });
      }
    } else if (room.kind === 'chest') {
      // Safe Treasure + Rune Exploration Puzzle + Direct Forward Portal (NO dead end!)
      interactables.push(
        {
          id: nid('int'),
          roomId: room.id,
          kind: 'chest',
          x: room.cx - 26,
          y: room.cy,
          radius: 15,
          used: false,
          usesCount: 0,
          cost: 0
        },
        {
          id: nid('int'),
          roomId: room.id,
          kind: 'rune_plate',
          x: room.cx - 70,
          y: room.cy - 34,
          radius: 13,
          used: false,
          usesCount: 0,
          cost: 0
        },
        {
          id: nid('int'),
          roomId: room.id,
          kind: 'rune_plate',
          x: room.cx + 70,
          y: room.cy + 34,
          radius: 13,
          used: false,
          usesCount: 0,
          cost: 0
        },
        {
          id: nid('int'),
          roomId: room.id,
          kind: 'portal',
          x: room.cx + 42,
          y: room.cy - 18,
          radius: 18,
          used: false,
          usesCount: 0,
          cost: 0,
          portalDest: makePortalDest('treasure')
        }
      );
    } else if (room.kind === 'bounty') {
      // Clearly-marked OPTIONAL Field Bounty Mini-Boss + Direct Forward Boss/Explore Portal!
      const bountyPool = ['angry_frog', 'mimic_chest_boss', 'armed_merchant', 'boss_goose_king'] as const;
      const bKind = floor >= 4 && rng.chance(0.28) ? 'boss_goose_king' : rng.pick(bountyPool.slice(0, 3));
      const bounty = createEnemy(bKind, room.id, room.cx - 18, room.cy, floor, false, 0.85);
      bounty.isBounty = true;
      bounty.bountyAwake = false; // Neutral until player approaches closely or attacks!
      bounty.bossSpeech = '【悬赏头领】靠近或开火即开战，打赢爆大量金币+神兵！';
      bounty.bossSpeechTimer = 999;
      initialEnemies.push(bounty);

      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'portal',
        x: room.cx + 68,
        y: room.cy - 24,
        radius: 18,
        used: false,
        usesCount: 0,
        cost: 0,
        portalDest: makePortalDest('boss_lair')
      });
    } else if (room.kind === 'portal') {
      // Multi-exit Portal Hub! Choose between 3 distinct new destinations!
      const dest1 = makePortalDest('normal');
      const dest2 = makePortalDest('treasure');
      const dest3 = makePortalDest('boss_lair');
      interactables.push(
        { id: nid('int'), roomId: room.id, kind: 'portal', x: room.cx - 58, y: room.cy - 10, radius: 18, used: false, usesCount: 0, cost: 0, portalDest: dest1 },
        { id: nid('int'), roomId: room.id, kind: 'portal', x: room.cx, y: room.cy - 24, radius: 18, used: false, usesCount: 0, cost: 0, portalDest: dest2 },
        { id: nid('int'), roomId: room.id, kind: 'portal', x: room.cx + 58, y: room.cy - 10, radius: 18, used: false, usesCount: 0, cost: 0, portalDest: dest3 }
      );
    } else if (room.kind === 'secret') {
      populateSecretRoom(room, rng, props, pickups, interactables);
      // Even secret room has a quick exit portal!
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'portal',
        x: room.cx + 48,
        y: room.cy - 26,
        radius: 17,
        used: false,
        usesCount: 0,
        cost: 0,
        portalDest: makePortalDest('treasure')
      });
    } else if (room.kind === 'curiosity') {
      populateCuriosityRoom(room, rng, wPool, priceMult, interactables);
      // Direct portal right in curiosity side room too — zero backtracking!
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'portal',
        x: room.cx + 66,
        y: room.cy + 24,
        radius: 17,
        used: false,
        usesCount: 0,
        cost: 0,
        portalDest: makePortalDest('market')
      });
    }
  }

  return { map, props, pickups, interactables, initialEnemies };
}

function populateSecretRoom(
  room: RoomData,
  rng: SeededRNG,
  props: PropState[],
  pickups: PickupState[],
  interactables: InteractableState[]
) {
  if (room.secretContent === 'sticker_vault') {
    const s1 = rng.pick(STICKER_IDS);
    const s2 = rng.pick(STICKER_IDS.filter((s) => s !== s1));
    pickups.push(
      { id: nid('pk'), kind: 'sticker', x: room.cx - 24, y: room.cy, vx: 0, vy: 0, value: 0, stickerId: s1, roomId: room.id },
      { id: nid('pk'), kind: 'sticker', x: room.cx + 12, y: room.cy, vx: 0, vy: 0, value: 0, stickerId: s2, roomId: room.id }
    );
  } else if (room.secretContent === 'dev_room') {
    props.push({
      id: nid('prop'),
      roomId: room.id,
      kind: 'coffee_machine',
      x: room.cx - 10,
      y: room.cy,
      radius: 10,
      hp: 18,
      maxHp: 18,
      hitFlashTimer: 0
    });
    pickups.push({
      id: nid('pk'),
      kind: 'sticker',
      x: room.cx + 22,
      y: room.cy + 12,
      vx: 0,
      vy: 0,
      value: 0,
      stickerId: 'chaos_random',
      roomId: room.id
    });
  } else if (room.secretContent === 'goose_door') {
    interactables.push({
      id: nid('int'),
      roomId: room.id,
      kind: 'secret_goose_door',
      x: room.cx - 10,
      y: room.cy,
      radius: 16,
      used: false,
      usesCount: 0,
      cost: 0,
      speech: '【明牌挑战 · 物业办公室】主动点击才召唤大鹅王！',
      speechTimer: 999
    });
  } else {
    for (let i = 0; i < 8; i++) {
      pickups.push({
        id: nid('pk'),
        kind: 'coin',
        x: room.cx + rng.float(-36, 20),
        y: room.cy + rng.float(-24, 24),
        vx: 0,
        vy: 0,
        value: 12,
        roomId: room.id
      });
    }
  }
}

function populateCuriosityRoom(
  room: RoomData,
  rng: SeededRNG,
  _wPool: ReturnType<typeof Array.prototype.slice>,
  priceMult: number,
  interactables: InteractableState[]
) {
  const c = room.curiosityKind ?? 'slot_machine';
  const p = (base: number) => Math.max(5, Math.round(base * priceMult));

  switch (c) {
    case 'sticker_workshop': {
      const picks = rng.shuffle(STICKER_IDS).slice(0, 3);
      const items: ShopItem[] = [
        ...picks.map((sid) => ({
          id: nid('shop'),
          kind: 'sticker' as const,
          stickerId: sid,
          price: p(38),
          sold: false,
          label: `贴纸`
        })),
        { id: nid('shop'), kind: 'add_slot', price: p(70), sold: false, label: '强行扩槽打孔 (+1贴纸槽)' }
      ];
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'workshop_npc',
        x: room.cx - 12,
        y: room.cy - 6,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '贴纸工坊：买贴纸直接进背包，想贴哪把贴哪把！',
        speechTimer: 999,
        shopItems: items
      });
      break;
    }
    case 'slot_machine':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'slot_machine',
        x: room.cx - 12,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 15,
        speech: '安全老虎机(15金)：不吐炸弹，纯粹拼手气抽神兵贴纸！',
        speechTimer: 999
      });
      break;
    case 'demon_altar': {
      const s1 = rng.pick(['shadow_clone', 'nuclear_nuke', 'duck_curse', 'vampire_mosquito', 'triple_split', 'laserize'] as const);
      const w1 = createWeaponInstance(rng.pick(['dwarf_sniper', 'twin_lightsaber', 'blackhole_vacuum', 'meteor_tome', 'solar_cannon', 'one_punch_glove'] as const));
      const items: ShopItem[] = [
        { id: nid('shop'), kind: 'sticker', stickerId: s1, price: 0, hpCost: 1, sold: false, label: '恶魔传说贴纸 (-1血上限)' },
        { id: nid('shop'), kind: 'weapon', weapon: w1, price: 0, hpCost: 1, sold: false, label: '传说神兵 (-1血上限)' },
        { id: nid('shop'), kind: 'stat_boost', price: 0, hpCost: 1, sold: false, label: '恶魔契约 (+2护盾上限)' }
      ];
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'demon_npc',
        x: room.cx - 12,
        y: room.cy - 6,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '礼貌小恶魔：自愿交易，用1血上限换神装~',
        speechTimer: 999,
        shopItems: items
      });
      break;
    }
    case 'wishing_well':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'wishing_well',
        x: room.cx - 12,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 10,
        speech: '安心许愿池(10金)：捞贴纸/种子/黄金平底锅，绝不跳蛙！',
        speechTimer: 999
      });
      break;
    case 'reforge_forge': {
      const items: ShopItem[] = [
        { id: nid('shop'), kind: 'upgrade_dmg', price: p(35), sold: false, label: '铁匠重锤强化 (主武器 +3 伤害)' },
        { id: nid('shop'), kind: 'reforge', price: p(22), sold: false, label: '盲盒重铸 (主武器换新，保留贴纸!)' }
      ];
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'forge_npc',
        x: room.cx - 12,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '猫头鹰铁匠：咣咣两锤强化重铸！',
        speechTimer: 999,
        shopItems: items
      });
      break;
    }
    case 'recycle_bot':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'recycle_bot',
        x: room.cx - 12,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '高价回收机器人：把副武器喂给我得双倍金币+贴纸！',
        speechTimer: 999
      });
      break;
    case 'ancient_statue':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'statue',
        x: room.cx - 12,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: p(30),
        statueId: rng.pick(STATUES),
        speech: '远古雕像(30金)：供奉获得技能联动祝福！',
        speechTimer: 999
      });
      break;
    case 'mimic_chest':
      interactables.push(
        { id: nid('int'), roomId: room.id, kind: 'mimic_red', x: room.cx - 42, y: room.cy, radius: 14, used: false, usesCount: 0, cost: 0, speech: '福利红蓝双选箱：二选一必得丰厚宝藏（无跳脸怪！）', speechTimer: 999 },
        { id: nid('int'), roomId: room.id, kind: 'mimic_blue', x: room.cx + 8, y: room.cy, radius: 14, used: false, usesCount: 0, cost: 0 }
      );
      break;
    case 'fate_wheel':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'fate_wheel',
        x: room.cx - 12,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '命运大转盘：免费抽趣味正面规则！',
        speechTimer: 999
      });
      break;
    case 'tavern_merc':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'tavern_npc',
        x: room.cx - 12,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: p(40),
        mercKind: rng.pick(MERCS),
        speech: '酒馆(40金)：雇佣沙雕佣兵陪你闯关！',
        speechTimer: 999
      });
      break;
    case 'quack_clinic':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'clinic_npc',
        x: room.cx - 12,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: p(20),
        speech: '怪医诊所(20金)：回满血 + 永久属性强化！',
        speechTimer: 999
      });
      break;
    case 'arena_trial':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'arena_flag',
        x: room.cx - 12,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '【明牌试炼】主动拔旗打2波精英赢传说宝箱！',
        speechTimer: 999
      });
      break;
    case 'talent_enchanter':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'enchanter_npc',
        x: room.cx - 12,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: p(35),
        speech: '魔法附魔师(35金)：直接多抽 1 项 3 选 1 天赋！',
        speechTimer: 999
      });
      break;
    case 'weapon_collector':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'collector_npc',
        x: room.cx - 12,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '流浪收藏家：用主武器免费换一把高品神兵！',
        speechTimer: 999
      });
      break;
    case 'bonus_dimension':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'bonus_portal',
        x: room.cx - 12,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '赏金裂隙：激活刷满屋不会还手的黄金史莱姆赚大钱！',
        speechTimer: 999
      });
      break;
  }
}

export function getBiomeTitle(biome: BiomeId): string {
  return BIOMES[biome].name;
}
