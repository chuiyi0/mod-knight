import {
  ACHIEVEMENTS,
  BIOMES,
  DAILY_FACTORS,
  getDailyChallengeFactors,
  MATERIALS,
  PLANTS
} from '../content/biomes';
import { getHeroStatsAtLevel, HERO_LIST, HERO_UPGRADE_COSTS, HEROES, PET_LIST, PETS } from '../content/heroes';
import { RARITY_COLORS, RARITY_NAMES, STICKERS, STICKER_IDS } from '../content/stickers';
import { TALENTS } from '../content/talents';
import { ALL_WEAPON_IDS, WEAPONS } from '../content/weapons';
import { exportSaveCode, importSaveCode, saveMetaSave, todayDateString } from '../platform/storage';
import { getWeaponMaxSlots } from '../sim/combat/attackPipeline';
import {
  forgeWeapon,
  harvestGardenPlot,
  isGardenPlotMature,
  isWeaponForgeUnlocked,
  plantSeedInPlot,
  prePrintSticker,
  pullGacha,
  unlockGardenPlot,
  unlockOrSelectHero,
  unlockOrSelectPet,
  upgradeHero
} from '../sim/lobby';
import {
  DailyFactorId,
  HeroId,
  MaterialId,
  MetaSave,
  PlantId,
  RunCheckpoint,
  StickerId,
  TalentId,
  WeaponId
} from '../sim/types';
import { GameWorld } from '../sim/world';

export class ModalManager {
  private root: HTMLElement;
  private isOpenFlag = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  get isOpen(): boolean {
    return this.isOpenFlag;
  }

  close(): void {
    this.isOpenFlag = false;
    this.root.innerHTML = '';
  }

  private renderCard(title: string, bodyHtml: string, onClose?: () => void): HTMLElement {
    this.isOpenFlag = true;
    this.root.innerHTML = `
      <div class="modal-backdrop" id="modal-bg">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">${title}</div>
            ${onClose ? `<button class="px-btn" id="btn-modal-close">✕ 关闭</button>` : ''}
          </div>
          <div id="modal-body">${bodyHtml}</div>
        </div>
      </div>
    `;
    if (onClose) {
      this.root.querySelector('#btn-modal-close')?.addEventListener('click', () => {
        this.close();
        onClose();
      });
    }
    return this.root.querySelector('#modal-body') as HTMLElement;
  }

  // === DUNGEON MODALS ===

  openStickerOffer(world: GameWorld, onDone: () => void): void {
    const offer = world.state.pendingStickerOffer;
    if (!offer) return;
    const sd = STICKERS[offer.stickerId];
    const p = world.getMainPlayer();

    const weaponsHtml = p.weapons
      .map((w, idx) => {
        const wd = WEAPONS[w.defId];
        const maxS = getWeaponMaxSlots(p, w, world.state.dailyFactors);
        const dup = !world.state.endlessMode && w.stickers.includes(offer.stickerId);
        const full = w.stickers.length >= maxS;
        const chips = w.stickers.map((s) => `<span class="sticker-chip" style="background:${STICKERS[s].color}">${STICKERS[s].shortTag}</span>`).join('');
        return `
          <div class="item-card">
            <div class="item-card-title" style="color:${RARITY_COLORS[wd.rarity]}">${wd.name} (${w.stickers.length}/${maxS}槽)</div>
            <div class="sticker-tags">${chips || '<span style="font-size:11px;color:#90a4ae">暂无贴纸</span>'}</div>
            <button class="px-btn ${dup ? '' : 'primary'}" data-attach="${idx}" ${dup ? 'disabled' : ''}>
              ${dup ? '已有同款贴纸' : full ? '覆盖最后一张贴纸' : '🏷️ 贴在这把武器上'}
            </button>
          </div>
        `;
      })
      .join('');

    const body = this.renderCard(
      `🏷️ 发现魔改贴纸：【${sd.name}】`,
      `
        <div class="item-card" style="border-color:${sd.color};margin-bottom:12px">
          <div class="item-card-title" style="color:${sd.color}">[${RARITY_NAMES[sd.rarity]}] ${sd.name}（蓝耗修正: ${sd.manaDelta >= 0 ? '+' + sd.manaDelta : sd.manaDelta}）</div>
          <div class="item-card-desc">${sd.desc}</div>
        </div>
        <div class="grid-cards">${weaponsHtml}</div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end">
          <button class="px-btn" id="btn-scrap">💰 不要了，分解换 25 金币 + 荧光胶水</button>
        </div>
      `
    );

    body.querySelectorAll('[data-attach]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.attach);
        if (world.applyStickerToWeapon(idx)) {
          this.close();
          onDone();
        }
      });
    });
    body.querySelector('#btn-scrap')?.addEventListener('click', () => {
      world.scrapPendingSticker();
      this.close();
      onDone();
    });
  }

  openTalentChoice(world: GameWorld, onDone: () => void): void {
    const opts = world.state.pendingTalentOptions;
    if (!opts) return;
    const html = `
      <div class="grid-cards">
        ${opts
          .map((tid) => {
            const t = TALENTS[tid];
            return `
              <div class="item-card">
                <div class="item-card-title">${t.icon} ${t.name}</div>
                <div class="item-card-desc">${t.desc}</div>
                <button class="px-btn primary" data-talent="${tid}">选择此天赋</button>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
    const body = this.renderCard('✨ 过关奖励：请选择 1 项局内天赋', html);
    body.querySelectorAll('[data-talent]').forEach((btn) => {
      btn.addEventListener('click', () => {
        world.pickTalent((btn as HTMLElement).dataset.talent as TalentId);
        this.close();
        onDone();
      });
    });
  }

  openWorkshopShop(world: GameWorld, interactableId: string, onDone: () => void): void {
    const inter = world.state.interactables.find((i) => i.id === interactableId);
    if (!inter || !inter.shopItems) return;
    const p = world.getMainPlayer();

    const titleMap: Record<string, string> = {
      workshop_npc: '🏷️ 阿胶的贴纸魔改工坊',
      merchant_npc: '🛒 黑心奸商摊位（提示：攻击他可硬抢！）',
      demon_npc: '😈 恶魔诅咒祭坛（用生命上限换神器）',
      forge_npc: '🔨 猫头鹰铁匠重铸炉'
    };

    const itemsHtml = inter.shopItems
      .map((it) => {
        let detail = it.desc ?? it.label;
        if (it.stickerId) {
          const s = STICKERS[it.stickerId];
          detail = `<b style="color:${s.color}">${s.name}</b>：${s.desc}`;
        } else if (it.weapon) {
          const w = WEAPONS[it.weapon.defId];
          detail = `<b style="color:${RARITY_COLORS[w.rarity]}">${w.name}</b>：${w.desc}`;
        }
        const costText = it.hpCost ? `❤️ -${it.hpCost} 血上限` : `💰 ${it.price} 金币`;
        return `
          <div class="item-card">
            <div class="item-card-title">${it.label}</div>
            <div class="item-card-desc">${detail}</div>
            <button class="px-btn ${it.sold ? '' : 'primary'}" data-buy="${it.id}" ${it.sold ? 'disabled' : ''}>
              ${it.sold ? '已售罄' : `购买 (${costText})`}
            </button>
          </div>
        `;
      })
      .join('');

    const body = this.renderCard(
      `${titleMap[inter.kind] ?? '地牢商店'} · 当前金币 💰${p.coins} · 血上限 ❤️${p.maxHp}`,
      `<div class="grid-cards">${itemsHtml}</div>`,
      () => {
        world.closeWorkshopModal();
        onDone();
      }
    );

    body.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = (btn as HTMLElement).dataset.buy!;
        world.buyShopItem(interactableId, itemId);
        if (world.state.pendingStickerOffer) {
          this.openStickerOffer(world, onDone);
        } else {
          this.openWorkshopShop(world, interactableId, onDone);
        }
      });
    });
  }

  openDungeonBagAndPause(
    world: GameWorld,
    meta: MetaSave,
    opts: { onResume: () => void; onReturnLobby: () => void; onToggleSettings: () => void }
  ): void {
    const p = world.getMainPlayer();
    const wpns = p.weapons
      .map((w) => {
        const wd = WEAPONS[w.defId];
        const maxS = getWeaponMaxSlots(p, w, world.state.dailyFactors);
        const stList = w.stickers
          .map((s) => `<div style="font-size:11px;color:${STICKERS[s].color}">• ${STICKERS[s].name}：${STICKERS[s].desc}</div>`)
          .join('');
        return `
          <div class="item-card">
            <div class="item-card-title" style="color:${RARITY_COLORS[wd.rarity]}">${wd.name} (${w.stickers.length}/${maxS}槽)</div>
            <div class="item-card-desc">${wd.desc}</div>
            ${stList || '<div style="font-size:11px;color:#78909c">暂无贴纸</div>'}
          </div>
        `;
      })
      .join('');

    const talentsHtml =
      p.talents.map((t) => `<span class="sticker-chip" style="background:#372c54;color:#ffd54f;padding:3px 6px">${TALENTS[t].icon} ${TALENTS[t].name}</span>`).join(' ') ||
      '<span style="font-size:12px;color:#90a4ae">尚未获得局内天赋</span>';

    const body = this.renderCard(
      `⏸️ 装备魔改详情 & 暂停（${world.state.worldIndex}-${world.state.stageIndex} ${BIOMES[world.state.biome].name}）`,
      `
        <div class="grid-cards">${wpns}</div>
        <div style="margin:12px 0"><b>已选天赋：</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${talentsHtml}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="px-btn ok" id="btn-p-resume">▶ 继续战斗</button>
          <button class="px-btn" id="btn-p-sfx">🔊 音效: ${meta.settings.sfxEnabled ? '开' : '关'}</button>
          <button class="px-btn" id="btn-p-bgm">🎵 音乐: ${meta.settings.bgmEnabled ? '开' : '关'}</button>
          <button class="px-btn" id="btn-p-shake">📳 震屏: ${meta.settings.shakeEnabled ? '开' : '关'}</button>
          <button class="px-btn danger" id="btn-p-lobby">🏠 结算并返回豪华客厅</button>
        </div>
      `,
      opts.onResume
    );

    body.querySelector('#btn-p-resume')?.addEventListener('click', () => {
      this.close();
      opts.onResume();
    });
    body.querySelector('#btn-p-sfx')?.addEventListener('click', () => {
      meta.settings.sfxEnabled = !meta.settings.sfxEnabled;
      saveMetaSave(meta);
      opts.onToggleSettings();
      this.openDungeonBagAndPause(world, meta, opts);
    });
    body.querySelector('#btn-p-bgm')?.addEventListener('click', () => {
      meta.settings.bgmEnabled = !meta.settings.bgmEnabled;
      saveMetaSave(meta);
      opts.onToggleSettings();
      this.openDungeonBagAndPause(world, meta, opts);
    });
    body.querySelector('#btn-p-shake')?.addEventListener('click', () => {
      meta.settings.shakeEnabled = !meta.settings.shakeEnabled;
      saveMetaSave(meta);
      opts.onToggleSettings();
      this.openDungeonBagAndPause(world, meta, opts);
    });
    body.querySelector('#btn-p-lobby')?.addEventListener('click', () => {
      this.close();
      opts.onReturnLobby();
    });
  }

  openRunResult(
    world: GameWorld,
    won: boolean,
    settledGems: number,
    opts: { onRevive?: () => void; onEndless?: () => void; onLobby: () => void }
  ): void {
    const p = world.getMainPlayer();
    const wCert = p.weapons
      .map((w) => {
        const st = w.stickers.map((s) => `[${STICKERS[s].shortTag}]`).join('');
        return `<div>• <b>${WEAPONS[w.defId].name}</b> ${st}</div>`;
      })
      .join('');

    const body = this.renderCard(
      won ? '🏆 通关证书！魔法核心已夺回！' : '💀 冒险倒下了……但收获全部带回！',
      `
        <div class="item-card gold-frame" style="margin-bottom:12px">
          <div>抵达层数：<b>${world.state.worldIndex}-${world.state.stageIndex}（第 ${world.state.floor} 层）</b></div>
          <div>本局击杀：<b>${p.kills} 只怪物</b> · 结算蓝币：<b>+${settledGems} 💎</b></div>
          <div style="margin-top:6px"><b>本局魔改神兵配方：</b>${wCert}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${!won && !p.reviveUsed && opts.onRevive ? `<button class="px-btn ok" id="btn-revive">✨ 免费女神复活（本局限1次）</button>` : ''}
          ${won && opts.onEndless ? `<button class="px-btn primary" id="btn-endless">🔥 保留神装勇闯 4-1 无尽深渊！</button>` : ''}
          <button class="px-btn primary" id="btn-go-lobby">🏠 凯旋返回豪华客厅</button>
        </div>
      `
    );

    body.querySelector('#btn-revive')?.addEventListener('click', () => {
      this.close();
      opts.onRevive?.();
    });
    body.querySelector('#btn-endless')?.addEventListener('click', () => {
      this.close();
      opts.onEndless?.();
    });
    body.querySelector('#btn-go-lobby')?.addEventListener('click', () => {
      this.close();
      opts.onLobby();
    });
  }

  // === DELUXE LOBBY MODALS ===

  openPortalModal(
    meta: MetaSave,
    checkpoint: RunCheckpoint | null,
    opts: {
      onStartNormal: () => void;
      onStartDaily: () => void;
      onResume: () => void;
      onClose: () => void;
    }
  ): void {
    const today = todayDateString();
    const factors = getDailyChallengeFactors(today, meta.dailySeedOffset);
    const fHtml = factors.map((f) => `<span class="sticker-chip" style="background:${DAILY_FACTORS[f].positive ? '#69f0ae' : '#ff5277'}">${DAILY_FACTORS[f].icon}${DAILY_FACTORS[f].name}</span>`).join(' ');

    const body = this.renderCard(
      '🌀 地牢传送门 · 准备出征！',
      `
        <div class="item-card" style="margin-bottom:10px">
          <div>当前英雄：<b>${HEROES[meta.selectedHero].name} Lv.${meta.heroLevels[meta.selectedHero] ?? 1}</b> · 携带萌宠：<b>${PETS[meta.selectedPet].name}</b></div>
          <div style="font-size:12px;color:#b0bec5;margin-top:4px">
            出门锻造装：<b>${meta.preparedWeapon ? WEAPONS[meta.preparedWeapon.defId].name : '无'}</b> ·
            开局预印贴纸：<b>${meta.preparedStickers[0] ? STICKERS[meta.preparedStickers[0]].name : '无'}</b> ·
            花园天赋：<b>${meta.preparedTalents.length} 项</b>
          </div>
        </div>
        ${
          checkpoint
            ? `<div class="item-card gold-frame" style="margin-bottom:10px">
                <div class="item-card-title">💾 检测到未完成冒险断点（第 ${checkpoint.floor} 层 · ${HEROES[checkpoint.heroId].name}）</div>
                <button class="px-btn ok" id="btn-p-cont">▶ 继续上次冒险</button>
              </div>`
            : ''
        }
        <div class="grid-cards">
          <div class="item-card">
            <div class="item-card-title">⚔️ 经典 3 大关冒险（1-1 ~ 3-5）</div>
            <div class="item-card-desc">15 层完整地牢，随机双生态 + 16 奇遇房 + 3 位关底 Boss，通关可进无尽深渊！</div>
            <button class="px-btn primary" id="btn-p-normal">🚀 开始标准冒险</button>
          </div>
          <div class="item-card">
            <div class="item-card-title">📋 今日挑战模式（额外 +1500 蓝币）</div>
            <div class="item-card-desc"><div class="sticker-tags">${fHtml}</div></div>
            <button class="px-btn primary" id="btn-p-daily">🔥 接取每日挑战出发</button>
          </div>
        </div>
      `,
      opts.onClose
    );

    body.querySelector('#btn-p-cont')?.addEventListener('click', () => {
      this.close();
      opts.onResume();
    });
    body.querySelector('#btn-p-normal')?.addEventListener('click', () => {
      this.close();
      opts.onStartNormal();
    });
    body.querySelector('#btn-p-daily')?.addEventListener('click', () => {
      this.close();
      opts.onStartDaily();
    });
  }

  openHeroesModal(meta: MetaSave, focusHero: HeroId | undefined, onToast: (m: string) => void, onClose: () => void): void {
    const cards = HERO_LIST.map((h) => {
      const unlocked = meta.unlockedHeroes.includes(h.id);
      const selected = meta.selectedHero === h.id;
      const lv = meta.heroLevels[h.id] ?? 1;
      const stats = getHeroStatsAtLevel(h.id, lv);
      const upCost = lv < 7 ? HERO_UPGRADE_COSTS[lv] : 0;
      return `
        <div class="item-card ${selected || h.id === focusHero ? 'gold-frame' : ''}">
          <div class="item-card-title" style="color:${h.color}">${h.name} · Lv.${lv}/7 ${selected ? '✅出战中' : ''}</div>
          <div class="item-card-desc">
            血${stats.maxHp} / 盾${stats.maxShield} / 蓝${stats.maxMana}<br/>
            <b>技能【${h.skillName}】</b>：${h.skillDesc}<br/>
            <span style="color:#ffd54f">${h.passiveDesc}</span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="px-btn ${selected ? 'ok' : 'primary'}" data-sel-hero="${h.id}">
              ${selected ? '已出战' : unlocked ? '选择出战' : h.unlockCost < 0 ? '通关3-5解锁' : `解锁 (${h.unlockCost}💎)`}
            </button>
            ${
              unlocked && lv < 7
                ? `<button class="px-btn" data-up-hero="${h.id}">⬆️ 升级 (${upCost}💎)</button>`
                : ''
            }
          </div>
        </div>
      `;
    }).join('');

    const body = this.renderCard(`🧙 英雄客厅（蓝币 💎${meta.gems}）`, `<div class="grid-cards">${cards}</div>`, onClose);
    body.querySelectorAll('[data-sel-hero]').forEach((b) => {
      b.addEventListener('click', () => {
        const res = unlockOrSelectHero(meta, (b as HTMLElement).dataset.selHero as HeroId);
        onToast(res.msg);
        this.openHeroesModal(meta, undefined, onToast, onClose);
      });
    });
    body.querySelectorAll('[data-up-hero]').forEach((b) => {
      b.addEventListener('click', () => {
        const res = upgradeHero(meta, (b as HTMLElement).dataset.upHero as HeroId);
        onToast(res.msg);
        this.openHeroesModal(meta, undefined, onToast, onClose);
      });
    });
  }

  openPetsModal(meta: MetaSave, onToast: (m: string) => void, onClose: () => void): void {
    const cards = PET_LIST.map((p) => {
      const unlocked = meta.unlockedPets.includes(p.id);
      const selected = meta.selectedPet === p.id;
      return `
        <div class="item-card ${selected ? 'gold-frame' : ''}">
          <div class="item-card-title" style="color:${p.color}">🐾 ${p.name}</div>
          <div class="item-card-desc">${p.desc}<br/><span style="color:#ffd54f">${unlocked ? '已拥有' : p.unlockHint}</span></div>
          <button class="px-btn ${selected ? 'ok' : 'primary'}" data-pet="${p.id}">
            ${selected ? '✅ 携宠中' : unlocked ? '带它出战' : p.unlockCost > 0 ? `解锁 (${p.unlockCost}💎)` : '成就解锁'}
          </button>
        </div>
      `;
    }).join('');
    const body = this.renderCard(`🐾 客厅宠物窝（蓝币 💎${meta.gems}）`, `<div class="grid-cards">${cards}</div>`, onClose);
    body.querySelectorAll('[data-pet]').forEach((b) => {
      b.addEventListener('click', () => {
        const res = unlockOrSelectPet(meta, (b as HTMLElement).dataset.pet as typeof meta.selectedPet);
        onToast(res.msg);
        this.openPetsModal(meta, onToast, onClose);
      });
    });
  }

  openGardenModal(meta: MetaSave, onToast: (m: string) => void, onClose: () => void): void {
    const seedOpts = (Object.keys(PLANTS) as PlantId[])
      .filter((pid) => (meta.seeds[pid] ?? 0) > 0)
      .map((pid) => `<option value="${pid}">${PLANTS[pid].icon} ${PLANTS[pid].name} (余${meta.seeds[pid]})</option>`)
      .join('');

    const plotsHtml = meta.garden
      .map((plot, idx) => {
        if (!plot.unlocked) {
          const cost = 600 + (idx - 3) * 400;
          return `
            <div class="item-card">
              <div class="item-card-title">🔒 第 ${idx + 1} 块未开垦花盆</div>
              <div class="item-card-desc">开辟新地块种更多天赋植物！</div>
              <button class="px-btn primary" data-unlock-plot="${idx}">开垦 (${cost}💎)</button>
            </div>
          `;
        }
        if (!plot.plantId) {
          return `
            <div class="item-card">
              <div class="item-card-title">🟫 第 ${idx + 1} 块空花盆</div>
              <div class="item-card-desc">完成 2 局地牢或次日即可收获，无需苦等！</div>
              ${
                seedOpts
                  ? `<select id="seed-sel-${idx}" style="padding:4px;border-radius:4px;background:#1b1629;color:#fff">${seedOpts}</select>
                     <button class="px-btn ok" data-plant-plot="${idx}">🌱 种下并浇水</button>`
                  : `<div style="font-size:11px;color:#90a4ae">暂无种子（打Boss/许愿池/扭蛋获得）</div>`
              }
            </div>
          `;
        }
        const def = PLANTS[plot.plantId];
        const mature = isGardenPlotMature(plot);
        return `
          <div class="item-card ${mature ? 'gold-frame' : ''}">
            <div class="item-card-title">${def.icon} ${def.name} ${def.perennial ? '(多年生)' : ''}</div>
            <div class="item-card-desc">${def.desc}<br/>状态：${mature ? '<b style="color:#69f0ae">✨ 已成熟可采摘！</b>' : `成长中（已完成 ${plot.runsSincePlanted}/2 局，或明日成熟）`}</div>
            <button class="px-btn ${mature ? 'ok' : ''}" data-harvest-plot="${idx}" ${mature ? '' : 'disabled'}>
              ${mature ? '🌾 立即收获' : '生长中...'}
            </button>
          </div>
        `;
      })
      .join('');

    const body = this.renderCard(`🌱 魔法种植花园（6 块肥沃花盆 · 💎${meta.gems}）`, `<div class="grid-cards">${plotsHtml}</div>`, onClose);
    body.querySelectorAll('[data-unlock-plot]').forEach((b) => {
      b.addEventListener('click', () => {
        onToast(unlockGardenPlot(meta, Number((b as HTMLElement).dataset.unlockPlot)).msg);
        this.openGardenModal(meta, onToast, onClose);
      });
    });
    body.querySelectorAll('[data-plant-plot]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number((b as HTMLElement).dataset.plantPlot);
        const sel = body.querySelector(`#seed-sel-${idx}`) as HTMLSelectElement;
        if (sel) onToast(plantSeedInPlot(meta, idx, sel.value as PlantId).msg);
        this.openGardenModal(meta, onToast, onClose);
      });
    });
    body.querySelectorAll('[data-harvest-plot]').forEach((b) => {
      b.addEventListener('click', () => {
        onToast(harvestGardenPlot(meta, Number((b as HTMLElement).dataset.harvestPlot)).msg);
        this.openGardenModal(meta, onToast, onClose);
      });
    });
  }

  openForgeModal(meta: MetaSave, onToast: (m: string) => void, onClose: () => void): void {
    const matsBar = (Object.keys(MATERIALS) as MaterialId[])
      .map((m) => `<span>${MATERIALS[m].icon}${MATERIALS[m].name}:${meta.materials[m]}</span>`)
      .join(' · ');

    const cards = ALL_WEAPON_IDS.map((wid) => {
      const wd = WEAPONS[wid];
      const unlocked = isWeaponForgeUnlocked(meta, wid);
      const seen = meta.weaponsSeen[wid] ?? 0;
      const need = wd.rarity === 'red' ? 1 : wd.rarity === 'white' || wd.rarity === 'green' ? 5 : 8;
      const costStr = Object.entries(wd.forgeCost)
        .map(([m, amt]) => `${MATERIALS[m as MaterialId].icon}${amt}`)
        .join(' ');
      return `
        <div class="item-card ${meta.weaponsGoldFrame[wid] ? 'gold-frame' : ''}">
          <div class="item-card-title" style="color:${RARITY_COLORS[wd.rarity]}">${wd.name}</div>
          <div class="item-card-desc">${wd.desc}<br/>消耗：${costStr}</div>
          <button class="px-btn ${unlocked ? 'primary' : ''}" data-forge="${wid}" ${unlocked ? '' : 'disabled'}>
            ${unlocked ? '🔨 锻造带出门' : `拾取解锁 (${seen}/${need})`}
          </button>
        </div>
      `;
    }).join('');

    const body = this.renderCard(
      `🔨 武器锻造台（下局直接带进 1-1）`,
      `<div style="font-size:12px;margin-bottom:10px;color:#ffd54f">${matsBar}</div><div class="grid-cards">${cards}</div>`,
      onClose
    );
    body.querySelectorAll('[data-forge]').forEach((b) => {
      b.addEventListener('click', () => {
        onToast(forgeWeapon(meta, (b as HTMLElement).dataset.forge as WeaponId).msg);
        this.openForgeModal(meta, onToast, onClose);
      });
    });
  }

  openStickerBenchModal(meta: MetaSave, onToast: (m: string) => void, onClose: () => void): void {
    const eligible = STICKER_IDS.filter((id) => STICKERS[id].rarity === 'green' || STICKERS[id].rarity === 'blue');
    const cards = eligible
      .map((sid) => {
        const s = STICKERS[sid];
        const seen = meta.stickersSeen[sid] ?? 0;
        const ok = seen >= 3;
        return `
          <div class="item-card">
            <div class="item-card-title" style="color:${s.color}">🏷️ ${s.name}</div>
            <div class="item-card-desc">${s.desc}</div>
            <button class="px-btn ${ok ? 'primary' : ''}" data-pre="${sid}" ${ok ? '' : 'disabled'}>
              ${ok ? '预印开局 (🧴×2)' : `发现解锁 (${seen}/3)`}
            </button>
          </div>
        `;
      })
      .join('');
    const body = this.renderCard(
      `🏷️ 贴纸预印台（当前荧光胶水 🧴${meta.materials.glow_glue}）`,
      `<div class="grid-cards">${cards}</div>`,
      onClose
    );
    body.querySelectorAll('[data-pre]').forEach((b) => {
      b.addEventListener('click', () => {
        onToast(prePrintSticker(meta, (b as HTMLElement).dataset.pre as StickerId).msg);
        this.openStickerBenchModal(meta, onToast, onClose);
      });
    });
  }

  openGachaModal(meta: MetaSave, onToast: (m: string) => void, onClose: () => void, lastMsg = ''): void {
    const body = this.renderCard(
      `🎰 客厅蓝币像素扭蛋机（蓝币 💎${meta.gems}）`,
      `
        <div class="item-card gold-frame" style="margin-bottom:12px;text-align:center">
          <div style="font-size:34px">🎰</div>
          <div style="margin:6px 0;font-weight:800;color:#ffd54f">${lastMsg || '单抽 200 蓝币 · 10 抽保底出出门神兵！小心恶作剧炸弹彩蛋！'}</div>
          <div style="font-size:12px;color:#b0bec5">今日已抽：${meta.gachaPullsToday}/20 · 保底进度：${meta.gachaPity}/10</div>
          <button class="px-btn primary" id="btn-pull-gacha" style="margin-top:10px">🎲 投币 200 蓝币摇一次！</button>
        </div>
      `,
      onClose
    );
    body.querySelector('#btn-pull-gacha')?.addEventListener('click', () => {
      const res = pullGacha(meta);
      onToast(res.msg);
      this.openGachaModal(meta, onToast, onClose, res.msg);
    });
  }

  openDailyBoardModal(meta: MetaSave, onStartDaily: (factors: DailyFactorId[]) => void, onToast: (m: string) => void, onClose: () => void): void {
    const today = todayDateString();
    const factors = getDailyChallengeFactors(today, meta.dailySeedOffset);
    const done = meta.dailyCompletedDay === today;
    const cards = factors
      .map((f) => {
        const d = DAILY_FACTORS[f];
        return `
          <div class="item-card" style="border-color:${d.positive ? '#69f0ae' : '#ff5277'}">
            <div class="item-card-title">${d.icon} ${d.name} (${d.positive ? '爽点' : '挑战'})</div>
            <div class="item-card-desc">${d.desc}</div>
          </div>
        `;
      })
      .join('');

    const body = this.renderCard(
      `📋 每日挑战因子看板（${today}）`,
      `
        <div class="grid-cards">${cards}</div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="px-btn primary" id="btn-go-daily">🔥 接取挑战出发（首通 +1500💎）</button>
          <button class="px-btn" id="btn-reroll-daily" ${meta.dailyRerollsUsed >= 2 ? 'disabled' : ''}>🎲 重随因子 (200💎 · 剩余${2 - meta.dailyRerollsUsed}次)</button>
          ${done ? '<span style="color:#69f0ae;font-weight:800;align-self:center">✅ 今日挑战已通关！</span>' : ''}
        </div>
      `,
      onClose
    );

    body.querySelector('#btn-go-daily')?.addEventListener('click', () => {
      this.close();
      onStartDaily(factors);
    });
    body.querySelector('#btn-reroll-daily')?.addEventListener('click', () => {
      if (meta.gems < 200) {
        onToast('蓝币不足（需 200 蓝币）');
        return;
      }
      meta.gems -= 200;
      meta.dailyRerollsUsed++;
      meta.dailySeedOffset++;
      saveMetaSave(meta);
      onToast('🎲 已重新刷新今日 4 项挑战因子！');
      this.openDailyBoardModal(meta, onStartDaily, onToast, onClose);
    });
  }

  openCellarModal(meta: MetaSave, onClose: () => void, tab: 'weapons' | 'stickers' | 'bosses' | 'ach' = 'weapons'): void {
    let content = '';
    if (tab === 'weapons') {
      const seenCount = Object.keys(meta.weaponsSeen).length;
      const goldCount = Object.keys(meta.weaponsGoldFrame).length;
      content = `<div style="margin-bottom:8px;font-size:12px">武器图鉴：${seenCount}/${ALL_WEAPON_IDS.length} · 通关金框：${goldCount}</div><div class="grid-cards">` +
        ALL_WEAPON_IDS.map((id) => {
          const w = WEAPONS[id];
          const seen = (meta.weaponsSeen[id] ?? 0) > 0;
          const gold = Boolean(meta.weaponsGoldFrame[id]);
          return `
            <div class="item-card ${gold ? 'gold-frame' : ''}">
              <div class="item-card-title" style="color:${seen ? RARITY_COLORS[w.rarity] : '#607d8b'}">${seen ? w.name : '??? 未发现'} ${gold ? '🏆' : ''}</div>
              <div class="item-card-desc">${seen ? `${w.desc} (已捡 ${meta.weaponsSeen[id]} 次)` : '探索地牢解锁此脑洞武器'}</div>
            </div>
          `;
        }).join('') + `</div>`;
    } else if (tab === 'stickers') {
      content = `<div class="grid-cards">` +
        STICKER_IDS.map((id) => {
          const s = STICKERS[id];
          const seen = (meta.stickersSeen[id] ?? 0) > 0;
          return `
            <div class="item-card">
              <div class="item-card-title" style="color:${seen ? s.color : '#607d8b'}">${seen ? s.name : '??? 未发现贴纸'}</div>
              <div class="item-card-desc">${seen ? s.desc : '在宝箱/工坊/奇遇中发现'}</div>
            </div>
          `;
        }).join('') + `</div>`;
    } else if (tab === 'bosses') {
      const bosses = [
        { k: 'boss_goblin_priest', n: '1-5 哥布林大祭司' },
        { k: 'boss_yeti_king', n: '1-5 雪山大猿王' },
        { k: 'boss_skeleton_lord', n: '2-5 骷髅霸主' },
        { k: 'boss_steam_mech', n: '2-5 蒸汽重装机甲' },
        { k: 'boss_twin_dragon', n: '3-5 熔岩双头龙' },
        { k: 'boss_glitch_lord', n: '3-5 错乱程序主宰' },
        { k: 'boss_goose_king', n: '隐藏彩蛋 · 物业经理大鹅王' }
      ];
      content = `<div class="grid-cards">` +
        bosses.map((b) => {
          const kills = meta.bossKills[b.k] ?? 0;
          return `
            <div class="item-card ${kills > 0 ? 'gold-frame' : ''}">
              <div class="item-card-title">👑 ${b.n}</div>
              <div class="item-card-desc">历史击杀：<b>${kills} 次</b></div>
            </div>
          `;
        }).join('') + `</div>`;
    } else {
      content = `<div class="grid-cards">` +
        ACHIEVEMENTS.map((a) => {
          const done = Boolean(meta.achievements[a.id]);
          return `
            <div class="item-card ${done ? 'gold-frame' : ''}">
              <div class="item-card-title">${done ? '✅' : '🔒'} ${a.title} (+${a.rewardGems}💎)</div>
              <div class="item-card-desc">${a.desc}</div>
            </div>
          `;
        }).join('') + `</div>`;
    }

    const body = this.renderCard(
      '🏆 地下收藏陈列室',
      `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <button class="px-btn ${tab === 'weapons' ? 'primary' : ''}" data-ctab="weapons">⚔️ 37武器墙</button>
          <button class="px-btn ${tab === 'stickers' ? 'primary' : ''}" data-ctab="stickers">🏷️ 24贴纸墙</button>
          <button class="px-btn ${tab === 'bosses' ? 'primary' : ''}" data-ctab="bosses">👑 7大Boss奖杯</button>
          <button class="px-btn ${tab === 'ach' ? 'primary' : ''}" data-ctab="ach">🏅 整活成就</button>
        </div>
        ${content}
      `,
      onClose
    );
    body.querySelectorAll('[data-ctab]').forEach((b) => {
      b.addEventListener('click', () => {
        this.openCellarModal(meta, onClose, (b as HTMLElement).dataset.ctab as 'weapons' | 'stickers' | 'bosses' | 'ach');
      });
    });
  }

  openStatsAndSaveModal(meta: MetaSave, onImported: (m: MetaSave) => void, onToast: (m: string) => void, onClose: () => void): void {
    const code = exportSaveCode(meta);
    const body = this.renderCard(
      '📺 复古电视 · 战绩与离线存档备份码',
      `
        <div class="item-card" style="margin-bottom:10px">
          <div>总出征次数：<b>${meta.runsPlayed}</b> · 通关次数：<b>${meta.runsWon}</b> · 最高抵达层数：<b>第 ${meta.bestFloor} 层</b></div>
          <div style="font-size:12px;color:#b0bec5;margin-top:4px">换手机或重装 APK 前，复制下方存档码保存，即可零损恢复全部蓝币/英雄/图鉴！</div>
        </div>
        <textarea id="save-code-box" rows="3" style="width:100%;background:#120e1a;color:#69f0ae;border:1.5px solid #5c4f7d;border-radius:6px;padding:8px;font-size:11px">${code}</textarea>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="px-btn primary" id="btn-copy-save">📋 复制当前存档码</button>
          <button class="px-btn ok" id="btn-import-save">📥 从文本框导入恢复存档</button>
        </div>
      `,
      onClose
    );

    body.querySelector('#btn-copy-save')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(code).catch(() => {});
      onToast('📋 存档备份码已复制！');
    });
    body.querySelector('#btn-import-save')?.addEventListener('click', () => {
      const val = (body.querySelector('#save-code-box') as HTMLTextAreaElement).value;
      const imported = importSaveCode(val);
      if (imported) {
        onImported(imported);
        onToast('✅ 存档已成功导入恢复！');
        this.close();
        onClose();
      } else {
        onToast('❌ 存档码格式无效');
      }
    });
  }

  openLanTerminalModal(onClose: () => void): void {
    this.renderCard(
      '📡 Wi-Fi 局域网双人联机终端（架构已预留）',
      `
        <div class="item-card">
          <div class="item-card-title" style="color:#00e5ff">主机权威解耦架构就绪</div>
          <div class="item-card-desc">
            本作仿真核（<code>src/sim/world.ts</code>）已完全采用多玩家 <code>players</code> 字典、<code>InputCommand</code> 指令队列、确定性 <code>SeededRNG</code> 及 <code>LanTransport</code> 接口契约。<br/><br/>
            当前为单机离线完整版（零流量随时畅玩）；后续只需接入局域网 WebSocket 房间服务，即可与同 Wi-Fi 好友双人开黑魔改！
          </div>
        </div>
      `,
      onClose
    );
  }
}
