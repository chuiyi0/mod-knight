import { STICKERS, STICKER_IDS } from '../../content/stickers';
import { TALENT_IDS } from '../../content/talents';
import { createWeaponInstance, MELEE_QUIRK_WEAPONS, NORMAL_DROP_WEAPONS, WEAPONS } from '../../content/weapons';
import { SeededRNG } from '../rng';
import {
  InteractableState,
  MAX_WEAPON_VAULT,
  PlayerState,
  ShopItem,
  StatueId,
  StickerId,
  WorldState
} from '../types';
import { createEnemy, spawnRoomWave } from './enemies';

let curUid = 1;

export interface CuriosityContext {
  world: WorldState;
  player: PlayerState;
  rng: SeededRNG;
  toast: (text: string, color?: string) => void;
  sfx: (sound: string, pitch?: number) => void;
  addFloatingText: (x: number, y: number, text: string, color: string, scale?: number) => void;
  lockRoom: (roomId: string) => void;
  addStickerToBag: (stickerId: StickerId) => void;
  openTalentChoice: () => void;
  unlockAchievement: (id: string) => void;
  recordSticker: (id: StickerId) => void;
  recordWeapon: (id: keyof typeof WEAPONS) => void;
}

const STATUE_NAMES: Record<StatueId, string> = {
  knight: '骑士雕像（放技能召唤小骑士）',
  paladin: '圣骑士雕像（放技能套免伤金盾）',
  berserker: '狂战士雕像（放技能5秒巨化+3伤）',
  assassin: '刺客雕像（放技能射追踪飞刀）',
  priest: '牧师雕像（放技能回25点蓝）',
  fortune_cat: '财神猫雕像（放技能撒追踪金元宝）'
};

export function handleInteractable(inter: InteractableState, ctx: CuriosityContext): void {
  const { world, player, rng, toast, sfx, addFloatingText } = ctx;
  const luckBonus =
    (player.talents.includes('gambler_luck') ? 0.2 : 0) +
    (player.heroId === 'slacker_priest' && player.heroLevel >= 6 ? 0.12 : 0) +
    (player.luckyBlessing ? 0.15 : 0);
  const wPool = world.dailyFactors.includes('melee_only') ? MELEE_QUIRK_WEAPONS : NORMAL_DROP_WEAPONS;

  switch (inter.kind) {
    case 'chest': {
      // 100% SAFE chest — ZERO jumpscare mimics!
      if (inter.used) return;
      inter.used = true;
      sfx('chest');
      const w = createWeaponInstance(rng.pick(wPool));
      world.pickups.push({
        id: `pk_c_${curUid++}`,
        kind: 'weapon',
        x: inter.x - 14,
        y: inter.y + 14,
        vx: 0,
        vy: 0,
        value: 0,
        weapon: w,
        roomId: inter.roomId
      });
      const sid = rng.pick(STICKER_IDS);
      ctx.addStickerToBag(sid);
      player.coins += 18;
      toast(`🎁 开启安全宝箱！爆出武器 + 18金，贴纸【${STICKERS[sid].name}】已存入背包！`, '#ffd54f');
      break;
    }

    case 'campfire': {
      if (inter.used) {
        toast('🔥 营火余温犹在，状态已满啦！', '#ffb74d');
        return;
      }
      inter.used = true;
      player.hp = player.maxHp;
      player.mana = player.maxMana;
      player.campfireBuffTimer = 45;
      sfx('heal');
      addFloatingText(player.x, player.y - 16, '🔥 营火祝福：满血满蓝 + 攻速提升！', '#ffb74d', 1.0);
      toast('🔥 在旅途营火休息片刻：生命蓝量全满，获得 45 秒烤火攻击祝福！', '#ffb74d');
      break;
    }

    case 'slot_machine': {
      // Safe fun Slot Machine — NO surprise face-bombs!
      if (inter.used) {
        toast('老虎机已经转满 6 次冒烟啦！', '#90a4ae');
        return;
      }
      const vipFree = player.talents.includes('vip_discount') && inter.usesCount < 2;
      const cost = vipFree ? 0 : inter.cost;
      if (player.coins < cost) {
        toast(`金币不足（需要 ${cost} 金）`, '#ff5252');
        sfx('error');
        return;
      }
      player.coins -= cost;
      player.coinsSpentTotal += cost;
      inter.usesCount++;
      inter.cost += 5;
      sfx('slot');

      const roll = rng.next() + luckBonus * 0.25;
      if (roll >= 0.88) {
        inter.used = true;
        inter.speech = '🎉 JACKPOT 超级头奖！！';
        sfx('jackpot');
        ctx.unlockAchievement('slot_jackpot');
        const w = createWeaponInstance(rng.pick(['dwarf_sniper', 'twin_lightsaber', 'blackhole_vacuum', 'meteor_tome', 'solar_cannon', 'goblin_gatling'] as const));
        const s = rng.pick(['shadow_clone', 'nuclear_nuke', 'duck_curse', 'triple_split', 'laserize'] as const);
        world.pickups.push({ id: `jp_w_${curUid++}`, kind: 'weapon', x: inter.x, y: inter.y + 20, vx: 0, vy: 0, value: 0, weapon: w, roomId: inter.roomId });
        ctx.addStickerToBag(s);
        player.coins += 60;
        toast(`🎰 JACKPOT！！掉出传说武器 + 60金 + 贴纸【${STICKERS[s].name}】入包！`, '#ffd54f');
      } else if (roll >= 0.52) {
        const s = rng.pick(STICKER_IDS);
        ctx.addStickerToBag(s);
        toast(`🎰 中奖！贴纸【${STICKERS[s].name}】已直接存入背包！`, '#69f0ae');
      } else if (roll >= 0.24) {
        player.hp = Math.min(player.maxHp, player.hp + 2);
        player.coins += 24;
        toast('🎰 小奖：返还 24 金币 + 回复 2 点生命！', '#4fc3f7');
      } else {
        player.coins += 5;
        addFloatingText(inter.x, inter.y - 14, '安慰奖 +5金', '#b0bec5', 0.9);
        toast('🎰 差一点点！吐出 5 金币安慰奖~', '#b0bec5');
      }
      if (inter.usesCount >= 6) inter.used = true;
      break;
    }

    case 'wishing_well': {
      // Safe Wishing Well — NO surprise frog ambush!
      if (inter.usesCount >= 6) {
        toast('许愿池的水已经被你许干了！', '#90a4ae');
        return;
      }
      if (player.coins < inter.cost) {
        toast('金币不足（需 10 金）', '#ff5252');
        return;
      }
      player.coins -= inter.cost;
      player.coinsSpentTotal += inter.cost;
      inter.usesCount++;
      sfx('coin');
      const r = rng.next() + luckBonus * 0.22;
      if (r > 0.65) {
        const s = rng.pick(STICKER_IDS);
        ctx.addStickerToBag(s);
        toast(`⛲ 许愿显灵！贴纸【${STICKERS[s].name}】自动收入背包！`, '#69f0ae');
      } else if (r > 0.42) {
        const seed = rng.pick(['gem_tree', 'fire_chili', 'frost_lotus', 'sticker_vine', 'carrot_tree', 'lucky_clover'] as const);
        player.seedsEarned[seed] = (player.seedsEarned[seed] ?? 0) + 1;
        toast('⛲ 捞出一颗稀有魔法花园种子！', '#80d8ff');
      } else if (r > 0.22) {
        world.pickups.push({ id: `ww_p_${curUid++}`, kind: 'weapon', x: inter.x, y: inter.y + 20, vx: 0, vy: 0, value: 0, weapon: createWeaponInstance('golden_pan'), roomId: inter.roomId });
        toast('⛲ 河神送你一把【黄金平底锅】（背在背后自动挡子弹）！', '#ffd54f');
      } else {
        player.hp = Math.min(player.maxHp, player.hp + 1);
        player.mana = Math.min(player.maxMana, player.mana + 35);
        toast('⛲ 池水泛起圣光：恢复 1 血 + 35 能量！', '#4fc3f7');
      }
      break;
    }

    case 'workshop_npc':
    case 'merchant_npc':
    case 'demon_npc':
    case 'forge_npc': {
      world.activeWorkshopId = inter.id;
      world.status = 'paused_modal';
      world.events.push({ type: 'workshop_open', interactableId: inter.id });
      break;
    }

    case 'recycle_bot': {
      if (player.weapons.length <= 1) {
        toast('你只剩 1 把手持武器，可以在背包里回收仓库备用武器！', '#ffb74d');
        return;
      }
      const offIdx = player.activeWeaponIndex === 0 ? 1 : 0;
      const recycled = player.weapons.splice(offIdx, 1)[0];
      if (player.activeWeaponIndex >= player.weapons.length) player.activeWeaponIndex = 0;
      // Return any stickers on recycled weapon to bag!
      for (const s of recycled.stickers) ctx.addStickerToBag(s);
      inter.usesCount++;
      player.coins += 42;
      player.materialsEarned.quirk_part = (player.materialsEarned.quirk_part ?? 0) + 3;
      sfx('chest');
      const bonusS = rng.pick(STICKER_IDS);
      ctx.addStickerToBag(bonusS);
      toast(`♻️ 高价回收【${WEAPONS[recycled.defId].name}】：+42金 + 额外贴纸【${STICKERS[bonusS].name}】！`, '#69f0ae');
      break;
    }

    case 'statue': {
      if (inter.used || !inter.statueId) return;
      if (player.coins < inter.cost) {
        toast(`金币不足（供奉需 ${inter.cost} 金）`, '#ff5252');
        return;
      }
      player.coins -= inter.cost;
      player.coinsSpentTotal += inter.cost;
      inter.used = true;
      player.statueId = inter.statueId;
      sfx('jackpot');
      toast(`🗿 获得祝福：${STATUE_NAMES[inter.statueId]}！`, '#ffd54f');
      break;
    }

    case 'mimic_red':
    case 'mimic_blue': {
      // Safe 2-choice reward chests — NO surprise mimic jumpscare!
      if (inter.used) return;
      for (const other of world.interactables) {
        if (other.roomId === inter.roomId && (other.kind === 'mimic_red' || other.kind === 'mimic_blue')) {
          other.used = true;
        }
      }
      sfx('jackpot');
      if (inter.kind === 'mimic_red') {
        const w = createWeaponInstance(rng.pick(wPool));
        world.pickups.push({ id: `mc_w_${curUid++}`, kind: 'weapon', x: inter.x, y: inter.y + 14, vx: 0, vy: 0, value: 0, weapon: w, roomId: inter.roomId });
        player.coins += 40;
        toast('🟥 开启福利红箱：爆出稀有脑洞武器 + 40 金币！', '#ff8a80');
      } else {
        const s1 = rng.pick(STICKER_IDS);
        const s2 = rng.pick(STICKER_IDS.filter((id) => id !== s1));
        ctx.addStickerToBag(s1);
        ctx.addStickerToBag(s2);
        toast(`🟦 开启福利蓝箱：双倍贴纸【${STICKERS[s1].shortTag}】【${STICKERS[s2].shortTag}】存入背包！`, '#4fc3f7');
      }
      break;
    }

    case 'fate_wheel': {
      if (inter.used) return;
      inter.used = true;
      sfx('slot');
      const mut = rng.pick(['big_head', 'coin_rush', 'low_gravity'] as const);
      world.floorMutator = mut;
      const descMap = {
        big_head: '🎲 本图触发【全员大头模式】：暴击率直接翻倍！',
        coin_rush: '🎲 本图触发【金币狂潮】：怪物爆出 3 倍金币！',
        low_gravity: '🎲 本图触发【低重力蹦迪】：击退翻倍，满屏乱飞！'
      };
      toast(descMap[mut], '#ff80ab');
      break;
    }

    case 'tavern_npc': {
      if (inter.used || !inter.mercKind) return;
      if (player.coins < inter.cost) {
        toast(`金币不足（雇佣需 ${inter.cost} 金）`, '#ff5252');
        return;
      }
      player.coins -= inter.cost;
      player.coinsSpentTotal += inter.cost;
      inter.used = true;
      const names = { chef: '暴躁大厨', archer: '近视弓箭手', bomber: '叛变炸弹哥布林', mage: '实习冰法师' };
      world.mercs.push({
        id: `merc_${curUid++}`,
        kind: inter.mercKind,
        name: names[inter.mercKind],
        x: inter.x,
        y: inter.y + 14,
        vx: 0,
        vy: 0,
        hp: 40,
        maxHp: 40,
        attackCooldown: 0.5,
        alive: true,
        speech: '老板大气！跟我冲！',
        speechTimer: 3
      });
      sfx('jackpot');
      toast(`🍺 雇佣了【${names[inter.mercKind]}】陪你闯关！`, '#ffd54f');
      break;
    }

    case 'clinic_npc': {
      if (inter.used) return;
      if (player.coins < inter.cost) {
        toast(`金币不足（需要 ${inter.cost} 金）`, '#ff5252');
        return;
      }
      player.coins -= inter.cost;
      player.coinsSpentTotal += inter.cost;
      inter.used = true;
      player.hp = player.maxHp;
      sfx('heal');
      const roll = rng.int(0, 3);
      if (roll === 0) {
        player.maxHp += 1;
        player.hp = player.maxHp;
        toast('💊 怪医强化：回满血且生命上限 +1！', '#69f0ae');
      } else if (roll === 1) {
        player.maxShield += 1;
        player.shield = player.maxShield;
        toast('💊 怪医强化：回满血且护盾上限 +1！', '#4fc3f7');
      } else if (roll === 2) {
        player.maxMana += 40;
        player.mana = player.maxMana;
        toast('💊 怪医强化：回满血且能量上限 +40！', '#80d8ff');
      } else {
        player.miniPlayerScale = 0.74;
        player.radius = 5;
        toast('💊 怪医彩蛋：变身迷你小人，碰撞箱更小更好躲弹幕！', '#ff80ab');
      }
      break;
    }

    case 'arena_flag': {
      if (inter.used) return;
      inter.used = true;
      const room = world.map.rooms.find((r) => r.id === inter.roomId);
      if (room) {
        room.cleared = false;
        room.arenaActive = true;
        room.wave = 1;
        room.maxWaves = 2;
        ctx.lockRoom(room.id);
        const wave = spawnRoomWave(room, world.biome, world.floor, rng);
        for (const e of wave) e.isElite = true;
        world.enemies.push(...wave);
        sfx('explode');
        toast('⚔️ 主动拔旗开启竞技场试炼！赢取传说神兵 + 贴纸！', '#ff9f1c');
      }
      break;
    }

    case 'enchanter_npc': {
      if (inter.used) return;
      if (player.coins < inter.cost) {
        toast(`金币不足（需要 ${inter.cost} 金）`, '#ff5252');
        return;
      }
      player.coins -= inter.cost;
      player.coinsSpentTotal += inter.cost;
      inter.used = true;
      ctx.openTalentChoice();
      toast('🔮 魔法导师赠送一次额外 3 选 1 天赋！', '#ce93d8');
      break;
    }

    case 'collector_npc': {
      if (inter.used) return;
      inter.used = true;
      const cur = player.weapons[player.activeWeaponIndex];
      const upgradedPool = [
        'goblin_gatling',
        'dwarf_sniper',
        'twin_lightsaber',
        'blackhole_vacuum',
        'meteor_tome',
        'solar_cannon',
        'keyboard_bible',
        'carrot_gatling',
        'magic_hat',
        'coin_gun',
        'one_punch_glove'
      ] as const;
      const newDef = rng.pick(upgradedPool);
      const nw = createWeaponInstance(newDef);
      nw.stickers = cur.stickers.slice();
      player.weapons[player.activeWeaponIndex] = nw;
      ctx.recordWeapon(newDef);
      sfx('jackpot');
      toast(`🧙‍♂️ 换到了【${WEAPONS[newDef].name}】（已保留原贴纸！）`, '#c77dff');
      break;
    }

    case 'bonus_portal': {
      if (inter.used) return;
      inter.used = true;
      world.bonusTimer = 15;
      for (let i = 0; i < 8; i++) {
        world.enemies.push(
          createEnemy('gold_slime', inter.roomId, inter.x + rng.float(-65, 65), inter.y + rng.float(-40, 40), world.floor)
        );
      }
      sfx('jackpot');
      toast('🛸 黄金史莱姆狂欢开启！15 秒内随便打，满地爆金币！', '#ffd54f');
      break;
    }

    case 'secret_goose_door': {
      if (inter.used) return;
      inter.used = true;
      const goose = createEnemy('boss_goose_king', inter.roomId, inter.x, inter.y - 10, world.floor);
      goose.bossSpeech = '嘎嘎嘎！！主动踢门挑战物业大鹅王！';
      goose.bossSpeechTimer = 3.5;
      world.enemies.push(goose);
      world.bossBannerTimer = 2.6;
      world.bossBannerName = '隐藏 Boss · 物业经理·大鹅王';
      ctx.lockRoom(inter.roomId);
      sfx('explode');
      break;
    }
  }
}

export function buyShopItemFromInteractable(
  _inter: InteractableState,
  item: ShopItem,
  ctx: CuriosityContext
): boolean {
  const { player, rng, toast, sfx } = ctx;
  if (item.sold) return false;

  if (item.hpCost && item.hpCost > 0) {
    if (player.maxHp <= item.hpCost) {
      toast('生命上限太低，不能再献祭啦！', '#ff5252');
      sfx('error');
      return false;
    }
    player.maxHp -= item.hpCost;
    player.hp = Math.min(player.hp, player.maxHp);
    player.demonDealsBought++;
    if (player.demonDealsBought >= 3) ctx.unlockAchievement('demon_vip');
  } else {
    if (player.coins < item.price) {
      toast(`金币不足（需要 ${item.price} 金）`, '#ff5252');
      sfx('error');
      return false;
    }
    player.coins -= item.price;
    player.coinsSpentTotal += item.price;
  }

  item.sold = true;
  sfx('coin');

  switch (item.kind) {
    case 'heal':
      player.hp = player.maxHp;
      toast('❤️ 饮用旅途大红药水，生命全满！', '#69f0ae');
      break;
    case 'stat_boost':
      player.maxShield += 2;
      player.shield = player.maxShield;
      toast('😈 签订恶魔契约：护盾上限 +2！', '#ce93d8');
      break;
    case 'shield_boost':
      player.maxShield += 1;
      player.shield = player.maxShield;
      toast('🛡️ 购买护盾扩容：护盾上限永久 +1！', '#4fc3f7');
      break;
    case 'sticker':
      if (item.stickerId) {
        ctx.addStickerToBag(item.stickerId);
        toast(`🏷️ 购买成功！【${STICKERS[item.stickerId].name}】已存入贴纸背包！`, STICKERS[item.stickerId].color);
      }
      break;
    case 'weapon':
      if (item.weapon) {
        const maxWeapons = player.talents.includes('extra_weapon_slot') ? 3 : 2;
        if (player.weapons.length < maxWeapons) {
          player.weapons.push(item.weapon);
          player.activeWeaponIndex = player.weapons.length - 1;
          toast(`⚔️ 购买并装备【${WEAPONS[item.weapon.defId].name}】！`, '#ffd54f');
        } else if (player.weaponVault.length < MAX_WEAPON_VAULT) {
          player.weaponVault.push(item.weapon);
          toast(`🎒 购买成功！【${WEAPONS[item.weapon.defId].name}】已存入背包仓库！`, '#ffd54f');
        } else {
          player.weapons[player.activeWeaponIndex] = item.weapon;
          toast(`⚔️ 购买并替换装备【${WEAPONS[item.weapon.defId].name}】！`, '#ffd54f');
        }
        ctx.recordWeapon(item.weapon.defId);
      }
      break;
    case 'add_slot': {
      const main = player.weapons[player.activeWeaponIndex];
      main.extraSlots += 1;
      toast(`🔧 主武器【${WEAPONS[main.defId].name}】成功扩槽 +1！`, '#ffd54f');
      break;
    }
    case 'upgrade_dmg': {
      const main = player.weapons[player.activeWeaponIndex];
      main.damageBonus += 3;
      toast(`🔨 强化成功！【${WEAPONS[main.defId].name}】基础伤害 +3！`, '#ff9f1c');
      break;
    }
    case 'reforge': {
      const main = player.weapons[player.activeWeaponIndex];
      const newId = rng.pick(NORMAL_DROP_WEAPONS.filter((id) => id !== main.defId));
      const nw = createWeaponInstance(newId);
      nw.stickers = main.stickers.slice();
      nw.extraSlots = main.extraSlots;
      player.weapons[player.activeWeaponIndex] = nw;
      ctx.recordWeapon(newId);
      toast(`🔥 重铸成功！变身为【${WEAPONS[newId].name}】（保留原贴纸）！`, '#ff7043');
      break;
    }
  }
  return true;
}

export function pickThreeTalents(player: PlayerState, rng: SeededRNG): typeof TALENT_IDS {
  const available = TALENT_IDS.filter((id) => !player.talents.includes(id));
  return rng.shuffle(available).slice(0, 3);
}
