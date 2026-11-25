import { StickerDef, StickerId } from '../sim/types';

export const STICKERS: Record<StickerId, StickerDef> = {
  // === Trajectory (6) ===
  homing: {
    id: 'homing',
    name: '自动拐弯贴纸',
    shortTag: '追踪',
    rarity: 'blue',
    category: 'trajectory',
    manaDelta: 1,
    color: '#64d2ff',
    desc: '所有子弹/近战剑气获得强力自动寻敌拐弯追踪！'
  },
  triple_split: {
    id: 'triple_split',
    name: '一分三分裂贴纸',
    shortTag: '分裂',
    rarity: 'purple',
    category: 'trajectory',
    manaDelta: 2,
    color: '#c77dff',
    desc: '每次攻击额外 +2 道扇形弹道（单发伤害调整为 78%）'
  },
  laserize: {
    id: 'laserize',
    name: '激光化改装贴',
    shortTag: '激光',
    rarity: 'purple',
    category: 'trajectory',
    manaDelta: 2,
    color: '#ff5277',
    desc: '将攻击改造成瞬发穿透激光束！贴近战可一边砍子弹一边射激光'
  },
  bounce: {
    id: 'bounce',
    name: '弹弹乐碰碰贴',
    shortTag: '弹跳',
    rarity: 'green',
    category: 'trajectory',
    manaDelta: 0,
    color: '#7bf1a8',
    desc: '子弹碰墙额外弹射 2 次，每次弹射伤害 +15%'
  },
  giant: {
    id: 'giant',
    name: '超级巨化贴纸',
    shortTag: '巨化',
    rarity: 'blue',
    category: 'trajectory',
    manaDelta: 1,
    color: '#ff9f1c',
    desc: '子弹尺寸与近战挥砍范围放大 1.65 倍，伤害 +35%！'
  },
  boomerang_return: {
    id: 'boomerang_return',
    name: '回旋镖折返贴',
    shortTag: '折返',
    rarity: 'green',
    category: 'trajectory',
    manaDelta: 1,
    color: '#26c6da',
    desc: '子弹飞至末端后自动折返飞回玩家位置，实现二次穿透打击！'
  },

  // === Element (6) ===
  fire_pepper: {
    id: 'fire_pepper',
    name: '爆裂辣椒贴',
    shortTag: '爆火',
    rarity: 'green',
    category: 'element',
    manaDelta: 1,
    color: '#ff5722',
    desc: '附带灼烧并有 40% 概率引发微型火焰爆炸（可炸开裂纹墙！）'
  },
  subzero: {
    id: 'subzero',
    name: '零下百度贴',
    shortTag: '冰冻',
    rarity: 'blue',
    category: 'element',
    manaDelta: 1,
    color: '#4fc3f7',
    desc: '暴击率 +10%，暴击必定冰冻敌人 1.5 秒'
  },
  volt_chain: {
    id: 'volt_chain',
    name: '十万伏特贴',
    shortTag: '连锁雷',
    rarity: 'blue',
    category: 'element',
    manaDelta: 1,
    color: '#ffe94d',
    desc: '命中释放连锁闪电跳跃周围 3 名敌人，对冰冻目标伤害翻倍！'
  },
  snail_poison: {
    id: 'snail_poison',
    name: '剧毒螺蛳粉贴',
    shortTag: '毒雾',
    rarity: 'green',
    category: 'element',
    manaDelta: 1,
    color: '#76ff03',
    desc: '命中在落点留下持续 3 秒绿色毒雾池，减速并持续叠加中毒'
  },
  nuclear_nuke: {
    id: 'nuclear_nuke',
    name: '核能辐射贴',
    shortTag: '核爆',
    rarity: 'orange',
    category: 'element',
    manaDelta: 3,
    color: '#b2ff59',
    desc: '每攻击 5 次在落点引发微型蘑菇云核爆（大范围高伤+清弹+炸墙）！'
  },
  ice_fire_duo: {
    id: 'ice_fire_duo',
    name: '冰火两重天贴',
    shortTag: '冰火',
    rarity: 'purple',
    category: 'element',
    manaDelta: 2,
    color: '#ff6e40',
    desc: '奇数次冰冻、偶数次烈焰，交替命中立刻触发高伤蒸汽爆裂！'
  },

  // === Stat / Trigger (6) ===
  rapid_fire: {
    id: 'rapid_fire',
    name: '鬼畜射速贴',
    shortTag: '鬼畜',
    rarity: 'blue',
    category: 'stat',
    manaDelta: 0,
    color: '#ff80ab',
    desc: '攻击速度直接 +50%，略有发散，极度解压'
  },
  eco_mana: {
    id: 'eco_mana',
    name: '节能环保贴',
    shortTag: '省蓝',
    rarity: 'blue',
    category: 'stat',
    manaDelta: -2,
    color: '#69f0ae',
    desc: '该武器最终蓝耗 -2 点（最低可降至 0 耗蓝！）'
  },
  reflect_armor: {
    id: 'reflect_armor',
    name: '反甲弹弹贴',
    shortTag: '反弹',
    rarity: 'green',
    category: 'stat',
    manaDelta: 0,
    color: '#b0bec5',
    desc: '发射的子弹/挥砍能够直接撞碎或反弹路径上的敌方子弹！'
  },
  crit_overdrive: {
    id: 'crit_overdrive',
    name: '暴击翻倍贴',
    shortTag: '超暴',
    rarity: 'purple',
    category: 'stat',
    manaDelta: 1,
    color: '#ffd740',
    desc: '暴击率 +20%，暴击伤害倍率从 2.0x 飙升至 2.8x！'
  },
  vampire_mosquito: {
    id: 'vampire_mosquito',
    name: '吸血蚊子贴',
    shortTag: '吸血',
    rarity: 'orange',
    category: 'stat',
    manaDelta: 1,
    color: '#ff1744',
    desc: '暴击击杀敌人有 25% 概率掉落血滴（拾取回 1 血或 2 盾）'
  },
  kill_chain: {
    id: 'kill_chain',
    name: '击杀连锁贴',
    shortTag: '连环',
    rarity: 'purple',
    category: 'stat',
    manaDelta: 1,
    color: '#ff9100',
    desc: '击杀敌人时尸体向 6 个方向喷出环状子弹，连环清房神器！'
  },

  // === Meme (6) ===
  egg_chicken: {
    id: 'egg_chicken',
    name: '下蛋母鸡贴',
    shortTag: '产鸡',
    rarity: 'purple',
    category: 'meme',
    manaDelta: 1,
    color: '#ffd166',
    desc: '每攻击 3 次落点孵化一只暴走自爆小鸡冲向敌人！'
  },
  duck_curse: {
    id: 'duck_curse',
    name: '变鸭子魔咒贴',
    shortTag: '变鸭',
    rarity: 'orange',
    category: 'meme',
    manaDelta: 2,
    color: '#ffee58',
    desc: '命中非 Boss 敌人有 16% 概率将其变成嘎嘎乱跑的小黄鸭 3 秒（受伤+50%）'
  },
  coin_shower: {
    id: 'coin_shower',
    name: '撒币打赏贴',
    shortTag: '撒币',
    rarity: 'blue',
    category: 'meme',
    manaDelta: 0,
    color: '#ffca28',
    desc: '击杀额外掉 2~4 金币；本局每花掉 100 金币，本武器伤害 +1！'
  },
  boombox_sonic: {
    id: 'boombox_sonic',
    name: '音响鬼畜贴',
    shortTag: '声波',
    rarity: 'green',
    category: 'meme',
    manaDelta: 0,
    color: '#18ffff',
    desc: '每次攻击自带魔性音效 + 震碎贴脸子弹的小声波环，暴击率 +12%'
  },
  shadow_clone: {
    id: 'shadow_clone',
    name: '武器影分身贴',
    shortTag: '分身',
    rarity: 'orange',
    category: 'meme',
    manaDelta: 2,
    color: '#ea80fc',
    desc: '每次攻击自动召唤浮空武器影分身追加一次 65% 威力齐射！'
  },
  chaos_random: {
    id: 'chaos_random',
    name: '混沌随机贴',
    shortTag: '盲盒',
    rarity: 'purple',
    category: 'meme',
    manaDelta: 1,
    color: '#ff66ff',
    desc: '每次开火临时随机白嫖 2 张其他魔改贴纸效果，每枪都是盲盒！'
  }
};

export const STICKER_IDS: StickerId[] = Object.keys(STICKERS) as StickerId[];
export const NON_CHAOS_STICKER_IDS: StickerId[] = STICKER_IDS.filter(
  (id) => id !== 'chaos_random' && id !== 'shadow_clone'
);

export const RARITY_COLORS: Record<string, string> = {
  white: '#e8edf5',
  green: '#5ce67a',
  blue: '#4db8ff',
  purple: '#c77dff',
  orange: '#ff9f1c',
  red: '#ff3b5c'
};

export const RARITY_NAMES: Record<string, string> = {
  white: '普通',
  green: '精良',
  blue: '稀有',
  purple: '史诗',
  orange: '传说',
  red: '红武'
};
