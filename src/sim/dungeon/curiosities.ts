import { STICKERS, STICKER_IDS } from '../../content/stickers';
import { TALENT_IDS } from '../../content/talents';
import { createWeaponInstance, MELEE_QUIRK_WEAPONS, NORMAL_DROP_WEAPONS, WEAPONS } from '../../content/weapons';
import { SeededRNG } from '../rng';
import {
  InteractableState,
  PlayerState,
  ShopItem,
  StatueId,
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
  offerSticker: (stickerId: keyof typeof STICKERS) => void;
  openTalentChoice: () => void;
  unlockAchievement: (id: string) => void;
  recordSticker: (id: keyof typeof STICKERS) => void;
  recordWeapon: (id: keyof typeof WEAPONS) => void;
}

const STATUE_NAMES: Record<StatueId, string> = {
  knight: '骑士雕像（放技能召唤小骑士波）',
  paladin: '圣骑士雕像（放技能套1次免伤金盾）',
  berserker: '狂战士雕像（放技能5秒子弹巨化+3伤）',
  assassin: '刺客雕像（放技能射出3把追踪飞刀）',
  priest: '牧师雕像（放技能回复25点能量）',
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
      if (inter.used) return;
      inter.used = true;
      sfx('chest');
      // 12% surprise mimic unless lucky
      if (rng.chance(Math.max(0.04, 0.12 - luckBonus * 0.3))) {
        const mimic = createEnemy('mimic_chest_boss', inter.roomId, inter.x, inter.y, world.floor);
        world.enemies.push(mimic);
        ctx.lockRoom(inter.roomId);
        toast('哎呀！是宝箱怪！干掉它爆双倍贴纸！', '#ff5252');
        return;
      }
      // Drop weapon + high chance sticker!
      const w = createWeaponInstance(rng.pick(wPool));
      world.pickups.push({
        id: `pk_c_${curUid++}`,
        kind: 'weapon',
        x: inter.x - 16,
        y: inter.y + 10,
        vx: -20,
        vy: 15,
        value: 0,
        weapon: w,
        roomId: inter.roomId
      });
      if (rng.chance(0.75 + luckBonus)) {
        const sid = rng.pick(STICKER_IDS);
        world.pickups.push({
          id: `pk_cs_${curUid++}`,
          kind: 'sticker',
          x: inter.x + 16,
          y: inter.y + 10,
          vx: 20,
          vy: 15,
          value: 0,
          stickerId: sid,
          roomId: inter.roomId
        });
      }
      toast('打开宝箱！爆出脑洞装备！', '#ffd54f');
      break;
    }

    case 'slot_machine': {
      if (inter.used) {
        toast('老虎机已经冒烟报废了！', '#90a4ae');
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
      if (roll >= 0.92) {
        // JACKPOT!!
        inter.used = true;
        inter.speech = '🎉 JACKPOT 超级头奖！！机器过热报废！';
        sfx('jackpot');
        ctx.unlockAchievement('slot_jackpot');
        const w = createWeaponInstance(rng.pick(['dwarf_sniper', 'twin_lightsaber', 'blackhole_vacuum', 'meteor_tome', 'solar_cannon', 'goblin_gatling'] as const));
        const s = rng.pick(['shadow_clone', 'nuclear_nuke', 'duck_curse', 'triple_split', 'laserize'] as const);
        world.pickups.push(
          { id: `jp_w_${curUid++}`, kind: 'weapon', x: inter.x - 22, y: inter.y + 16, vx: 0, vy: 0, value: 0, weapon: w, roomId: inter.roomId },
          { id: `jp_s_${curUid++}`, kind: 'sticker', x: inter.x + 22, y: inter.y + 16, vx: 0, vy: 0, value: 0, stickerId: s, roomId: inter.roomId }
        );
        for (let i = 0; i < 8; i++) {
          world.pickups.push({
            id: `jp_c_${curUid++}`,
            kind: 'coin',
            x: inter.x + rng.float(-35, 35),
            y: inter.y + rng.float(8, 35),
            vx: 0,
            vy: 0,
            value: 10,
            roomId: inter.roomId
          });
        }
        toast('🎰 JACKPOT！！喷出传说神兵 + 稀有贴纸 + 金币雨！', '#ffd54f');
      } else if (roll >= 0.7) {
        const s = rng.pick(STICKER_IDS);
        world.pickups.push({ id: `sl_s_${curUid++}`, kind: 'sticker', x: inter.x, y: inter.y + 20, vx: 0, vy: 0, value: 0, stickerId: s, roomId: inter.roomId });
        toast(`🎰 中奖！掉出【${STICKERS[s].name}】！`, '#69f0ae');
      } else if (roll >= 0.45) {
        world.pickups.push({ id: `sl_h_${curUid++}`, kind: 'hp_potion', x: inter.x, y: inter.y + 20, vx: 0, vy: 0, value: 2, roomId: inter.roomId });
        player.coins += 25;
        toast('🎰 小奖：返还 25 金币 + 血瓶！', '#4fc3f7');
      } else if (roll >= 0.22) {
        world.hazards.push({
          id: `sl_b_${curUid++}`,
          kind: 'bomb_warn',
          x: inter.x,
          y: inter.y + 18,
          radius: 34,
          timer: 1.3,
          maxTimer: 1.3,
          damage: 2,
          fromPlayer: false,
          canBreakWall: true
        });
        toast('💣 卧槽！老虎机吐出一颗定时炸弹，快躲开！', '#ff5252');
      } else {
        player.coins += 1;
        addFloatingText(inter.x, inter.y - 14, '谢谢惠顾(找零1金)', '#b0bec5', 0.9);
        toast('🎰 谢谢惠顾~ 反诈中心提醒您理性消费', '#b0bec5');
      }
      if (inter.usesCount >= 6) inter.used = true;
      break;
    }

    case 'wishing_well': {
      if (inter.usesCount >= 8) {
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
      const r = rng.next() + luckBonus * 0.2;
      if (r > 0.78) {
        const s = rng.pick(STICKER_IDS);
        world.pickups.push({ id: `ww_s_${curUid++}`, kind: 'sticker', x: inter.x, y: inter.y + 20, vx: 0, vy: 0, value: 0, stickerId: s, roomId: inter.roomId });
        toast(`⛲ 许愿显灵！浮出【${STICKERS[s].name}】！`, '#69f0ae');
      } else if (r > 0.56) {
        const seed = rng.pick(['gem_tree', 'fire_chili', 'frost_lotus', 'sticker_vine', 'carrot_tree', 'lucky_clover'] as const);
        player.seedsEarned[seed] = (player.seedsEarned[seed] ?? 0) + 1;
        toast('⛲ 捞出一颗稀有魔法花园种子！', '#80d8ff');
      } else if (r > 0.38) {
        world.pickups.push({ id: `ww_p_${curUid++}`, kind: 'weapon', x: inter.x, y: inter.y + 20, vx: 0, vy: 0, value: 0, weapon: createWeaponInstance('golden_pan'), roomId: inter.roomId });
        toast('⛲ 河神问：你掉的是这把黄金平底锅吗？', '#ffd54f');
      } else if (r < 0.14) {
        const frog = createEnemy('angry_frog', inter.roomId, inter.x, inter.y + 18, world.floor);
        world.enemies.push(frog);
        ctx.lockRoom(inter.roomId);
        toast('🐸 砸到池底巨蛙了！干掉它爆大礼！', '#ff5252');
      } else {
        addFloatingText(inter.x, inter.y - 12, '咕噜咕噜...', '#4fc3f7', 0.9);
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
        toast('你只剩 1 把武器，不能塞进回收机！先捡把副武器吧', '#ffb74d');
        return;
      }
      const offIdx = player.activeWeaponIndex === 0 ? 1 : 0;
      const recycled = player.weapons.splice(offIdx, 1)[0];
      if (player.activeWeaponIndex >= player.weapons.length) player.activeWeaponIndex = 0;
      inter.usesCount++;
      player.coins += 28;
      player.materialsEarned.quirk_part = (player.materialsEarned.quirk_part ?? 0) + 2;
      sfx('chest');
      if (inter.usesCount >= 2 || rng.chance(0.45)) {
        const sid = rng.pick(STICKER_IDS);
        ctx.offerSticker(sid);
        toast(`♻️ 回收【${WEAPONS[recycled.defId].name}】！机器人打了个嗝吐出 28 金 + 魔改贴纸！`, '#69f0ae');
      } else {
        toast(`♻️ 回收【${WEAPONS[recycled.defId].name}】获得 28 金 + 怪奇零件×2！`, '#ffd54f');
      }
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
      if (inter.used) return;
      // Disable both chests in this room
      for (const other of world.interactables) {
        if (other.roomId === inter.roomId && (other.kind === 'mimic_red' || other.kind === 'mimic_blue')) {
          other.used = true;
        }
      }
      if (rng.chance(0.58 + luckBonus * 0.5)) {
        sfx('jackpot');
        const w = createWeaponInstance(rng.pick(wPool));
        const s = rng.pick(STICKER_IDS);
        world.pickups.push(
          { id: `mc_w_${curUid++}`, kind: 'weapon', x: inter.x - 16, y: inter.y + 12, vx: 0, vy: 0, value: 0, weapon: w, roomId: inter.roomId },
          { id: `mc_s_${curUid++}`, kind: 'sticker', x: inter.x + 16, y: inter.y + 12, vx: 0, vy: 0, value: 0, stickerId: s, roomId: inter.roomId }
        );
        player.coins += 35;
        toast('📦 赌赢了！双倍宝箱大爆发！', '#69f0ae');
      } else {
        const mimic = createEnemy('mimic_chest_boss', inter.roomId, inter.x, inter.y, world.floor);
        world.enemies.push(mimic);
        ctx.lockRoom(inter.roomId);
        sfx('explode');
        toast('👹 选错啦！精英宝箱怪张嘴咬过来了！（击杀必爆高级贴纸）', '#ff5252');
      }
      break;
    }

    case 'fate_wheel': {
      if (inter.used) return;
      inter.used = true;
      sfx('slot');
      const mut = rng.pick(['big_head', 'coin_rush', 'low_gravity', 'weapon_swap'] as const);
      world.floorMutator = mut;
      const descMap = {
        big_head: '🎲 本层触发【全员大头模式】：暴击率翻倍！',
        coin_rush: '🎲 本层触发【金币狂潮】：怪物爆出 3 倍金币！',
        low_gravity: '🎲 本层触发【低重力蹦迪】：击退翻倍，满屏乱飞！',
        weapon_swap: '🎲 本层触发【武器每20秒随机换神兵】：体验全图鉴！'
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
        toast('💊 喝下实验药剂：回满血且生命上限 +1！', '#69f0ae');
      } else if (roll === 1) {
        player.maxShield += 1;
        player.shield = player.maxShield;
        toast('💊 喝下实验药剂：回满血且护盾上限 +1！', '#4fc3f7');
      } else if (roll === 2) {
        player.maxMana += 40;
        player.mana = player.maxMana;
        toast('💊 喝下实验药剂：回满血且能量上限 +40！', '#80d8ff');
      } else {
        player.miniPlayerScale = 0.72;
        player.radius = 5;
        toast('💊 副作用触发！你变身「迷你小人」，碰撞体积变小超好躲弹幕！', '#ff80ab');
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
        toast('⚔️ 竞技场试炼开始！打赢 2 波精英赢取传说大奖！', '#ff9f1c');
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
      const oldStickers = cur.stickers.slice();
      const nw = createWeaponInstance(newDef);
      nw.stickers = oldStickers;
      player.weapons[player.activeWeaponIndex] = nw;
      ctx.recordWeapon(newDef);
      sfx('jackpot');
      toast(`🧙‍♂️ 收藏家跟你换到了【${WEAPONS[newDef].name}】（已保留原贴纸！）`, '#c77dff');
      break;
    }

    case 'bonus_portal': {
      if (inter.used) return;
      inter.used = true;
      world.bonusTimer = 15;
      for (let i = 0; i < 8; i++) {
        world.enemies.push(
          createEnemy('gold_slime', inter.roomId, inter.x + rng.float(-70, 70), inter.y + rng.float(-45, 45), world.floor)
        );
      }
      sfx('jackpot');
      toast('🛸 黄金史莱姆狂欢开启！15 秒内疯狂暴打爆金币和贴纸！', '#ffd54f');
      break;
    }

    case 'secret_goose_door': {
      if (inter.used) return;
      inter.used = true;
      const goose = createEnemy('boss_goose_king', inter.roomId, inter.x, inter.y - 10, world.floor);
      goose.bossSpeech = '嘎嘎嘎！！擅闯物业办公室，先把武器交出来！';
      goose.bossSpeechTimer = 3.5;
      world.enemies.push(goose);
      world.bossBannerTimer = 2.6;
      world.bossBannerName = '隐藏 Boss · 物业经理·大鹅王';
      ctx.lockRoom(inter.roomId);
      sfx('explode');
      toast('🪿 踢开了物业办公室大门！大鹅王暴怒冲锋！', '#ffeb3b');
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
    if (player.demonDealsBought >= 3) {
      ctx.unlockAchievement('demon_vip');
    }
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
      toast('❤️ 饮用大红药水，生命全满！', '#69f0ae');
      break;
    case 'stat_boost':
      player.maxShield += 2;
      player.shield = player.maxShield;
      toast('😈 签订恶魔契约：护盾上限 +2！', '#ce93d8');
      break;
    case 'sticker':
      if (item.stickerId) {
        ctx.world.activeWorkshopId = null;
        ctx.offerSticker(item.stickerId);
      }
      break;
    case 'weapon':
      if (item.weapon) {
        const maxWeapons = player.talents.includes('extra_weapon_slot') ? 3 : 2;
        if (player.weapons.length < maxWeapons) {
          player.weapons.push(item.weapon);
          player.activeWeaponIndex = player.weapons.length - 1;
        } else {
          player.weapons[player.activeWeaponIndex] = item.weapon;
        }
        ctx.recordWeapon(item.weapon.defId);
        toast(`🎒 获得武器【${WEAPONS[item.weapon.defId].name}】！`, '#ffd54f');
      }
      break;
    case 'transfer_sticker': {
      if (player.weapons.length < 2) {
        toast('至少需要 2 把武器才能转移贴纸（已退还金币）', '#ffb74d');
        player.coins += item.price;
        item.sold = false;
        return false;
      }
      const main = player.weapons[player.activeWeaponIndex];
      const otherIdx = (player.activeWeaponIndex + 1) % player.weapons.length;
      const other = player.weapons[otherIdx];
      if (main.stickers.length === 0) {
        toast('当前主武器上没有贴纸可撕（已退还金币）', '#ffb74d');
        player.coins += item.price;
        item.sold = false;
        return false;
      }
      const moved = main.stickers.pop()!;
      if (!other.stickers.includes(moved)) {
        other.stickers.push(moved);
      }
      toast(`🏷️ 已无损将【${STICKERS[moved].name}】转移至副武器！`, '#69f0ae');
      break;
    }
    case 'add_slot': {
      const main = player.weapons[player.activeWeaponIndex];
      main.extraSlots += 1;
      toast(`🔧 主武器【${WEAPONS[main.defId].name}】成功扩槽 +1！`, '#ffd54f');
      break;
    }
    case 'upgrade_dmg': {
      const main = player.weapons[player.activeWeaponIndex];
      main.damageBonus += 3;
      toast(`🔨 铁匠强化成功！【${WEAPONS[main.defId].name}】基础伤害 +3！`, '#ff9f1c');
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
      toast(`🔥 重铸成功！变身为【${WEAPONS[newId].name}】（已保留贴纸）！`, '#ff7043');
      break;
    }
  }
  return true;
}

export function pickThreeTalents(player: PlayerState, rng: SeededRNG): typeof TALENT_IDS {
  const available = TALENT_IDS.filter((id) => !player.talents.includes(id));
  return rng.shuffle(available).slice(0, 3);
}
