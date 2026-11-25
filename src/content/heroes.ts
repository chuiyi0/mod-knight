import { HeroDef, HeroId, PetDef, PetId } from '../sim/types';

export const HERO_UPGRADE_COSTS = [0, 300, 600, 1000, 1500, 2200, 3000]; // Lv1..Lv7

export const HEROES: Record<HeroId, HeroDef> = {
  bucket_knight: {
    id: 'bucket_knight',
    name: '铁桶骑士',
    title: '火力双持狂人',
    baseHp: 6,
    baseShield: 5,
    baseMana: 180,
    moveSpeed: 96,
    critChance: 0.06,
    starterWeapon: 'worn_pistol',
    skillName: '双持狂热',
    skillDesc: '5秒内复制当前主武器（含全部魔改贴纸）双持开火！Lv.7 击杀延长持续时间且副手半蓝耗',
    skillCooldown: 8,
    passiveDesc: 'Lv.6 蓝盾：破盾时溢出伤害不扣血，并获得 0.6s 无敌',
    unlockCost: 0,
    color: '#6bb8ff',
    accentColor: '#d0d8e8',
    lobbyLine: '只要手够多，火力就永远够！'
  },
  sticker_smith: {
    id: 'sticker_smith',
    name: '贴纸工匠',
    title: '万物皆可魔改',
    baseHp: 4,
    baseShield: 5,
    baseMana: 200,
    moveSpeed: 94,
    critChance: 0.1,
    starterWeapon: 'folding_stool',
    skillName: '万能胶炮台',
    skillDesc: '部署持续10秒自动炮台，完整继承主武器所有贴纸！Lv.7 自毁爆炸掉蓝球',
    skillCooldown: 8.5,
    passiveDesc: 'Lv.6 扩容贴纸板：全部武器默认 +1 贴纸槽位（最高4槽）',
    unlockCost: 3000,
    color: '#ffb74d',
    accentColor: '#ffe082',
    lobbyLine: '没有什么问题是一张贴纸解决不了的！'
  },
  ranger_cat: {
    id: 'ranger_cat',
    name: '游侠喵',
    title: '极速影步暴击',
    baseHp: 4,
    baseShield: 4,
    baseMana: 160,
    moveSpeed: 106,
    critChance: 0.15,
    starterWeapon: 'salted_fish',
    skillName: '瞬步影斩',
    skillDesc: '高速冲刺 0.45s 无敌帧，落地 1.5s 内下击必暴击！Lv.7 充能2层且撞碎子弹',
    skillCooldown: 3.5,
    passiveDesc: 'Lv.6 暴击穿透：所有暴击子弹可穿透敌人',
    unlockCost: 2500,
    color: '#3c3c4c',
    accentColor: '#ff4d6d',
    lobbyLine: '喵？没有翻滚键？我自己带了！'
  },
  alchemist_quirk: {
    id: 'alchemist_quirk',
    name: '炼金怪客',
    title: '冰火毒化学反应',
    baseHp: 5,
    baseShield: 5,
    baseMana: 180,
    moveSpeed: 94,
    critChance: 0.06,
    starterWeapon: 'takeout_box',
    skillName: '三联元素瓶',
    skillDesc: '扇形抛出毒/火/冰三瓶烧瓶，火毒叠加引爆 24 伤剧毒爆燃！Lv.7 额外附赠闪电整活瓶',
    skillCooldown: 5.5,
    passiveDesc: 'Lv.6 毒免疫 + 元素持续伤害 +35%',
    unlockCost: 3500,
    color: '#66bb6a',
    accentColor: '#b9f6ca',
    lobbyLine: '喝一口？别怕，只是稍微发光而已~'
  },
  slacker_priest: {
    id: 'slacker_priest',
    name: '圣光摸鱼牧',
    title: '续航防御欧皇',
    baseHp: 4,
    baseShield: 6,
    baseMana: 220,
    moveSpeed: 92,
    critChance: 0.06,
    starterWeapon: 'thunder_staff',
    skillName: '摸鱼结界',
    skillDesc: '展开6秒圣光地毯，每秒回血回盾回蓝并减速敌弹 45%！Lv.7 怪物也摸鱼减攻速',
    skillCooldown: 11,
    passiveDesc: 'Lv.6 商店9折 + 奇遇房好运权重 +12%',
    unlockCost: 4000,
    color: '#fff59d',
    accentColor: '#4dd0e1',
    lobbyLine: '救世主也要准点下班的嘛……'
  },
  blade_ashura: {
    id: 'blade_ashura',
    name: '魔剑士·阿修',
    title: '居合斩碎弹幕',
    baseHp: 6,
    baseShield: 4,
    baseMana: 140,
    moveSpeed: 100,
    critChance: 0.12,
    starterWeapon: 'sword_40m',
    skillName: '居合斩弹幕',
    skillDesc: '横跨半屏月牙剑气切碎敌弹，最多将 8 颗子弹化作追踪光剑反击！Lv.7 斩5弹减半CD',
    skillCooldown: 4.5,
    passiveDesc: 'Lv.6 近战范围 +25% 且自带近战反弹子弹',
    unlockCost: -1,
    color: '#ce93d8',
    accentColor: '#ff3b5c',
    lobbyLine: '只要我挥剑够快，子弹就追不上我！'
  }
};

export const HERO_LIST: HeroDef[] = Object.values(HEROES);

export function getHeroStatsAtLevel(heroId: HeroId, level: number) {
  const h = HEROES[heroId];
  const lv = Math.max(1, Math.min(7, level));
  return {
    maxHp: h.baseHp + (lv >= 2 ? 1 : 0),
    maxShield: h.baseShield + (lv >= 3 ? 1 : 0),
    maxMana: h.baseMana + (lv >= 4 ? 20 : 0),
    skillCooldown: lv >= 5 ? h.skillCooldown * 0.85 : h.skillCooldown,
    hasPassive: lv >= 6,
    isMaxSkill: lv >= 7
  };
}

export const PETS: Record<PetId, PetDef> = {
  orange_cat: {
    id: 'orange_cat',
    name: '橘猫「大橘」',
    unlockCost: 0,
    unlockHint: '初始免费',
    desc: '冲上去抓咬拉仇恨；每清 3 房有 45% 概率刨出 6~12 金币',
    color: '#ff9e43'
  },
  greedy_slime: {
    id: 'greedy_slime',
    name: '财迷史莱姆',
    unlockCost: 1500,
    unlockHint: '1,500 蓝币',
    desc: '自动磁吸拾取全房间金币、蓝球、材料与血滴！',
    color: '#69f0ae'
  },
  mecha_duck: {
    id: 'mecha_duck',
    name: '机械鸭「嘎嘎号」',
    unlockCost: 2500,
    unlockHint: '2,500 蓝币',
    desc: '每 5 秒射出追踪小导弹；靠近隐藏裂纹墙会自动大叫提醒！',
    color: '#ffd54f'
  },
  mini_dragon: {
    id: 'mini_dragon',
    name: '迷你红龙',
    unlockCost: -1,
    unlockHint: '击败 3-5 熔岩双头龙或通关解锁',
    desc: '周期性喷吐 3 发小火球点燃敌人，助你触发冰火反应',
    color: '#ff5252'
  },
  ghost_lantern: {
    id: 'ghost_lantern',
    name: '幽灵提灯',
    unlockCost: 2000,
    unlockHint: '2,000 蓝币',
    desc: '护盾破碎时瞬间释放一圈消弹脉冲并小幅回复护盾冷却',
    color: '#b388ff'
  },
  sticker_fairy: {
    id: 'sticker_fairy',
    name: '贴纸小精灵',
    unlockCost: -2,
    unlockHint: '累计发现 10 种魔改贴纸解锁',
    desc: '提升稀有魔改贴纸掉落概率 +18%，并会实时吐槽武器！',
    color: '#ff80ab'
  }
};

export const PET_LIST: PetDef[] = Object.values(PETS);
