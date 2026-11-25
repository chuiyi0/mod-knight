import { BiomeId, DailyFactorId, MaterialId, PlantId, TalentId } from '../sim/types';

export interface BiomeDef {
  id: BiomeId;
  world: 1 | 2 | 3;
  name: string;
  floorColor: string;
  floorAltColor: string;
  wallColor: string;
  wallTopColor: string;
  accentColor: string;
  bossKind:
    | 'boss_goblin_priest'
    | 'boss_yeti_king'
    | 'boss_skeleton_lord'
    | 'boss_steam_mech'
    | 'boss_twin_dragon'
    | 'boss_glitch_lord';
  bossName: string;
  bossTitle: string;
  bossRedWeapon:
    | 'goblin_totem'
    | 'yeti_frostfist'
    | 'skull_trumpet'
    | 'mech_laser_arm'
    | 'dragon_twin_breath'
    | 'glitch_404_sword';
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  goblin_ruins: {
    id: 'goblin_ruins',
    world: 1,
    name: '哥布林遗迹',
    floorColor: '#2d372f',
    floorAltColor: '#334036',
    wallColor: '#4c574e',
    wallTopColor: '#69786b',
    accentColor: '#69f0ae',
    bossKind: 'boss_goblin_priest',
    bossName: '哥布林大祭司',
    bossTitle: '地牢物业收租长',
    bossRedWeapon: 'goblin_totem'
  },
  frost_castle: {
    id: 'frost_castle',
    world: 1,
    name: '霜雪古堡',
    floorColor: '#273a4d',
    floorAltColor: '#2e445a',
    wallColor: '#4c6d8a',
    wallTopColor: '#7ea6c7',
    accentColor: '#80d8ff',
    bossKind: 'boss_yeti_king',
    bossName: '雪山大猿王',
    bossTitle: '极寒呆毛暴君',
    bossRedWeapon: 'yeti_frostfist'
  },
  skeleton_crypt: {
    id: 'skeleton_crypt',
    world: 2,
    name: '骷髅地穴',
    floorColor: '#2b2238',
    floorAltColor: '#332944',
    wallColor: '#524369',
    wallTopColor: '#756291',
    accentColor: '#ce93d8',
    bossKind: 'boss_skeleton_lord',
    bossName: '骷髅霸主',
    bossTitle: '地下重金属唢呐王',
    bossRedWeapon: 'skull_trumpet'
  },
  alchemy_factory: {
    id: 'alchemy_factory',
    world: 2,
    name: '炼金工坊',
    floorColor: '#352d24',
    floorAltColor: '#40362b',
    wallColor: '#6b5842',
    wallTopColor: '#997c58',
    accentColor: '#ffb74d',
    bossKind: 'boss_steam_mech',
    bossName: '蒸汽重装机甲',
    bossTitle: '黄铜高达 MK-IV',
    bossRedWeapon: 'mech_laser_arm'
  },
  volcano_palace: {
    id: 'volcano_palace',
    world: 3,
    name: '火山魔殿',
    floorColor: '#361f1f',
    floorAltColor: '#422525',
    wallColor: '#663434',
    wallTopColor: '#8f4747',
    accentColor: '#ff5252',
    bossKind: 'boss_twin_dragon',
    bossName: '熔岩双头龙',
    bossTitle: '爱吵架的冰火双煞',
    bossRedWeapon: 'dragon_twin_breath'
  },
  astral_void: {
    id: 'astral_void',
    world: 3,
    name: '星界虚空',
    floorColor: '#191a33',
    floorAltColor: '#212344',
    wallColor: '#3c407a',
    wallTopColor: '#5e64b8',
    accentColor: '#00e5ff',
    bossKind: 'boss_glitch_lord',
    bossName: '错乱程序主宰',
    bossTitle: 'THE GLITCH LORD 404',
    bossRedWeapon: 'glitch_404_sword'
  }
};

export const WORLD_BIOME_CHOICES: Record<1 | 2 | 3, [BiomeId, BiomeId]> = {
  1: ['goblin_ruins', 'frost_castle'],
  2: ['skeleton_crypt', 'alchemy_factory'],
  3: ['volcano_palace', 'astral_void']
};

export interface DailyFactorDef {
  id: DailyFactorId;
  name: string;
  positive: boolean;
  icon: string;
  desc: string;
}

export const DAILY_FACTORS: Record<DailyFactorId, DailyFactorDef> = {
  sticker_sale: { id: 'sticker_sale', name: '贴纸大甩卖', positive: true, icon: '🏷️', desc: '全武器 +1 贴纸槽，工坊刷新率大增' },
  infinite_mana: { id: 'infinite_mana', name: '无限蓝量', positive: true, icon: '💧', desc: '蓝量持续快速回复，全武器蓝耗减半' },
  giant_weapons: { id: 'giant_weapons', name: '武器巨无霸', positive: true, icon: '🔨', desc: '所有子弹与挥砍默认 1.4x 巨化且伤害 +25%' },
  half_skill_cd: { id: 'half_skill_cd', name: '技能冷却减半', positive: true, icon: '⚡', desc: '英雄主动技能冷却时间 -50%' },
  curiosity_boom: { id: 'curiosity_boom', name: '奇遇大爆发', positive: true, icon: '❓', desc: '每层额外生成更多奇遇房' },
  crit_explode: { id: 'crit_explode', name: '暴击即爆炸', positive: true, icon: '💥', desc: '玩家每次暴击在目标脚下引发微型范围爆炸' },
  double_boss: { id: 'double_boss', name: '双倍Boss房', positive: false, icon: '👑', desc: '每大关第5层出现 2 只缩水版 Boss 围攻（双倍奖励）' },
  glass_cannon: { id: 'glass_cannon', name: '玻璃大炮', positive: false, icon: '💎', desc: '敌我伤害翻倍，玩家护盾上限减半' },
  weapon_roulette: { id: 'weapon_roulette', name: '手气抽奖局', positive: false, icon: '🎲', desc: '每进新一层武器随机换新（保留全部魔改贴纸！）' },
  monster_split: { id: 'monster_split', name: '怪物分裂狂潮', positive: false, icon: '🦠', desc: '普通小怪死亡有 30% 概率分裂成 2 只迷你怪' },
  melee_only: { id: 'melee_only', name: '近战大师赛', positive: false, icon: '🐟', desc: '地牢掉落偏向近战与奇物，贴纸照常狂掉' },
  turbo_speed: { id: 'turbo_speed', name: '极速狂飙', positive: false, icon: '🚀', desc: '敌我移速与弹速全部 +30%' }
};

export function getDailyChallengeFactors(dateStr: string, seedOffset = 0): DailyFactorId[] {
  let h = 2166136261 + seedOffset * 9973;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pos = (Object.keys(DAILY_FACTORS) as DailyFactorId[]).filter((k) => DAILY_FACTORS[k].positive);
  const neg = (Object.keys(DAILY_FACTORS) as DailyFactorId[]).filter((k) => !DAILY_FACTORS[k].positive);
  const pick2 = (arr: DailyFactorId[], salt: number): DailyFactorId[] => {
    const copy = arr.slice();
    const out: DailyFactorId[] = [];
    let s = (h + salt) >>> 0;
    for (let i = 0; i < 2; i++) {
      s = Math.imul(s ^ (s >>> 13), 1274126177) >>> 0;
      const idx = s % copy.length;
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  };
  return [...pick2(pos, 17), ...pick2(neg, 73)];
}

export const MATERIALS: Record<MaterialId, { name: string; icon: string; color: string }> = {
  iron: { name: '铁矿石', icon: '⚙️', color: '#b0bec5' },
  magic_shard: { name: '魔法碎片', icon: '🔮', color: '#ba68c8' },
  wood: { name: '木材', icon: '🪵', color: '#a1887f' },
  quirk_part: { name: '怪奇零件', icon: '🧩', color: '#ffb74d' },
  glow_glue: { name: '荧光胶水', icon: '🧴', color: '#69f0ae' },
  core_crystal: { name: '核心晶石', icon: '💎', color: '#ff5252' }
};

export interface PlantDef {
  id: PlantId;
  name: string;
  icon: string;
  rarity: string;
  perennial: boolean;
  desc: string;
  talentReward?: TalentId;
}

export const PLANTS: Record<PlantId, PlantDef> = {
  gem_tree: { id: 'gem_tree', name: '蓝币发财树', icon: '🌳', rarity: 'green', perennial: false, desc: '收获 320 蓝币' },
  iron_cactus: { id: 'iron_cactus', name: '铁矿仙人掌', icon: '🌵', rarity: 'green', perennial: false, desc: '收获 8 铁矿石 + 4 怪奇零件' },
  fire_chili: { id: 'fire_chili', name: '烈焰辣椒树', icon: '🌶️', rarity: 'blue', perennial: true, desc: '多年生：采摘本局白嫖【火焰免疫】天赋', talentReward: 'fire_shield' },
  mandrake_poison: { id: 'mandrake_poison', name: '曼德拉毒草', icon: '🌿', rarity: 'blue', perennial: true, desc: '多年生：采摘本局白嫖【毒素免疫】天赋', talentReward: 'poison_shield' },
  frost_lotus: { id: 'frost_lotus', name: '极寒雪莲', icon: '🪷', rarity: 'blue', perennial: true, desc: '多年生：采摘本局白嫖【冰霜免疫】天赋', talentReward: 'ice_shield' },
  sticker_vine: { id: 'sticker_vine', name: '贴纸藤蔓', icon: '🏷️', rarity: 'purple', perennial: true, desc: '多年生：采摘直接掉落 1 张稀有贴纸带进本' },
  carrot_tree: { id: 'carrot_tree', name: '萝卜神树', icon: '🥕', rarity: 'blue', perennial: false, desc: '直接拔出 1 把带贴纸的「加特林大萝卜」带出门！' },
  lucky_clover: { id: 'lucky_clover', name: '幸运四叶草', icon: '🍀', rarity: 'orange', perennial: false, desc: '本局获得【欧皇降临】高稀有掉落祝福' }
};

export const ACHIEVEMENTS: Array<{ id: string; title: string; desc: string; rewardGems: number }> = [
  { id: 'first_clear', title: '魔法核心归位', desc: '首次通关 3-5 击败终极 Boss（同时解锁魔剑士·阿修！）', rewardGems: 1500 },
  { id: 'salted_fish_win', title: '咸鱼翻身', desc: '携带贴满贴纸的「超级咸鱼」通关 3-5', rewardGems: 1000 },
  { id: 'rob_merchant', title: '反客为主', desc: '在地牢里硬抢黑心奸商并成功干翻他', rewardGems: 800 },
  { id: 'chicken_farm', title: '养鸡场场长', desc: '同一时刻场上存在 8 只以上暴走小鸡', rewardGems: 600 },
  { id: 'slot_jackpot', title: '欧皇本皇', desc: '在命运老虎机摇出一次 JACKPOT 头奖', rewardGems: 1000 },
  { id: 'goose_slayer', title: '物业克星', desc: '炸开隐藏密室并击败彩蛋 Boss「物业经理·大鹅王」', rewardGems: 1500 },
  { id: 'secret_finder', title: '拆迁专家', desc: '首次炸开地牢隐藏裂纹墙进入密室', rewardGems: 400 },
  { id: 'sticker_collector_10', title: '贴纸狂魔', desc: '累计发现 10 种不同的魔改贴纸（解锁贴纸小精灵！）', rewardGems: 800 },
  { id: 'endless_diver', title: '无尽深渊探险家', desc: '通关后继续进入 4-1 无尽深渊模式', rewardGems: 1000 },
  { id: 'demon_vip', title: '恶魔大客户', desc: '在恶魔诅咒祭坛一次性买空全部 3 件商品', rewardGems: 700 }
];
