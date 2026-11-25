import { BIOMES } from '../../content/biomes';
import { STICKER_IDS } from '../../content/stickers';
import { createWeaponInstance, MELEE_QUIRK_WEAPONS, NORMAL_DROP_WEAPONS } from '../../content/weapons';
import { setTileAt } from '../collision';
import { SeededRNG } from '../rng';
import {
  BiomeId,
  CuriosityKind,
  DailyFactorId,
  FloorMap,
  InteractableState,
  MercKind,
  PickupState,
  PropState,
  RoomData,
  RoomKind,
  ShopItem,
  StatueId,
  TILE_SIZE,
  TileType,
  Vec2
} from '../types';

const GRID_SIZE = 5;
const STRIDE_X = 24;
const STRIDE_Y = 18;
const MAP_W = GRID_SIZE * STRIDE_X + 4;
const MAP_H = GRID_SIZE * STRIDE_Y + 4;

const ALL_CURIOSITIES: CuriosityKind[] = [
  'sticker_workshop',
  'reforge_forge',
  'recycle_bot',
  'ancient_statue',
  'slot_machine',
  'demon_altar',
  'wishing_well',
  'mimic_chest',
  'black_merchant',
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
}

export function generateFloor(
  floor: number,
  biome: BiomeId,
  rng: SeededRNG,
  options: {
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

  const stageIndex = ((floor - 1) % 5) + 1;
  const worldIndex = Math.floor((floor - 1) / 5) + 1;
  const isBossFloor = stageIndex === 5;
  const factors = options.dailyFactors ?? [];
  const extraCur = (options.extraCuriosities ?? 0) + (factors.includes('curiosity_boom') ? 1 : 0);
  const targetRoomCount = Math.min(11, 6 + Math.min(2, worldIndex - 1) + (stageIndex >= 3 ? 1 : 0) + extraCur);

  // Build connected room grid via random walk from center (2,2)
  const occupied = new Map<string, { gx: number; gy: number; dist: number; parent?: string }>();
  const key = (x: number, y: number) => `${x},${y}`;
  occupied.set(key(2, 2), { gx: 2, gy: 2, dist: 0 });
  const edges: Array<[string, string]> = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  let safety = 0;
  while (occupied.size < targetRoomCount && safety < 200) {
    safety++;
    const list = Array.from(occupied.values());
    const base = rng.pick(list);
    const [dx, dy] = rng.pick(dirs);
    const nx = base.gx + dx;
    const ny = base.gy + dy;
    if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
    const nk = key(nx, ny);
    if (occupied.has(nk)) continue;
    occupied.set(nk, { gx: nx, gy: ny, dist: base.dist + 1, parent: key(base.gx, base.gy) });
    edges.push([key(base.gx, base.gy), nk]);
  }

  // Assign room kinds
  const cells = Array.from(occupied.entries());
  cells.sort((a, b) => b[1].dist - a[1].dist);
  const farthestKey = cells[0][0];
  const startKey = key(2, 2);

  const kindMap = new Map<string, RoomKind>();
  kindMap.set(startKey, 'start');
  kindMap.set(farthestKey, isBossFloor ? 'boss' : 'portal');

  const remainingKeys = cells
    .map(([k]) => k)
    .filter((k) => k !== startKey && k !== farthestKey);
  const shuffledRem = rng.shuffle(remainingKeys);

  // 1 fixed chest room
  if (shuffledRem.length > 0) {
    kindMap.set(shuffledRem.shift()!, 'chest');
  }
  // 1~2+ curiosity rooms (guaranteed at least 1, usually 2!)
  const curTarget = Math.min(shuffledRem.length - 1, Math.max(1, 2 + extraCur));
  for (let i = 0; i < curTarget && shuffledRem.length > 1; i++) {
    kindMap.set(shuffledRem.shift()!, 'curiosity');
  }
  // Rest are combat rooms
  for (const k of shuffledRem) {
    kindMap.set(k, 'combat');
  }

  // Optional 45% Secret Cracked Wall Room adjacent to a non-boss room!
  let secretPair: { parentKey: string; secretKey: string; gx: number; gy: number } | null = null;
  if (rng.chance(0.55)) {
    const candidates = Array.from(occupied.values()).filter(
      (c) => kindMap.get(key(c.gx, c.gy)) !== 'boss' && kindMap.get(key(c.gx, c.gy)) !== 'portal'
    );
    for (const c of rng.shuffle(candidates)) {
      for (const [dx, dy] of rng.shuffle(dirs)) {
        const sx = c.gx + dx;
        const sy = c.gy + dy;
        if (sx < 0 || sy < 0 || sx >= GRID_SIZE || sy >= GRID_SIZE) continue;
        const sk = key(sx, sy);
        if (!occupied.has(sk)) {
          secretPair = { parentKey: key(c.gx, c.gy), secretKey: sk, gx: sx, gy: sy };
          occupied.set(sk, { gx: sx, gy: sy, dist: c.dist + 1 });
          kindMap.set(sk, 'secret');
          break;
        }
      }
      if (secretPair) break;
    }
  }

  // Carve rooms
  const roomByKey = new Map<string, RoomData>();
  const curiosityPool = rng.shuffle(ALL_CURIOSITIES);
  // Boost sticker workshop on floor 1-1 or sticker_sale factor
  if (floor === 1 || factors.includes('sticker_sale')) {
    const idx = curiosityPool.indexOf('sticker_workshop');
    if (idx > 0) {
      curiosityPool.splice(idx, 1);
      curiosityPool.unshift('sticker_workshop');
    }
  }

  for (const [k, cell] of occupied.entries()) {
    const kind = kindMap.get(k) ?? 'combat';
    const isBoss = kind === 'boss';
    const w = isBoss ? 21 : kind === 'secret' ? 13 : 17;
    const h = isBoss ? 15 : kind === 'secret' ? 11 : 13;
    const centerTx = cell.gx * STRIDE_X + 12;
    const centerTy = cell.gy * STRIDE_Y + 9;
    const rx = centerTx - Math.floor(w / 2);
    const ry = centerTy - Math.floor(h / 2);

    const room: RoomData = {
      id: `room_${cell.gx}_${cell.gy}`,
      gx: cell.gx,
      gy: cell.gy,
      kind,
      curiosityKind: kind === 'curiosity' ? curiosityPool.shift() ?? 'slot_machine' : undefined,
      x: rx,
      y: ry,
      w,
      h,
      cx: (rx + w / 2) * TILE_SIZE,
      cy: (ry + h / 2) * TILE_SIZE,
      discovered: kind === 'start',
      cleared: kind !== 'combat' && kind !== 'boss',
      locked: false,
      wave: 0,
      maxWaves: kind === 'combat' ? (worldIndex === 1 ? 2 : 3) : kind === 'boss' ? 1 : 0,
      doorTiles: []
    };

    if (kind === 'secret') {
      const secretOptions: Array<RoomData['secretContent']> =
        worldIndex >= 2
          ? ['sticker_vault', 'dev_room', 'gold_slimes', 'goose_door']
          : ['sticker_vault', 'dev_room', 'gold_slimes'];
      room.secretContent = rng.pick(secretOptions);
      room.secretRevealed = false;
    }

    // Fill walls and floor
    for (let ty = ry; ty < ry + h; ty++) {
      for (let tx = rx; tx < rx + w; tx++) {
        const border = tx === rx || tx === rx + w - 1 || ty === ry || ty === ry + h - 1;
        setTileAt(map, tx, ty, border ? TileType.WALL : TileType.FLOOR);
      }
    }

    // Biome floor tile accents inside combat/boss rooms
    if (kind === 'combat' || kind === 'boss') {
      if (biome === 'frost_castle') {
        for (let ty = ry + 3; ty < ry + h - 3; ty++) {
          for (let tx = rx + 3; tx < rx + w - 3; tx++) {
            if (rng.chance(0.28)) setTileAt(map, tx, ty, TileType.ICE);
          }
        }
      } else if (biome === 'volcano_palace') {
        for (let ty = ry + 2; ty < ry + h - 2; ty++) {
          for (let tx = rx + 2; tx < rx + w - 2; tx++) {
            const nearEdge = tx === rx + 2 || tx === rx + w - 3 || ty === ry + 2 || ty === ry + h - 3;
            if (nearEdge && rng.chance(0.24)) setTileAt(map, tx, ty, TileType.LAVA);
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
    roomByKey.set(k, room);
    if (kind === 'start') map.startRoomId = room.id;
    if (kind === 'boss') map.bossRoomId = room.id;
  }

  // Carve corridors between connected rooms
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

  for (const [ak, bk] of edges) {
    carveCorridor(roomByKey.get(ak)!, roomByKey.get(bk)!, false);
  }
  if (secretPair) {
    carveCorridor(roomByKey.get(secretPair.parentKey)!, roomByKey.get(secretPair.secretKey)!, true);
  }

  // Populate props, pickups, and interactables per room
  const props: PropState[] = [];
  const pickups: PickupState[] = [];
  const interactables: InteractableState[] = [];
  const priceMult = (options.discountMult ?? 1) * (options.merchantAngered ? 1.5 : 1);
  const wPool = factors.includes('melee_only') ? MELEE_QUIRK_WEAPONS : NORMAL_DROP_WEAPONS;

  for (const room of map.rooms) {
    if (room.kind === 'start') {
      // Floor 1-1 welcome gift! Instant quirk weapon + starter sticker right in start room!
      if (floor === 1) {
        pickups.push({
          id: nid('pk'),
          kind: 'weapon',
          x: room.cx - 42,
          y: room.cy - 24,
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
          y: room.cy - 24,
          vx: 0,
          vy: 0,
          value: 0,
          stickerId: rng.pick(['homing', 'triple_split', 'laserize', 'fire_pepper', 'egg_chicken', 'bounce']),
          roomId: room.id
        });
      }
    } else if (room.kind === 'combat' || room.kind === 'boss') {
      // Symmetric cover pillars + destructible crates & elemental barrels
      const ox = room.kind === 'boss' ? 76 : 56;
      const oy = room.kind === 'boss' ? 50 : 38;
      const pillarOffsets = [
        [-ox, -oy],
        [ox, -oy],
        [-ox, oy],
        [ox, oy]
      ];
      for (const [dx, dy] of pillarOffsets) {
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
      // 2~4 crates & barrels
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
        const isBarrel = i === 0 || rng.chance(0.42);
        props.push({
          id: nid('prop'),
          roomId: room.id,
          kind: isBarrel ? barrelKind : 'crate',
          x: px,
          y: py,
          radius: 8,
          hp: isBarrel ? 10 : 12,
          maxHp: isBarrel ? 10 : 12,
          hitFlashTimer: 0
        });
      }
    } else if (room.kind === 'chest') {
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'chest',
        x: room.cx,
        y: room.cy,
        radius: 14,
        used: false,
        usesCount: 0,
        cost: 0
      });
    } else if (room.kind === 'portal') {
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'portal',
        x: room.cx,
        y: room.cy,
        radius: 18,
        used: false,
        usesCount: 0,
        cost: 0
      });
    } else if (room.kind === 'secret') {
      populateSecretRoom(room, rng, props, pickups, interactables);
    } else if (room.kind === 'curiosity') {
      populateCuriosityRoom(room, rng, wPool, priceMult, interactables);
    }
  }

  return { map, props, pickups, interactables };
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
      { id: nid('pk'), kind: 'sticker', x: room.cx - 28, y: room.cy, vx: 0, vy: 0, value: 0, stickerId: s1, roomId: room.id },
      { id: nid('pk'), kind: 'sticker', x: room.cx + 28, y: room.cy, vx: 0, vy: 0, value: 0, stickerId: s2, roomId: room.id }
    );
  } else if (room.secretContent === 'dev_room') {
    props.push({
      id: nid('prop'),
      roomId: room.id,
      kind: 'coffee_machine',
      x: room.cx,
      y: room.cy - 12,
      radius: 10,
      hp: 20,
      maxHp: 20,
      hitFlashTimer: 0
    });
    pickups.push({
      id: nid('pk'),
      kind: 'sticker',
      x: room.cx + 30,
      y: room.cy + 14,
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
      x: room.cx,
      y: room.cy - 8,
      radius: 16,
      used: false,
      usesCount: 0,
      cost: 0,
      speech: '【闲人免进 · 地牢物业办公室】按互动踢门挑战大鹅王！',
      speechTimer: 999
    });
  } else {
    // gold_slimes spawns when player enters; add extra coins too
    for (let i = 0; i < 6; i++) {
      pickups.push({
        id: nid('pk'),
        kind: 'coin',
        x: room.cx + rng.float(-36, 36),
        y: room.cy + rng.float(-24, 24),
        vx: 0,
        vy: 0,
        value: 10,
        roomId: room.id
      });
    }
  }
}

function populateCuriosityRoom(
  room: RoomData,
  rng: SeededRNG,
  wPool: ReturnType<typeof Array.prototype.slice>,
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
          price: p(45),
          sold: false,
          label: `贴纸`
        })),
        {
          id: nid('shop'),
          kind: 'transfer_sticker',
          price: p(35),
          sold: false,
          label: '无损撕贴转移（主↔副武器）',
          desc: '将当前主武器最后一张贴纸转移到副武器'
        },
        {
          id: nid('shop'),
          kind: 'add_slot',
          price: p(85),
          sold: false,
          label: '强行扩槽打孔 (+1贴纸槽)',
          desc: '给主武器钻出1个额外贴纸槽（上限4槽）'
        }
      ];
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'workshop_npc',
        x: room.cx,
        y: room.cy - 10,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '阿胶：只要钱到位，给折凳贴核弹我都干！',
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
        x: room.cx,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 15,
        speech: '命运老虎机：再摇一次，下把必出神装！(15金)',
        speechTimer: 999
      });
      break;
    case 'black_merchant': {
      const w1 = createWeaponInstance(rng.pick(wPool));
      const s1 = rng.pick(STICKER_IDS);
      const items: ShopItem[] = [
        { id: nid('shop'), kind: 'heal', price: p(22), sold: false, label: '大红药水 (回复全部HP)' },
        { id: nid('shop'), kind: 'weapon', weapon: w1, price: p(58), sold: false, label: '神秘脑洞武器' },
        { id: nid('shop'), kind: 'sticker', stickerId: s1, price: p(48), sold: false, label: '稀有魔改贴纸' }
      ];
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'merchant_npc',
        x: room.cx,
        y: room.cy - 10,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        hp: 15,
        speech: '黑心奸商：童叟无欺……喂！别拿枪指着我！',
        speechTimer: 999,
        shopItems: items
      });
      break;
    }
    case 'demon_altar': {
      const s1 = rng.pick(['shadow_clone', 'nuclear_nuke', 'duck_curse', 'vampire_mosquito', 'triple_split', 'laserize'] as const);
      const w1 = createWeaponInstance(rng.pick(['dwarf_sniper', 'twin_lightsaber', 'blackhole_vacuum', 'meteor_tome', 'solar_cannon', 'one_punch_glove'] as const));
      const items: ShopItem[] = [
        { id: nid('shop'), kind: 'sticker', stickerId: s1, price: 0, hpCost: 1, sold: false, label: '恶魔传说贴纸 (-1血上限)' },
        { id: nid('shop'), kind: 'weapon', weapon: w1, price: 0, hpCost: 1, sold: false, label: '传说神兵 (-1血上限)' },
        { id: nid('shop'), kind: 'stat_boost', price: 0, hpCost: 1, sold: false, label: '恶魔契约 (+2护盾上限 / -1血上限)' }
      ];
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'demon_npc',
        x: room.cx,
        y: room.cy - 8,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '礼貌小恶魔：亲，用1点血上限换神器血赚哦~',
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
        x: room.cx,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 10,
        speech: '神奇许愿池：投10金币许愿，小心惊动暴躁青蛙！',
        speechTimer: 999
      });
      break;
    case 'reforge_forge': {
      const items: ShopItem[] = [
        { id: nid('shop'), kind: 'upgrade_dmg', price: p(40), sold: false, label: '铁匠重锤强化 (主武器 +3 伤害)' },
        { id: nid('shop'), kind: 'reforge', price: p(25), sold: false, label: '盲盒重铸 (主武器变全新武器，保留贴纸!)' }
      ];
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'forge_npc',
        x: room.cx,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '猫头鹰铁匠：咣咣两锤，不是变神兵就是变奇葩！',
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
        x: room.cx,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '回收机器人：把副武器喂给我！换金币+材料+随机贴纸！',
        speechTimer: 999
      });
      break;
    case 'ancient_statue':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'statue',
        x: room.cx,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: p(35),
        statueId: rng.pick(STATUES),
        speech: '远古搞笑雕像：供奉35金获得放技能联动祝福！',
        speechTimer: 999
      });
      break;
    case 'mimic_chest':
      interactables.push(
        {
          id: nid('int'),
          roomId: room.id,
          kind: 'mimic_red',
          x: room.cx - 32,
          y: room.cy,
          radius: 14,
          used: false,
          usesCount: 0,
          cost: 0,
          speech: '红蓝赌命箱：选对双倍大奖，选错变宝箱怪！',
          speechTimer: 999
        },
        {
          id: nid('int'),
          roomId: room.id,
          kind: 'mimic_blue',
          x: room.cx + 32,
          y: room.cy,
          radius: 14,
          used: false,
          usesCount: 0,
          cost: 0
        }
      );
      break;
    case 'fate_wheel':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'fate_wheel',
        x: room.cx,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '命运大转盘：免费转动，触发整活本层规则！',
        speechTimer: 999
      });
      break;
    case 'tavern_merc':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'tavern_npc',
        x: room.cx,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: p(45),
        mercKind: rng.pick(MERCS),
        speech: '地牢酒馆：45金雇佣沙雕佣兵陪你一起干架！',
        speechTimer: 999
      });
      break;
    case 'quack_clinic':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'clinic_npc',
        x: room.cx,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: p(22),
        speech: '怪医诊所：22金喝下发光实验药剂（回满血+随机永久强化）！',
        speechTimer: 999
      });
      break;
    case 'arena_trial':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'arena_flag',
        x: room.cx,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '竞技场挑战旗：拔旗连打2波精英，赢取传说宝箱！',
        speechTimer: 999
      });
      break;
    case 'talent_enchanter':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'enchanter_npc',
        x: room.cx,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: p(40),
        speech: '魔法附魔师：40金直接再抽一次3选1额外局内天赋！',
        speechTimer: 999
      });
      break;
    case 'weapon_collector':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'collector_npc',
        x: room.cx,
        y: room.cy,
        radius: 15,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '流浪收藏家：用你的主武器跟我换一把神秘高配武器不？',
        speechTimer: 999
      });
      break;
    case 'bonus_dimension':
      interactables.push({
        id: nid('int'),
        roomId: room.id,
        kind: 'bonus_portal',
        x: room.cx,
        y: room.cy,
        radius: 16,
        used: false,
        usesCount: 0,
        cost: 0,
        speech: '异次元赏金裂隙：激活刷出满屋黄金史莱姆，15秒打多少赚多少！',
        speechTimer: 999
      });
      break;
  }
}

export function getBiomeTitle(biome: BiomeId): string {
  return BIOMES[biome].name;
}
