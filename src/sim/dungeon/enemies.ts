import { BIOMES } from '../../content/biomes';
import { SeededRNG } from '../rng';
import { BiomeId, EnemyKind, EnemyState, RoomData } from '../types';

let enemyUid = 1;

interface EnemyTemplate {
  name: string;
  hp: number;
  speed: number;
  radius: number;
  cd: number;
}

const ENEMY_TEMPLATES: Record<EnemyKind, EnemyTemplate> = {
  // World 1 - Goblin Ruins
  goblin_spear: { name: '长矛哥布林', hp: 18, speed: 56, radius: 7, cd: 1.4 },
  goblin_dart: { name: '吹箭哥布林', hp: 16, speed: 44, radius: 7, cd: 1.8 },
  goblin_bomber: { name: '投弹哥布林', hp: 22, speed: 42, radius: 7, cd: 2.3 },
  goblin_shaman: { name: '图腾萨满', hp: 28, speed: 36, radius: 8, cd: 2.4 },
  boar_rider: { name: '野猪骑兵', hp: 38, speed: 68, radius: 9, cd: 2.2 },
  // World 1 - Frost Castle
  snowman_roller: { name: '滚雪球雪人', hp: 20, speed: 52, radius: 8, cd: 1.8 },
  ice_miner: { name: '冰锥矿工', hp: 24, speed: 44, radius: 7, cd: 1.9 },
  blizzard_sprite: { name: '暴风雪精灵', hp: 26, speed: 48, radius: 7, cd: 2.1 },
  frost_troll: { name: '寒冰巨魔', hp: 44, speed: 38, radius: 10, cd: 2.2 },
  // World 2 - Skeleton Crypt
  skeleton_shield: { name: '持盾骷髅', hp: 36, speed: 48, radius: 8, cd: 1.5 },
  skeleton_archer: { name: '骷髅弓手', hp: 28, speed: 45, radius: 7, cd: 1.8 },
  skeleton_mage: { name: '骷髅大法师', hp: 40, speed: 40, radius: 8, cd: 2.1 },
  boom_skull: { name: '自爆骷髅头', hp: 18, speed: 74, radius: 6, cd: 1.2 },
  headless_knight: { name: '无头骑士', hp: 56, speed: 70, radius: 10, cd: 2.0 },
  // World 2 - Alchemy Factory
  clockwork_gunner: { name: '发条机枪兵', hp: 38, speed: 42, radius: 8, cd: 1.7 },
  alchemy_turret: { name: '炼金炮台', hp: 46, speed: 0, radius: 9, cd: 2.0 },
  goblin_chemist: { name: '毒瓶科学家', hp: 32, speed: 48, radius: 7, cd: 2.1 },
  spring_boxer: { name: '弹簧拳击机', hp: 52, speed: 56, radius: 9, cd: 1.8 },
  // World 3 - Volcano Palace
  lava_slime_king: { name: '熔岩史莱姆', hp: 54, speed: 46, radius: 9, cd: 1.9 },
  obsidian_knight: { name: '黑曜石骑士', hp: 68, speed: 54, radius: 10, cd: 1.7 },
  baby_drake: { name: '火龙幼崽', hp: 48, speed: 62, radius: 8, cd: 1.8 },
  inferno_warlock: { name: '地狱术士', hp: 52, speed: 44, radius: 8, cd: 2.1 },
  // World 3 - Astral Void
  astral_eye: { name: '星界浮游眼', hp: 46, speed: 54, radius: 8, cd: 1.7 },
  void_tentacle: { name: '虚空触手', hp: 58, speed: 34, radius: 9, cd: 1.9 },
  glitch_ghost: { name: '乱码幽灵', hp: 50, speed: 64, radius: 8, cd: 1.6 },
  ufo_elite: { name: '外星飞碟', hp: 72, speed: 58, radius: 10, cd: 1.8 },
  // Special
  angry_frog: { name: '暴躁池塘巨蛙', hp: 90, speed: 60, radius: 11, cd: 1.4 },
  mimic_chest_boss: { name: '精英宝箱怪', hp: 130, speed: 64, radius: 11, cd: 1.3 },
  armed_merchant: { name: '暴怒武装奸商', hp: 220, speed: 58, radius: 11, cd: 0.9 },
  gold_slime: { name: '黄金肥史莱姆', hp: 24, speed: 62, radius: 8, cd: 99 },
  boss_totem_pillar: { name: '祭司图腾柱', hp: 45, speed: 0, radius: 9, cd: 1.8 },
  boss_drone: { name: '机甲维修无人机', hp: 55, speed: 52, radius: 7, cd: 1.6 },
  boss_glitch_clone: { name: '404 故障虚影', hp: 85, speed: 58, radius: 11, cd: 1.4 },
  // Bosses
  boss_goblin_priest: { name: '哥布林大祭司', hp: 420, speed: 42, radius: 15, cd: 1.6 },
  boss_yeti_king: { name: '雪山大猿王', hp: 440, speed: 50, radius: 16, cd: 1.5 },
  boss_skeleton_lord: { name: '骷髅霸主', hp: 860, speed: 46, radius: 16, cd: 1.4 },
  boss_steam_mech: { name: '蒸汽重装机甲', hp: 900, speed: 38, radius: 18, cd: 1.4 },
  boss_twin_dragon: { name: '熔岩双头龙', hp: 1600, speed: 46, radius: 20, cd: 1.25 },
  boss_glitch_lord: { name: '错乱程序主宰', hp: 1550, speed: 54, radius: 17, cd: 1.25 },
  boss_goose_king: { name: '物业经理·大鹅王', hp: 1050, speed: 78, radius: 15, cd: 1.15 }
};

export const BIOME_ENEMY_POOLS: Record<BiomeId, EnemyKind[]> = {
  goblin_ruins: ['goblin_spear', 'goblin_dart', 'goblin_bomber', 'goblin_shaman', 'boar_rider'],
  frost_castle: ['snowman_roller', 'ice_miner', 'blizzard_sprite', 'frost_troll'],
  skeleton_crypt: ['skeleton_shield', 'skeleton_archer', 'skeleton_mage', 'boom_skull', 'headless_knight'],
  alchemy_factory: ['clockwork_gunner', 'alchemy_turret', 'goblin_chemist', 'spring_boxer'],
  volcano_palace: ['lava_slime_king', 'obsidian_knight', 'baby_drake', 'inferno_warlock'],
  astral_void: ['astral_eye', 'void_tentacle', 'glitch_ghost', 'ufo_elite']
};

export function createEnemy(
  kind: EnemyKind,
  roomId: string,
  x: number,
  y: number,
  floor: number,
  isElite = false,
  hpScaleOverride = 1
): EnemyState {
  const tpl = ENEMY_TEMPLATES[kind];
  const isBoss = kind.startsWith('boss_');
  const floorMult = isBoss
    ? (floor > 15 ? 1 + (floor - 15) * 0.22 : 1)
    : 1 + (floor - 1) * 0.14;
  const eliteMult = isElite ? 2.1 : 1;
  const maxHp = Math.max(8, Math.round(tpl.hp * floorMult * eliteMult * hpScaleOverride));

  return {
    id: `en_${enemyUid++}`,
    kind,
    name: isElite ? `精英·${tpl.name}` : tpl.name,
    roomId,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: isElite ? Math.round(tpl.radius * 1.2) : tpl.radius,
    hp: maxHp,
    maxHp,
    speed: tpl.speed * (isElite ? 1.08 : 1),
    isElite,
    isBoss,
    attackCooldown: 0.7 + (enemyUid % 5) * 0.18,
    aiTimer: 0,
    aiPhase: 0,
    facingX: -1,
    hitFlashTimer: 0,
    burnTimer: 0,
    burnTickTimer: 0,
    poisonTimer: 0,
    poisonTickTimer: 0,
    freezeTimer: 0,
    stunTimer: 0,
    duckTimer: 0,
    ccDiminishTimer: 0,
    shieldBonus: 0
  };
}

export function spawnRoomWave(
  room: RoomData,
  biome: BiomeId,
  floor: number,
  rng: SeededRNG,
  doubleBoss = false
): EnemyState[] {
  const out: EnemyState[] = [];
  if (room.kind === 'boss') {
    const bdef = BIOMES[biome];
    if (doubleBoss) {
      const b1 = createEnemy(bdef.bossKind, room.id, room.cx - 42, room.cy, floor, false, 0.65);
      const b2 = createEnemy(bdef.bossKind, room.id, room.cx + 42, room.cy, floor, false, 0.65);
      b1.bossSpeech = '双倍物业费！今天买一送一！';
      b1.bossSpeechTimer = 3.5;
      out.push(b1, b2);
    } else {
      const boss = createEnemy(bdef.bossKind, room.id, room.cx, room.cy - 20, floor, false, 1);
      boss.bossSpeech = getBossIntroSpeech(bdef.bossKind);
      boss.bossSpeechTimer = 3.5;
      out.push(boss);
    }
    return out;
  }

  const pool = BIOME_ENEMY_POOLS[biome];
  const worldIdx = Math.floor((floor - 1) / 5) + 1;
  const count = Math.min(10, 4 + worldIdx + room.wave + rng.int(0, 1));
  const eliteChance = Math.min(0.35, (floor - 1) * 0.035);

  for (let i = 0; i < count; i++) {
    const kind = rng.pick(pool);
    const ex = room.cx + rng.float(-78, 78);
    const ey = room.cy + rng.float(-52, 52);
    const isElite = rng.chance(eliteChance);
    out.push(createEnemy(kind, room.id, ex, ey, floor, isElite));
  }
  return out;
}

export function getBossIntroSpeech(kind: EnemyKind): string {
  switch (kind) {
    case 'boss_goblin_priest':
      return '不交地牢物业费还想走？！';
    case 'boss_yeti_king':
      return '吼呜！谁碰了我的极寒呆毛？！';
    case 'boss_skeleton_lord':
      return '地府摇滚演唱会现在开始！吹喇叭！';
    case 'boss_steam_mech':
      return '黄铜高达启动！全功率熔融射线就绪！';
    case 'boss_twin_dragon':
      return '冰头：别喷火！ 火头：闭嘴先烤了这个骑士！';
    case 'boss_glitch_lord':
      return '警告：你的贴纸数量已触发内存溢出 404！';
    case 'boss_goose_king':
      return '嘎嘎嘎！本月水电费加倍，武器留下！';
    default:
      return '受死吧！';
  }
}
