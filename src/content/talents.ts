import { TalentDef, TalentId } from '../sim/types';

export const TALENTS: Record<TalentId, TalentDef> = {
  // Defense (6)
  blue_shield: { id: 'blue_shield', name: '蓝盾保护', icon: '🛡️', category: 'defense', desc: '破盾时溢出伤害不扣血，并获得 0.6s 无敌' },
  fire_shield: { id: 'fire_shield', name: '火焰免疫', icon: '🔥', category: 'defense', desc: '免疫火焰/熔岩/爆炸伤害，我方火焰伤害 +25%' },
  poison_shield: { id: 'poison_shield', name: '毒素免疫', icon: '☠️', category: 'defense', desc: '免疫毒气与中毒状态，我方毒素伤害 +25%' },
  ice_shield: { id: 'ice_shield', name: '冰霜免疫', icon: '❄️', category: 'defense', desc: '免疫冰冻减速，我方冰冻时长 +40%' },
  melee_reflect: { id: 'melee_reflect', name: '近战反弹', icon: '⚔️', category: 'defense', desc: '近战挥砍将敌方子弹以 1.5x 速度反弹回去！' },
  vampire_aura: { id: 'vampire_aura', name: '吸血光环', icon: '🩸', category: 'defense', desc: '每击杀 10 名敌人恢复 1 点生命值' },

  // Offense (6)
  shotgun_plus: { id: 'shotgun_plus', name: '霰弹增多', icon: '💥', category: 'offense', desc: '散射武器子弹 +2，【分裂贴纸】额外 +1 弹道' },
  bullet_bounce: { id: 'bullet_bounce', name: '子弹弹射', icon: '🎱', category: 'offense', desc: '所有实体子弹碰墙额外反弹 1 次' },
  laser_thick: { id: 'laser_thick', name: '激光加粗', icon: '🔦', category: 'offense', desc: '所有激光宽度 +50%，激光伤害 +25%' },
  crit_precision: { id: 'crit_precision', name: '精准暴击', icon: '🎯', category: 'offense', desc: '散布减少 50%，基础暴击率 +10%' },
  charge_fast: { id: 'charge_fast', name: '蓄力爆发', icon: '🏹', category: 'offense', desc: '弓箭/重炮/法书射速 +25%，伤害 +15%' },
  attack_speed: { id: 'attack_speed', name: '攻速狂热', icon: '⚡', category: 'offense', desc: '全武器攻击速度 +18%，近战挥砍范围 +20%' },

  // Sticker & Curiosity (6)
  sticker_slot_plus: { id: 'sticker_slot_plus', name: '贴纸扩容', icon: '🏷️', category: 'mod', desc: '所有武器贴纸槽位上限 +1（最高 4 槽）' },
  glue_boost: { id: 'glue_boost', name: '万能胶加强', icon: '🧴', category: 'mod', desc: '魔改贴纸数值效果 +25%，贴纸蓝耗惩罚减半' },
  sticker_salvage: { id: 'sticker_salvage', name: '贴纸回收师', icon: '♻️', category: 'mod', desc: '替换丢弃武器时自动保底将 1 张贴纸无损转贴给新武器！' },
  vip_discount: { id: 'vip_discount', name: '地牢VIP卡', icon: '💳', category: 'mod', desc: '商店/工坊/黑商全部 6 折，老虎机前 2 次免费！' },
  curiosity_sense: { id: 'curiosity_sense', name: '奇遇嗅觉', icon: '🧭', category: 'mod', desc: '后续每层多 1 间奇遇房，隐藏裂纹墙自动闪金光提示' },
  gambler_luck: { id: 'gambler_luck', name: '赌神附体', icon: '🎰', category: 'mod', desc: '老虎机/许愿池/宝箱怪等概率奇遇好评率大幅 +20%！' },

  // Utility (6)
  extra_weapon_slot: { id: 'extra_weapon_slot', name: '额外武器槽', icon: '🎒', category: 'utility', desc: '可同时携带 3 把武器自由循环切换' },
  kill_mana: { id: 'kill_mana', name: '击杀回蓝', icon: '💧', category: 'utility', desc: '每击杀 1 名敌人立即回复 4 点蓝量' },
  crate_potions: { id: 'crate_potions', name: '木箱藏宝', icon: '📦', category: 'utility', desc: '打碎木箱/墓碑大概率掉血瓶、蓝球与额外金币' },
  gold_armor: { id: 'gold_armor', name: '金币护甲', icon: '💰', category: 'utility', desc: '每拥有 100 金币额外获得 +1 护盾上限（最高 +3）' },
  skill_cdr: { id: 'skill_cdr', name: '技能冷却缩减', icon: '⏱️', category: 'utility', desc: '英雄主动技能冷却时间缩短 22%' },
  pet_frenzy: { id: 'pet_frenzy', name: '宠物狂暴', icon: '🐾', category: 'utility', desc: '宠物与佣兵伤害与攻击频率翻倍！' }
};

export const TALENT_IDS: TalentId[] = Object.keys(TALENTS) as TalentId[];
