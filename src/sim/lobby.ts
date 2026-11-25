import { HERO_LIST, HERO_UPGRADE_COSTS, HEROES, PETS } from '../content/heroes';
import { PLANTS } from '../content/biomes';
import { STICKERS, STICKER_IDS } from '../content/stickers';
import { createWeaponInstance, NORMAL_DROP_WEAPONS, WEAPONS } from '../content/weapons';
import {
  HeroId,
  InputCommand,
  MaterialId,
  MetaSave,
  PetId,
  PlantId,
  StickerId,
  TILE_SIZE,
  WeaponId
} from '../sim/types';
import { saveMetaSave, todayDateString } from '../platform/storage';

export type LobbyStationKind =
  | 'portal'
  | 'hero_npc'
  | 'pet_bed'
  | 'gacha'
  | 'forge'
  | 'sticker_bench'
  | 'garden'
  | 'daily_board'
  | 'cellar'
  | 'tv_stats'
  | 'lan_terminal';

export interface LobbyStation {
  id: string;
  kind: LobbyStationKind;
  x: number;
  y: number;
  radius: number;
  label: string;
  icon: string;
  color: string;
  heroId?: HeroId;
  speech?: string;
}

export interface LobbyState {
  widthPx: number;
  heightPx: number;
  playerX: number;
  playerY: number;
  facingX: number;
  petX: number;
  petY: number;
  time: number;
  stations: LobbyStation[];
  nearestStationId: string | null;
}

export class WalkableLobby {
  state: LobbyState;

  constructor() {
    const widthPx = 38 * TILE_SIZE; // 608
    const heightPx = 24 * TILE_SIZE; // 384
    const cx = widthPx / 2;
    const cy = heightPx / 2;

    const stations: LobbyStation[] = [
      // North Departure Zone
      { id: 'st_portal', kind: 'portal', x: cx, y: 56, radius: 26, label: '🌀 踏入地牢传送门', icon: '🌀', color: '#4fc3f7' },
      { id: 'st_daily', kind: 'daily_board', x: cx + 92, y: 62, radius: 22, label: '📋 每日挑战因子看板', icon: '📋', color: '#ffd54f' },
      { id: 'st_pet', kind: 'pet_bed', x: cx - 92, y: 62, radius: 22, label: '🐾 宠物窝（换宠/解锁）', icon: '🐾', color: '#ff9e43' },

      // West Zone: Magic Garden
      { id: 'st_garden', kind: 'garden', x: 86, y: cy, radius: 28, label: '🌱 魔法种植花园 (6块地)', icon: '🌱', color: '#69f0ae' },

      // East Zone: Forge & Sticker Pre-print Bench
      { id: 'st_forge', kind: 'forge', x: widthPx - 88, y: cy - 34, radius: 24, label: '🔨 武器锻造台', icon: '🔨', color: '#ff7043' },
      { id: 'st_sticker', kind: 'sticker_bench', x: widthPx - 88, y: cy + 36, radius: 24, label: '🏷️ 贴纸预印台', icon: '🏷️', color: '#c77dff' },

      // Central Lounge Facilities
      { id: 'st_gacha', kind: 'gacha', x: cx - 120, y: cy + 92, radius: 22, label: '🎰 蓝币像素扭蛋机', icon: '🎰', color: '#ff5277' },
      { id: 'st_tv', kind: 'tv_stats', x: cx + 120, y: cy + 92, radius: 22, label: '📺 复古电视 / 存档码', icon: '📺', color: '#80d8ff' },
      { id: 'st_lan', kind: 'lan_terminal', x: cx + 172, y: 66, radius: 20, label: '📡 局域网联机终端', icon: '📡', color: '#00e5ff' },

      // South Zone: Underground Cellar
      { id: 'st_cellar', kind: 'cellar', x: cx, y: heightPx - 46, radius: 26, label: '🏆 地下收藏陈列室 & 成就', icon: '🏆', color: '#ffd54f' }
    ];

    // Add all 6 idle Heroes lounging around the central cozy table!
    const heroOffsets = [
      [-66, -18],
      [0, -24],
      [66, -18],
      [-66, 38],
      [0, 44],
      [66, 38]
    ];
    HERO_LIST.forEach((h, idx) => {
      const [ox, oy] = heroOffsets[idx];
      stations.push({
        id: `st_hero_${h.id}`,
        kind: 'hero_npc',
        x: cx + ox,
        y: cy + oy,
        radius: 20,
        label: `切换/升级【${h.name}】`,
        icon: '🧙',
        color: h.color,
        heroId: h.id,
        speech: h.lobbyLine
      });
    });

    this.state = {
      widthPx,
      heightPx,
      playerX: cx,
      playerY: cy + 8,
      facingX: 1,
      petX: cx - 18,
      petY: cy + 16,
      time: 0,
      stations,
      nearestStationId: null
    };
  }

  step(cmd: InputCommand, dt: number): LobbyStation | null {
    const st = this.state;
    st.time += dt;
    const mag = Math.hypot(cmd.moveX, cmd.moveY);
    const nx = mag > 1 ? cmd.moveX / mag : cmd.moveX;
    const ny = mag > 1 ? cmd.moveY / mag : cmd.moveY;
    const spd = 110;

    st.playerX = Math.max(30, Math.min(st.widthPx - 30, st.playerX + nx * spd * dt));
    st.playerY = Math.max(36, Math.min(st.heightPx - 30, st.playerY + ny * spd * dt));
    if (Math.abs(nx) > 0.1) st.facingX = nx >= 0 ? 1 : -1;

    // Pet follows gently
    const pdx = st.playerX - 18 * st.facingX - st.petX;
    const pdy = st.playerY + 10 - st.petY;
    const pd = Math.hypot(pdx, pdy);
    if (pd > 6) {
      st.petX += (pdx / pd) * 95 * dt;
      st.petY += (pdy / pd) * 95 * dt;
    }

    // Nearest station detection
    let best: LobbyStation | null = null;
    let bestD = 36;
    for (const s of st.stations) {
      const d = Math.hypot(s.x - st.playerX, s.y - st.playerY);
      if (d < s.radius + 14 && d < bestD) {
        bestD = d;
        best = s;
      }
    }
    st.nearestStationId = best?.id ?? null;

    if ((cmd.interactPressed || cmd.firePressed) && best) {
      return best;
    }
    // Walking right into portal center enters automatically!
    const portal = st.stations[0];
    if (Math.hypot(portal.x - st.playerX, portal.y - st.playerY) < 16) {
      return portal;
    }
    return null;
  }

  warpToStation(kind: LobbyStationKind): LobbyStation | null {
    const target = this.state.stations.find((s) => s.kind === kind);
    if (!target) return null;
    this.state.playerX = target.x;
    this.state.playerY = Math.min(this.state.heightPx - 36, target.y + 18);
    this.state.nearestStationId = target.id;
    return target;
  }
}

// === Lobby Progression Actions (Pure Functions on MetaSave) ===

export function unlockOrSelectHero(meta: MetaSave, heroId: HeroId): { ok: boolean; msg: string } {
  const def = HEROES[heroId];
  if (meta.unlockedHeroes.includes(heroId)) {
    meta.selectedHero = heroId;
    saveMetaSave(meta);
    return { ok: true, msg: `已切换出战英雄：【${def.name}】！` };
  }
  if (def.unlockCost < 0) {
    return { ok: false, msg: `【${def.name}】需通关一次 3-5 免费解锁！` };
  }
  if (meta.gems < def.unlockCost) {
    return { ok: false, msg: `蓝币不足（需 ${def.unlockCost} 蓝币）` };
  }
  meta.gems -= def.unlockCost;
  meta.unlockedHeroes.push(heroId);
  meta.selectedHero = heroId;
  saveMetaSave(meta);
  return { ok: true, msg: `🎉 成功解锁并切换【${def.name}】！` };
}

export function upgradeHero(meta: MetaSave, heroId: HeroId): { ok: boolean; msg: string } {
  if (!meta.unlockedHeroes.includes(heroId)) return { ok: false, msg: '尚未解锁该英雄' };
  const lv = meta.heroLevels[heroId] ?? 1;
  if (lv >= 7) return { ok: false, msg: '该英雄已达满级 Lv.7！' };
  const cost = HERO_UPGRADE_COSTS[lv];
  if (meta.gems < cost) return { ok: false, msg: `蓝币不足（升级需 ${cost} 蓝币）` };
  meta.gems -= cost;
  meta.heroLevels[heroId] = lv + 1;
  saveMetaSave(meta);
  return { ok: true, msg: `⬆️ 【${HEROES[heroId].name}】升至 Lv.${lv + 1}！` };
}

export function unlockOrSelectPet(meta: MetaSave, petId: PetId): { ok: boolean; msg: string } {
  const def = PETS[petId];
  if (meta.unlockedPets.includes(petId)) {
    meta.selectedPet = petId;
    saveMetaSave(meta);
    return { ok: true, msg: `已携宠出战：【${def.name}】！` };
  }
  if (def.unlockCost < 0) return { ok: false, msg: `解锁条件：${def.unlockHint}` };
  if (meta.gems < def.unlockCost) return { ok: false, msg: `蓝币不足（需 ${def.unlockCost} 蓝币）` };
  meta.gems -= def.unlockCost;
  meta.unlockedPets.push(petId);
  meta.selectedPet = petId;
  saveMetaSave(meta);
  return { ok: true, msg: `🐾 成功解锁萌宠【${def.name}】！` };
}

export function pullGacha(meta: MetaSave): { ok: boolean; msg: string; isBomb?: boolean } {
  const today = todayDateString();
  if (meta.gachaDay !== today) {
    meta.gachaDay = today;
    meta.gachaPullsToday = 0;
  }
  if (meta.gachaPullsToday >= 20) return { ok: false, msg: '今日扭蛋次数已达上限 (20/20)' };
  if (meta.gems < 200) return { ok: false, msg: '蓝币不足（单抽需 200 蓝币）' };

  meta.gems -= 200;
  meta.gachaPullsToday++;
  meta.gachaPity++;

  const isPity = meta.gachaPity >= 10;
  const r = Math.random();
  let msg = '';
  let isBomb = false;

  if (isPity || r < 0.22) {
    meta.gachaPity = 0;
    const wid = NORMAL_DROP_WEAPONS[Math.floor(Math.random() * NORMAL_DROP_WEAPONS.length)];
    meta.preparedWeapon = createWeaponInstance(wid);
    meta.weaponsSeen[wid] = (meta.weaponsSeen[wid] ?? 0) + 1;
    msg = `🎉 扭出出门神兵【${WEAPONS[wid].name}】！（下局直接带进 1-1！）`;
  } else if (r < 0.48) {
    const seeds: PlantId[] = ['gem_tree', 'iron_cactus', 'fire_chili', 'mandrake_poison', 'frost_lotus', 'sticker_vine', 'carrot_tree', 'lucky_clover'];
    const s = seeds[Math.floor(Math.random() * seeds.length)];
    meta.seeds[s] = (meta.seeds[s] ?? 0) + 1;
    msg = `🌱 扭出花园种子【${PLANTS[s].name} ×1】！`;
  } else if (r < 0.88) {
    const mats: MaterialId[] = ['iron', 'magic_shard', 'wood', 'quirk_part', 'glow_glue'];
    const m = mats[Math.floor(Math.random() * mats.length)];
    meta.materials[m] = (meta.materials[m] ?? 0) + 4;
    msg = `📦 扭出锻造材料礼包（+4）！`;
  } else {
    // Classic Soul Knight bomb prank!
    isBomb = true;
    meta.gems += 250;
    msg = '💣 嘭！！扭出一颗恶作剧炸弹把客厅熏黑了！物业赔你 250 蓝币！';
  }

  saveMetaSave(meta);
  return { ok: true, msg, isBomb };
}

export function isWeaponForgeUnlocked(meta: MetaSave, wid: WeaponId): boolean {
  const def = WEAPONS[wid];
  if (def.rarity === 'red') return Boolean(meta.bossBlueprints[wid] || (meta.weaponsSeen[wid] ?? 0) >= 1);
  const need = def.rarity === 'white' || def.rarity === 'green' ? 5 : 8;
  return (meta.weaponsSeen[wid] ?? 0) >= need;
}

export function forgeWeapon(meta: MetaSave, wid: WeaponId): { ok: boolean; msg: string } {
  const def = WEAPONS[wid];
  if (!isWeaponForgeUnlocked(meta, wid)) return { ok: false, msg: '尚未在地牢中拾取足够次数解锁蓝图' };
  for (const [m, amt] of Object.entries(def.forgeCost)) {
    if ((meta.materials[m as MaterialId] ?? 0) < (amt ?? 0)) {
      return { ok: false, msg: '锻造材料不足！' };
    }
  }
  for (const [m, amt] of Object.entries(def.forgeCost)) {
    meta.materials[m as MaterialId] -= amt ?? 0;
  }
  meta.preparedWeapon = createWeaponInstance(wid);
  saveMetaSave(meta);
  return { ok: true, msg: `🔨 锻造成功！【${def.name}】已装备，下局直接带进地牢！` };
}

export function prePrintSticker(meta: MetaSave, sid: StickerId): { ok: boolean; msg: string } {
  const def = STICKERS[sid];
  if (def.rarity !== 'green' && def.rarity !== 'blue') {
    return { ok: false, msg: '预印台仅支持绿色/蓝色开局贴纸' };
  }
  if ((meta.stickersSeen[sid] ?? 0) < 3) {
    return { ok: false, msg: '需先在地牢发现该贴纸满 3 次解锁' };
  }
  if (meta.materials.glow_glue < 2) {
    return { ok: false, msg: '需要 2 瓶荧光胶水！' };
  }
  meta.materials.glow_glue -= 2;
  meta.preparedStickers = [sid];
  saveMetaSave(meta);
  return { ok: true, msg: `🏷️ 已预印【${def.name}】到开局初始武器！` };
}

export function isGardenPlotMature(plot: MetaSave['garden'][number]): boolean {
  if (!plot.unlocked || !plot.plantId || !plot.watered || plot.harvestedToday) return false;
  const today = todayDateString();
  return plot.plantedDay !== today || plot.runsSincePlanted >= 2;
}

export function unlockGardenPlot(meta: MetaSave, idx: number): { ok: boolean; msg: string } {
  const plot = meta.garden[idx];
  if (!plot || plot.unlocked) return { ok: false, msg: '地块已解锁' };
  const cost = 600 + (idx - 3) * 400;
  if (meta.gems < cost) return { ok: false, msg: `蓝币不足（需 ${cost} 蓝币）` };
  meta.gems -= cost;
  plot.unlocked = true;
  saveMetaSave(meta);
  return { ok: true, msg: `🌱 成功开辟第 ${idx + 1} 块魔法花盆！` };
}

export function plantSeedInPlot(meta: MetaSave, idx: number, plantId: PlantId): { ok: boolean; msg: string } {
  const plot = meta.garden[idx];
  if (!plot?.unlocked || plot.plantId) return { ok: false, msg: '该花盆不可种植' };
  if ((meta.seeds[plantId] ?? 0) <= 0) return { ok: false, msg: '该种子数量不足' };
  meta.seeds[plantId] -= 1;
  plot.plantId = plantId;
  plot.watered = true;
  plot.plantedDay = todayDateString();
  plot.runsSincePlanted = 0;
  plot.harvestedToday = false;
  saveMetaSave(meta);
  return { ok: true, msg: `💧 已种下【${PLANTS[plantId].name}】并浇水！完成 2 局或次日成熟！` };
}

export function harvestGardenPlot(meta: MetaSave, idx: number): { ok: boolean; msg: string } {
  const plot = meta.garden[idx];
  if (!plot || !isGardenPlotMature(plot) || !plot.plantId) {
    return { ok: false, msg: '植物尚未成熟（完成 2 局地牢或次日即可收获）' };
  }
  const def = PLANTS[plot.plantId];
  let msg = '';
  switch (plot.plantId) {
    case 'gem_tree':
      meta.gems += 320;
      msg = '🌳 收获蓝币发财树：+320 蓝币！';
      break;
    case 'iron_cactus':
      meta.materials.iron += 8;
      meta.materials.quirk_part += 4;
      msg = '🌵 收获铁矿仙人掌：铁矿×8 + 怪奇零件×4！';
      break;
    case 'fire_chili':
    case 'mandrake_poison':
    case 'frost_lotus':
      if (def.talentReward && !meta.preparedTalents.includes(def.talentReward)) {
        meta.preparedTalents.push(def.talentReward);
      }
      msg = `${def.icon} 采摘【${def.name}】：下局开局自带专属免疫天赋！`;
      break;
    case 'sticker_vine': {
      const sid = STICKER_IDS[Math.floor(Math.random() * STICKER_IDS.length)];
      meta.preparedStickers = [sid];
      msg = `🏷️ 采摘贴纸藤蔓：直接白嫖【${STICKERS[sid].name}】带进本！`;
      break;
    }
    case 'carrot_tree': {
      const w = createWeaponInstance('carrot_gatling');
      w.stickers.push('rapid_fire');
      meta.preparedWeapon = w;
      msg = '🥕 拔出【加特林大萝卜（自带鬼畜贴纸）】带出门！';
      break;
    }
    case 'lucky_clover':
      meta.preparedLucky = true;
      msg = '🍀 采摘幸运四叶草：下局获得【欧皇降临】高掉率祝福！';
      break;
  }

  if (def.perennial) {
    plot.plantedDay = todayDateString();
    plot.runsSincePlanted = 0;
    plot.watered = true;
    plot.harvestedToday = false;
  } else {
    plot.plantId = null;
    plot.watered = false;
    plot.plantedDay = null;
    plot.runsSincePlanted = 0;
  }

  saveMetaSave(meta);
  return { ok: true, msg };
}
