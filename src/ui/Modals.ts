import {
  ACHIEVEMENTS,
  BIOMES,
  DAILY_FACTORS,
  getDailyChallengeFactors,
  MATERIALS,
  PLANTS
} from '../content/biomes';
import { getHeroStatsAtLevel, HERO_LIST, HERO_UPGRADE_COSTS, HEROES, PET_LIST, PETS } from '../content/heroes';
import { RARITY_COLORS, STICKERS, STICKER_IDS } from '../content/stickers';
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
  MAX_WEAPON_VAULT,
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
  private selectedStickerBagIdx: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  get isOpen(): boolean {
    return this.isOpenFlag;
  }

  close(): void {
    this.isOpenFlag = false;
    this.selectedStickerBagIdx = null;
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

  // === DUNGEON: BIG VAULT + STICKER BAG + RECYCLE MODAL ===

  openVaultAndStickerBag(world: GameWorld, onClose: () => void): void {
    const p = world.getMainPlayer();
    const selIdx = this.selectedStickerBagIdx;
    const selSticker = selIdx !== null ? p.stickerBag[selIdx] : null;

    const renderWeaponBox = (w: typeof p.weapons[number], target: 'equipped' | 'vault', idx: number) => {
      const wd = WEAPONS[w.defId];
      const maxS = getWeaponMaxSlots(p, w, world.state.dailyFactors);
      const chips = w.stickers
        .map(
          (sid, sIdx) =>
            `<button class="sticker-chip" style="background:${STICKERS[sid].color};border:none;cursor:pointer" data-detach="${target}:${idx}:${sIdx}" title="点击免费撕回背包">
              ${STICKERS[sid].shortTag} ✕
            </button>`
        )
        .join('');
      return `
        <div class="item-card ${target === 'equipped' && idx === p.activeWeaponIndex ? 'gold-frame' : ''}">
          <div class="item-card-title" style="color:${RARITY_COLORS[wd.rarity]}">
            ${target === 'equipped' ? '⚔️ ' : '📦 '}${wd.name} (${w.stickers.length}/${maxS}槽)
          </div>
          <div class="item-card-desc">${wd.desc}</div>
          <div class="sticker-tags">${chips || '<span style="font-size:11px;color:#90a4ae">暂无贴纸（点击下方背包贴纸贴上）</span>'}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
            ${
              selSticker
                ? `<button class="px-btn primary" data-attach-to="${target}:${idx}">🏷️ 贴上【${STICKERS[selSticker].shortTag}】</button>`
                : ''
            }
            ${
              target === 'vault'
                ? `<button class="px-btn ok" data-vault-equip="${idx}">装备到手</button>
                   <button class="px-btn danger" data-vault-rec="${idx}">♻️ 回收</button>`
                : p.weapons.length > 1
                  ? `<button class="px-btn danger" data-eq-rec="${idx}">♻️ 回收</button>`
                  : ''
            }
          </div>
        </div>
      `;
    };

    const equippedHtml = p.weapons.map((w, i) => renderWeaponBox(w, 'equipped', i)).join('');
    const vaultHtml =
      p.weaponVault.length > 0
        ? p.weaponVault.map((w, i) => renderWeaponBox(w, 'vault', i)).join('')
        : '<div style="font-size:12px;color:#90a4ae">仓库空空的——走近地上武器可一键存入仓库备用或回收！</div>';

    const stickerBagHtml =
      p.stickerBag.length > 0
        ? p.stickerBag
            .map((sid, i) => {
              const s = STICKERS[sid];
              const isSel = i === selIdx;
              return `
                <div class="item-card ${isSel ? 'gold-frame' : ''}" style="border-color:${isSel ? '#ffd54f' : s.color}">
                  <div class="item-card-title" style="color:${s.color}">🏷️ ${s.name}</div>
                  <div class="item-card-desc">${s.desc}</div>
                  <div style="display:flex;gap:5px">
                    <button class="px-btn ${isSel ? 'ok' : 'primary'}" data-pick-st="${i}">${isSel ? '已选中↑点武器贴上' : '选中去贴'}</button>
                    <button class="px-btn" data-sell-st="${i}">💰 卖22金</button>
                  </div>
                </div>
              `;
            })
            .join('')
        : '<div style="font-size:12px;color:#90a4ae">贴纸背包为空（拾取贴纸自动入包，点武器上已有贴纸可免费撕回背包重组！）</div>';

    const body = this.renderCard(
      `🎒 大仓库 & 魔改贴纸背包 · 金币 💰${p.coins}`,
      `
        <div style="font-size:12px;color:#80d8ff;margin-bottom:8px">
          💡 <b>自由魔改指南</b>：点下方任意贴纸「选中去贴」，再点上方武器即可贴上；点击武器上的贴纸标签 ✕ 可<b>免费无损撕回背包</b>！
        </div>
        <h4 style="margin:6px 0;color:#ffd54f">⚔️ 手持武器 (${p.weapons.length})</h4>
        <div class="grid-cards">${equippedHtml}</div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 6px">
          <h4 style="margin:0;color:#80d8ff">📦 备用武器仓库 (${p.weaponVault.length}/${MAX_WEAPON_VAULT})</h4>
          ${p.weaponVault.length > 0 ? `<button class="px-btn ok" id="btn-rec-all">♻️ 一键回收全部备用武器</button>` : ''}
        </div>
        <div class="grid-cards">${vaultHtml}</div>

        <h4 style="margin:12px 0 6px;color:#c77dff">🏷️ 贴纸背包 (${p.stickerBag.length} 张)</h4>
        <div class="grid-cards">${stickerBagHtml}</div>
      `,
      onClose
    );

    body.querySelectorAll('[data-pick-st]').forEach((b) => {
      b.addEventListener('click', () => {
        const i = Number((b as HTMLElement).dataset.pickSt);
        this.selectedStickerBagIdx = this.selectedStickerBagIdx === i ? null : i;
        this.openVaultAndStickerBag(world, onClose);
      });
    });
    body.querySelectorAll('[data-sell-st]').forEach((b) => {
      b.addEventListener('click', () => {
        world.sellBagSticker(Number((b as HTMLElement).dataset.sellSt));
        this.selectedStickerBagIdx = null;
        this.openVaultAndStickerBag(world, onClose);
      });
    });
    body.querySelectorAll('[data-attach-to]').forEach((b) => {
      b.addEventListener('click', () => {
        if (this.selectedStickerBagIdx === null) return;
        const [t, idxStr] = (b as HTMLElement).dataset.attachTo!.split(':');
        if (world.attachBagStickerToWeapon(this.selectedStickerBagIdx, t as 'equipped' | 'vault', Number(idxStr))) {
          this.selectedStickerBagIdx = null;
        }
        this.openVaultAndStickerBag(world, onClose);
      });
    });
    body.querySelectorAll('[data-detach]').forEach((b) => {
      b.addEventListener('click', () => {
        const [t, wIdx, sIdx] = (b as HTMLElement).dataset.detach!.split(':');
        world.detachStickerToBag(t as 'equipped' | 'vault', Number(wIdx), Number(sIdx));
        this.openVaultAndStickerBag(world, onClose);
      });
    });
    body.querySelectorAll('[data-vault-equip]').forEach((b) => {
      b.addEventListener('click', () => {
        world.equipFromVault(Number((b as HTMLElement).dataset.vaultEquip));
        this.openVaultAndStickerBag(world, onClose);
      });
    });
    body.querySelectorAll('[data-vault-rec]').forEach((b) => {
      b.addEventListener('click', () => {
        world.recycleVaultWeapon(Number((b as HTMLElement).dataset.vaultRec));
        this.openVaultAndStickerBag(world, onClose);
      });
    });
    body.querySelectorAll('[data-eq-rec]').forEach((b) => {
      b.addEventListener('click', () => {
        world.recycleEquippedWeapon(Number((b as HTMLElement).dataset.eqRec));
        this.openVaultAndStickerBag(world, onClose);
      });
    });
    body.querySelector('#btn-rec-all')?.addEventListener('click', () => {
      world.recycleAllVaultWeapons();
      this.openVaultAndStickerBag(world, onClose);
    });
  }

  // === CUSTOM CONTROLS EDITOR (Touch Drag + Scale + Swap Hands + PC Keybindings) ===

  openControlsEditor(meta: MetaSave, onApply: () => void, onToast: (m: string) => void, onClose: () => void): void {
    const s = meta.settings;
    const kb = s.keyBindings;
    const body = this.renderCard(
      '🎮 自定义键位与触屏布局',
      `
        <div class="item-card" style="margin-bottom:10px">
          <div class="item-card-title">📱 手机触屏布局调整</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0">
            <label style="font-size:12px">按钮缩放：<b>${Math.round(s.buttonScale * 100)}%</b></label>
            <input id="rng-scale" type="range" min="0.75" max="1.35" step="0.05" value="${s.buttonScale}" style="flex:1" />
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <button class="px-btn ${s.swapHands ? 'primary' : ''}" id="btn-swap-hands">🔄 左右手互换：${s.swapHands ? '左手攻击/右手摇杆' : '左手摇杆/右手攻击'}</button>
            <button class="px-btn" id="btn-reset-pos">↩️ 重置默认位置</button>
          </div>
          <div style="margin-top:10px;font-size:12px;color:#80d8ff">微调三键位置（每点一次移动 12px，实时生效）：</div>
          <div class="grid-cards" style="margin-top:6px">
            ${(['fire', 'skill', 'switch'] as const)
              .map((k) => {
                const name = k === 'fire' ? '⚔️ 攻击键' : k === 'skill' ? '⚡ 技能键' : '🔄 切枪键';
                const off = s.touchOffsets[k];
                return `
                  <div class="item-card">
                    <div style="font-size:12px;font-weight:800">${name} (${off.x}, ${off.y})</div>
                    <div style="display:flex;gap:4px;flex-wrap:wrap">
                      <button class="px-btn" data-nudge="${k}:0:-12">↑</button>
                      <button class="px-btn" data-nudge="${k}:0:12">↓</button>
                      <button class="px-btn" data-nudge="${k}:-12:0">←</button>
                      <button class="px-btn" data-nudge="${k}:12:0">→</button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="item-card">
          <div class="item-card-title">⌨️ 电脑键盘自定义改键（点击按钮后按新键）</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <button class="px-btn" data-rebind="fire">攻击：<b>${kb.fire.toUpperCase()}</b></button>
            <button class="px-btn" data-rebind="interact">互动：<b>${kb.interact.toUpperCase()}</b></button>
            <button class="px-btn" data-rebind="skill">技能：<b>${kb.skill.toUpperCase()}</b></button>
            <button class="px-btn" data-rebind="switch">切枪：<b>${kb.switch.toUpperCase()}</b></button>
            <button class="px-btn" data-rebind="bag">背包：<b>${kb.bag.toUpperCase()}</b></button>
          </div>
        </div>
      `,
      onClose
    );

    body.querySelector('#rng-scale')?.addEventListener('input', (e) => {
      s.buttonScale = Number((e.target as HTMLInputElement).value);
      saveMetaSave(meta);
      onApply();
      this.openControlsEditor(meta, onApply, onToast, onClose);
    });
    body.querySelector('#btn-swap-hands')?.addEventListener('click', () => {
      s.swapHands = !s.swapHands;
      saveMetaSave(meta);
      onApply();
      onToast(s.swapHands ? '已切换为左手攻击 / 右手摇杆' : '已切换为左手摇杆 / 右手攻击');
      this.openControlsEditor(meta, onApply, onToast, onClose);
    });
    body.querySelector('#btn-reset-pos')?.addEventListener('click', () => {
      s.buttonScale = 1.0;
      s.swapHands = false;
      s.touchOffsets = { fire: { x: 0, y: 0 }, skill: { x: 0, y: 0 }, switch: { x: 0, y: 0 } };
      s.keyBindings = { fire: 'j', interact: 'f', skill: 'k', switch: 'q', bag: 'tab' };
      saveMetaSave(meta);
      onApply();
      onToast('✅ 已恢复全部默认键位！');
      this.openControlsEditor(meta, onApply, onToast, onClose);
    });
    body.querySelectorAll('[data-nudge]').forEach((b) => {
      b.addEventListener('click', () => {
        const [k, dx, dy] = (b as HTMLElement).dataset.nudge!.split(':');
        const key = k as 'fire' | 'skill' | 'switch';
        s.touchOffsets[key].x = Math.max(-140, Math.min(100, s.touchOffsets[key].x + Number(dx)));
        s.touchOffsets[key].y = Math.max(-140, Math.min(80, s.touchOffsets[key].y + Number(dy)));
        saveMetaSave(meta);
        onApply();
        this.openControlsEditor(meta, onApply, onToast, onClose);
      });
    });
    body.querySelectorAll('[data-rebind]').forEach((b) => {
      b.addEventListener('click', () => {
        const action = (b as HTMLElement).dataset.rebind as keyof typeof kb;
        b.textContent = '请按任意新键...';
        const handler = (ev: KeyboardEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          kb[action] = ev.key.toLowerCase();
          saveMetaSave(meta);
          onApply();
          window.removeEventListener('keydown', handler, true);
          onToast(`⌨️ 已改键为 [${ev.key.toUpperCase()}]`);
          this.openControlsEditor(meta, onApply, onToast, onClose);
        };
        window.addEventListener('keydown', handler, true);
      });
    });
  }

  // === DUNGEON TALENT / SHOP / PAUSE / RESULT ===

  openTalentChoice(world: GameWorld, onDone: () => void): void {
    const opts = world.state.pendingTalentOptions;
    if (!opts) return;
    const html = `<div class="grid-cards">${opts
      .map((tid) => {
        const t = TALENTS[tid];
        return `<div class="item-card"><div class="item-card-title">${t.icon} ${t.name}</div><div class="item-card-desc">${t.desc}</div><button class="px-btn primary" data-talent="${tid}">选择此天赋</button></div>`;
      })
      .join('')}</div>`;
    const body = this.renderCard('✨ 旅途成长：请选择 1 项天赋', html);
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
      workshop_npc: '🏷️ 贴纸工坊（买了直接进贴纸背包！）',
      merchant_npc: '🛒 旅途集市商店（金币随便花！）',
      demon_npc: '😈 恶魔交易坛（自愿换神装）',
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
      `${titleMap[inter.kind] ?? '旅途商店'} · 金币 💰${p.coins} · 血上限 ❤️${p.maxHp}`,
      `<div class="grid-cards">${itemsHtml}</div>`,
      () => {
        world.closeWorkshopModal();
        onDone();
      }
    );

    body.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        world.buyShopItem(interactableId, (btn as HTMLElement).dataset.buy!);
        this.openWorkshopShop(world, interactableId, onDone);
      });
    });
  }

  openPauseMenu(
    world: GameWorld,
    meta: MetaSave,
    opts: { onResume: () => void; onReturnLobby: () => void; onToggleSettings: () => void; onOpenControls: () => void }
  ): void {
    const p = world.getMainPlayer();
    const talentsHtml =
      p.talents.map((t) => `<span class="sticker-chip" style="background:#372c54;color:#ffd54f;padding:3px 6px">${TALENTS[t].icon} ${TALENTS[t].name}</span>`).join(' ') ||
      '<span style="font-size:12px;color:#90a4ae">尚未获得局内天赋</span>';

    const body = this.renderCard(
      `⚙️ 暂停与设置（第 ${world.state.floor} 区 · ${BIOMES[world.state.biome].name}）`,
      `
        <div style="margin-bottom:12px"><b>已选天赋：</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${talentsHtml}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="px-btn ok" id="btn-p-resume">▶ 继续探险</button>
          <button class="px-btn primary" id="btn-p-ctrl">🎮 自定义键位与按钮布局</button>
          <button class="px-btn" id="btn-p-sfx">🔊 音效: ${meta.settings.sfxEnabled ? '开' : '关'}</button>
          <button class="px-btn" id="btn-p-bgm">🎵 音乐: ${meta.settings.bgmEnabled ? '开' : '关'}</button>
          <button class="px-btn" id="btn-p-shake">📳 震屏: ${meta.settings.shakeEnabled ? '开' : '关'}</button>
          <button class="px-btn danger" id="btn-p-lobby">🏠 结算回首页</button>
        </div>
      `,
      opts.onResume
    );

    body.querySelector('#btn-p-resume')?.addEventListener('click', () => { this.close(); opts.onResume(); });
    body.querySelector('#btn-p-ctrl')?.addEventListener('click', () => opts.onOpenControls());
    body.querySelector('#btn-p-sfx')?.addEventListener('click', () => { meta.settings.sfxEnabled = !meta.settings.sfxEnabled; saveMetaSave(meta); opts.onToggleSettings(); this.openPauseMenu(world, meta, opts); });
    body.querySelector('#btn-p-bgm')?.addEventListener('click', () => { meta.settings.bgmEnabled = !meta.settings.bgmEnabled; saveMetaSave(meta); opts.onToggleSettings(); this.openPauseMenu(world, meta, opts); });
    body.querySelector('#btn-p-shake')?.addEventListener('click', () => { meta.settings.shakeEnabled = !meta.settings.shakeEnabled; saveMetaSave(meta); opts.onToggleSettings(); this.openPauseMenu(world, meta, opts); });
    body.querySelector('#btn-p-lobby')?.addEventListener('click', () => { this.close(); opts.onReturnLobby(); });
  }

  openRunResult(world: GameWorld, won: boolean, settledGems: number, opts: { onRevive?: () => void; onEndless?: () => void; onLobby: () => void }): void {
    const p = world.getMainPlayer();
    const wCert = p.weapons.map((w) => `<div>• <b>${WEAPONS[w.defId].name}</b> ${w.stickers.map((s) => `[${STICKERS[s].shortTag}]`).join('')}</div>`).join('');
    const body = this.renderCard(
      won ? '🏆 通关证书！魔法核心已夺回！' : '💀 探险结束……所有蓝币材料全部带回！',
      `
        <div class="item-card gold-frame" style="margin-bottom:12px">
          <div>抵达进度：<b>第 ${world.state.floor} 区（${BIOMES[world.state.biome].name}）</b></div>
          <div>击杀怪物：<b>${p.kills}</b> · 结算蓝币：<b>+${settledGems} 💎</b></div>
          <div style="margin-top:6px"><b>神兵配方：</b>${wCert}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${!won && !p.reviveUsed && opts.onRevive ? `<button class="px-btn ok" id="btn-revive">✨ 免费女神复活（本局限1次）</button>` : ''}
          ${won && opts.onEndless ? `<button class="px-btn primary" id="btn-endless">🔥 保留神装勇闯无尽模式！</button>` : ''}
          <button class="px-btn primary" id="btn-go-lobby">🏠 返回主页</button>
        </div>
      `
    );
    body.querySelector('#btn-revive')?.addEventListener('click', () => { this.close(); opts.onRevive?.(); });
    body.querySelector('#btn-endless')?.addEventListener('click', () => { this.close(); opts.onEndless?.(); });
    body.querySelector('#btn-go-lobby')?.addEventListener('click', () => { this.close(); opts.onLobby(); });
  }

  // === SIMPLE LOBBY UNIFIED MODALS ===

  openStartModal(meta: MetaSave, checkpoint: RunCheckpoint | null, opts: { onStartNormal: () => void; onStartDaily: (f: DailyFactorId[]) => void; onResume: () => void; onClose: () => void }): void {
    const today = todayDateString();
    const factors = getDailyChallengeFactors(today, meta.dailySeedOffset);
    const fHtml = factors.map((f) => `<span class="sticker-chip" style="background:${DAILY_FACTORS[f].positive ? '#69f0ae' : '#ff5277'}">${DAILY_FACTORS[f].icon}${DAILY_FACTORS[f].name}</span>`).join(' ');

    const body = this.renderCard(
      '🚀 准备出发探险！',
      `
        ${checkpoint ? `<div class="item-card gold-frame" style="margin-bottom:10px"><div class="item-card-title">💾 未完成断点（第 ${checkpoint.floor} 区 · ${HEROES[checkpoint.heroId].name}）</div><button class="px-btn ok" id="btn-p-cont">▶ 继续上次探险</button></div>` : ''}
        <div class="grid-cards">
          <div class="item-card">
            <div class="item-card-title">🗺️ 自由探索之旅（无死胡同）</div>
            <div class="item-card-desc">多传送门自由挑选新生态、每图必刷商店、每3图1位大Boss + 野外悬赏头领！</div>
            <button class="px-btn primary" id="btn-p-normal">⚔️ 立刻出发</button>
          </div>
          <div class="item-card">
            <div class="item-card-title">📋 今日挑战因子（+1500💎）</div>
            <div class="item-card-desc"><div class="sticker-tags">${fHtml}</div></div>
            <button class="px-btn primary" id="btn-p-daily">🔥 接取每日挑战</button>
          </div>
        </div>
      `,
      opts.onClose
    );
    body.querySelector('#btn-p-cont')?.addEventListener('click', () => { this.close(); opts.onResume(); });
    body.querySelector('#btn-p-normal')?.addEventListener('click', () => { this.close(); opts.onStartNormal(); });
    body.querySelector('#btn-p-daily')?.addEventListener('click', () => { this.close(); opts.onStartDaily(factors); });
  }

  openHeroesAndPetsHub(meta: MetaSave, onToast: (m: string) => void, onClose: () => void, tab: 'heroes' | 'pets' = 'heroes'): void {
    let content = '';
    if (tab === 'heroes') {
      content = `<div class="grid-cards">${HERO_LIST.map((h) => {
        const unlocked = meta.unlockedHeroes.includes(h.id);
        const selected = meta.selectedHero === h.id;
        const lv = meta.heroLevels[h.id] ?? 1;
        const stats = getHeroStatsAtLevel(h.id, lv);
        const upCost = lv < 7 ? HERO_UPGRADE_COSTS[lv] : 0;
        return `
          <div class="item-card ${selected ? 'gold-frame' : ''}">
            <div class="item-card-title" style="color:${h.color}">${h.name} · Lv.${lv}/7 ${selected ? '✅' : ''}</div>
            <div class="item-card-desc">血${stats.maxHp}/盾${stats.maxShield}/蓝${stats.maxMana}<br/><b>${h.skillName}</b>：${h.skillDesc}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="px-btn ${selected ? 'ok' : 'primary'}" data-sel-hero="${h.id}">${selected ? '出战中' : unlocked ? '选择' : h.unlockCost < 0 ? '通关解锁' : `解锁(${h.unlockCost}💎)`}</button>
              ${unlocked && lv < 7 ? `<button class="px-btn" data-up-hero="${h.id}">⬆️升级(${upCost}💎)</button>` : ''}
            </div>
          </div>
        `;
      }).join('')}</div>`;
    } else {
      content = `<div class="grid-cards">${PET_LIST.map((p) => {
        const unlocked = meta.unlockedPets.includes(p.id);
        const selected = meta.selectedPet === p.id;
        return `
          <div class="item-card ${selected ? 'gold-frame' : ''}">
            <div class="item-card-title" style="color:${p.color}">🐾 ${p.name}</div>
            <div class="item-card-desc">${p.desc}<br/><span style="color:#ffd54f">${unlocked ? '已拥有' : p.unlockHint}</span></div>
            <button class="px-btn ${selected ? 'ok' : 'primary'}" data-pet="${p.id}">${selected ? '✅ 携宠中' : unlocked ? '携带' : p.unlockCost > 0 ? `解锁(${p.unlockCost}💎)` : '成就解锁'}</button>
          </div>
        `;
      }).join('')}</div>`;
    }

    const body = this.renderCard(
      `🧙 英雄与宠物 · 蓝币 💎${meta.gems}`,
      `
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button class="px-btn ${tab === 'heroes' ? 'primary' : ''}" data-htab="heroes">🧙 6 位英雄</button>
          <button class="px-btn ${tab === 'pets' ? 'primary' : ''}" data-htab="pets">🐾 6 只宠物</button>
        </div>
        ${content}
      `,
      onClose
    );
    body.querySelectorAll('[data-htab]').forEach((b) => b.addEventListener('click', () => this.openHeroesAndPetsHub(meta, onToast, onClose, (b as HTMLElement).dataset.htab as 'heroes' | 'pets')));
    body.querySelectorAll('[data-sel-hero]').forEach((b) => b.addEventListener('click', () => { onToast(unlockOrSelectHero(meta, (b as HTMLElement).dataset.selHero as HeroId).msg); this.openHeroesAndPetsHub(meta, onToast, onClose, 'heroes'); }));
    body.querySelectorAll('[data-up-hero]').forEach((b) => b.addEventListener('click', () => { onToast(upgradeHero(meta, (b as HTMLElement).dataset.upHero as HeroId).msg); this.openHeroesAndPetsHub(meta, onToast, onClose, 'heroes'); }));
    body.querySelectorAll('[data-pet]').forEach((b) => b.addEventListener('click', () => { onToast(unlockOrSelectPet(meta, (b as HTMLElement).dataset.pet as typeof meta.selectedPet).msg); this.openHeroesAndPetsHub(meta, onToast, onClose, 'pets'); }));
  }

  /** Unified Camp Progression Hub: Garden / Forge / Sticker Pre-Print / Gacha / Daily */
  openCampHub(
    meta: MetaSave,
    onStartDaily: (f: DailyFactorId[]) => void,
    onToast: (m: string) => void,
    onClose: () => void,
    tab: 'garden' | 'forge' | 'sticker' | 'gacha' | 'daily' = 'garden',
    lastGachaMsg = ''
  ): void {
    let content = '';
    if (tab === 'garden') {
      const seedOpts = (Object.keys(PLANTS) as PlantId[]).filter((pid) => (meta.seeds[pid] ?? 0) > 0).map((pid) => `<option value="${pid}">${PLANTS[pid].icon} ${PLANTS[pid].name} (余${meta.seeds[pid]})</option>`).join('');
      content = `<div class="grid-cards">${meta.garden.map((plot, idx) => {
        if (!plot.unlocked) {
          const cost = 600 + (idx - 3) * 400;
          return `<div class="item-card"><div class="item-card-title">🔒 第 ${idx + 1} 块花盆</div><div class="item-card-desc">开垦新花盆种天赋植物</div><button class="px-btn primary" data-unlock-plot="${idx}">开垦 (${cost}💎)</button></div>`;
        }
        if (!plot.plantId) {
          return `<div class="item-card"><div class="item-card-title">🟫 第 ${idx + 1} 块空花盆</div>${seedOpts ? `<select id="seed-sel-${idx}" style="padding:4px;border-radius:4px;background:#1b1629;color:#fff">${seedOpts}</select><button class="px-btn ok" data-plant-plot="${idx}">🌱 种下浇水</button>` : '<div class="item-card-desc">暂无种子</div>'}</div>`;
        }
        const def = PLANTS[plot.plantId];
        const mature = isGardenPlotMature(plot);
        return `<div class="item-card ${mature ? 'gold-frame' : ''}"><div class="item-card-title">${def.icon} ${def.name}</div><div class="item-card-desc">${def.desc}<br/>${mature ? '<b style="color:#69f0ae">✨ 已成熟！</b>' : `进度 ${plot.runsSincePlanted}/2 局`}</div><button class="px-btn ${mature ? 'ok' : ''}" data-harvest-plot="${idx}" ${mature ? '' : 'disabled'}>${mature ? '🌾 收获' : '生长中'}</button></div>`;
      }).join('')}</div>`;
    } else if (tab === 'forge') {
      const matsBar = (Object.keys(MATERIALS) as MaterialId[]).map((m) => `${MATERIALS[m].icon}${meta.materials[m]}`).join(' · ');
      content = `<div style="font-size:12px;margin-bottom:8px;color:#ffd54f">材料：${matsBar}</div><div class="grid-cards">${ALL_WEAPON_IDS.map((wid) => {
        const wd = WEAPONS[wid];
        const unlocked = isWeaponForgeUnlocked(meta, wid);
        const seen = meta.weaponsSeen[wid] ?? 0;
        const need = wd.rarity === 'red' ? 1 : wd.rarity === 'white' || wd.rarity === 'green' ? 5 : 8;
        const costStr = Object.entries(wd.forgeCost).map(([m, amt]) => `${MATERIALS[m as MaterialId].icon}${amt}`).join(' ');
        return `<div class="item-card"><div class="item-card-title" style="color:${RARITY_COLORS[wd.rarity]}">${wd.name}</div><div class="item-card-desc">${wd.desc}<br/>耗材：${costStr}</div><button class="px-btn ${unlocked ? 'primary' : ''}" data-forge="${wid}" ${unlocked ? '' : 'disabled'}>${unlocked ? '🔨 锻造带出门' : `拾取解锁(${seen}/${need})`}</button></div>`;
      }).join('')}</div>`;
    } else if (tab === 'sticker') {
      const eligible = STICKER_IDS.filter((id) => STICKERS[id].rarity === 'green' || STICKERS[id].rarity === 'blue');
      content = `<div style="font-size:12px;margin-bottom:8px;color:#69f0ae">荧光胶水 🧴${meta.materials.glow_glue}（消耗2瓶预印开局贴纸）</div><div class="grid-cards">${eligible.map((sid) => {
        const s = STICKERS[sid];
        const seen = meta.stickersSeen[sid] ?? 0;
        return `<div class="item-card"><div class="item-card-title" style="color:${s.color}">🏷️ ${s.name}</div><div class="item-card-desc">${s.desc}</div><button class="px-btn ${seen >= 3 ? 'primary' : ''}" data-pre="${sid}" ${seen >= 3 ? '' : 'disabled'}>${seen >= 3 ? '预印开局 (🧴×2)' : `发现解锁(${seen}/3)`}</button></div>`;
      }).join('')}</div>`;
    } else if (tab === 'gacha') {
      content = `<div class="item-card gold-frame" style="text-align:center"><div style="font-size:34px">🎰</div><div style="margin:6px 0;font-weight:800;color:#ffd54f">${lastGachaMsg || '200蓝币单抽 · 10抽保底出出门神兵！'}</div><div style="font-size:12px;color:#b0bec5">今日：${meta.gachaPullsToday}/20 · 保底：${meta.gachaPity}/10</div><button class="px-btn primary" id="btn-pull-gacha" style="margin-top:10px">🎲 摇一次 (200💎)</button></div>`;
    } else {
      const today = todayDateString();
      const factors = getDailyChallengeFactors(today, meta.dailySeedOffset);
      content = `<div class="grid-cards">${factors.map((f) => `<div class="item-card" style="border-color:${DAILY_FACTORS[f].positive ? '#69f0ae' : '#ff5277'}"><div class="item-card-title">${DAILY_FACTORS[f].icon} ${DAILY_FACTORS[f].name}</div><div class="item-card-desc">${DAILY_FACTORS[f].desc}</div></div>`).join('')}</div><div style="margin-top:10px;display:flex;gap:8px"><button class="px-btn primary" id="btn-go-daily">🔥 接取每日挑战出发</button><button class="px-btn" id="btn-reroll-daily" ${meta.dailyRerollsUsed >= 2 ? 'disabled' : ''}>🎲 重随 (200💎)</button></div>`;
    }

    const body = this.renderCard(
      `⛺ 营地养成中心 · 蓝币 💎${meta.gems}`,
      `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <button class="px-btn ${tab === 'garden' ? 'primary' : ''}" data-ct="garden">🌱 魔法花园</button>
          <button class="px-btn ${tab === 'forge' ? 'primary' : ''}" data-ct="forge">🔨 锻造台</button>
          <button class="px-btn ${tab === 'sticker' ? 'primary' : ''}" data-ct="sticker">🏷️ 贴纸预印</button>
          <button class="px-btn ${tab === 'gacha' ? 'primary' : ''}" data-ct="gacha">🎰 扭蛋机</button>
          <button class="px-btn ${tab === 'daily' ? 'primary' : ''}" data-ct="daily">📋 每日挑战</button>
        </div>
        ${content}
      `,
      onClose
    );

    body.querySelectorAll('[data-ct]').forEach((b) => b.addEventListener('click', () => this.openCampHub(meta, onStartDaily, onToast, onClose, (b as HTMLElement).dataset.ct as typeof tab)));
    body.querySelectorAll('[data-unlock-plot]').forEach((b) => b.addEventListener('click', () => { onToast(unlockGardenPlot(meta, Number((b as HTMLElement).dataset.unlockPlot)).msg); this.openCampHub(meta, onStartDaily, onToast, onClose, 'garden'); }));
    body.querySelectorAll('[data-plant-plot]').forEach((b) => b.addEventListener('click', () => { const idx = Number((b as HTMLElement).dataset.plantPlot); const sel = body.querySelector(`#seed-sel-${idx}`) as HTMLSelectElement; if (sel) onToast(plantSeedInPlot(meta, idx, sel.value as PlantId).msg); this.openCampHub(meta, onStartDaily, onToast, onClose, 'garden'); }));
    body.querySelectorAll('[data-harvest-plot]').forEach((b) => b.addEventListener('click', () => { onToast(harvestGardenPlot(meta, Number((b as HTMLElement).dataset.harvestPlot)).msg); this.openCampHub(meta, onStartDaily, onToast, onClose, 'garden'); }));
    body.querySelectorAll('[data-forge]').forEach((b) => b.addEventListener('click', () => { onToast(forgeWeapon(meta, (b as HTMLElement).dataset.forge as WeaponId).msg); this.openCampHub(meta, onStartDaily, onToast, onClose, 'forge'); }));
    body.querySelectorAll('[data-pre]').forEach((b) => b.addEventListener('click', () => { onToast(prePrintSticker(meta, (b as HTMLElement).dataset.pre as StickerId).msg); this.openCampHub(meta, onStartDaily, onToast, onClose, 'sticker'); }));
    body.querySelector('#btn-pull-gacha')?.addEventListener('click', () => { const r = pullGacha(meta); onToast(r.msg); this.openCampHub(meta, onStartDaily, onToast, onClose, 'gacha', r.msg); });
    body.querySelector('#btn-go-daily')?.addEventListener('click', () => { this.close(); onStartDaily(getDailyChallengeFactors(todayDateString(), meta.dailySeedOffset)); });
    body.querySelector('#btn-reroll-daily')?.addEventListener('click', () => { if (meta.gems < 200) { onToast('蓝币不足'); return; } meta.gems -= 200; meta.dailyRerollsUsed++; meta.dailySeedOffset++; saveMetaSave(meta); this.openCampHub(meta, onStartDaily, onToast, onClose, 'daily'); });
  }

  /** Unified Cellar + Controls + Save Backup Hub */
  openCellarAndSettingsHub(
    meta: MetaSave,
    opts: { onImported: (m: MetaSave) => void; onApplyControls: () => void; onToast: (m: string) => void; onClose: () => void },
    tab: 'weapons' | 'stickers' | 'bosses' | 'ach' | 'save' = 'weapons'
  ): void {
    let content = '';
    if (tab === 'weapons') {
      content = `<div class="grid-cards">${ALL_WEAPON_IDS.map((id) => {
        const w = WEAPONS[id];
        const seen = (meta.weaponsSeen[id] ?? 0) > 0;
        return `<div class="item-card ${meta.weaponsGoldFrame[id] ? 'gold-frame' : ''}"><div class="item-card-title" style="color:${seen ? RARITY_COLORS[w.rarity] : '#607d8b'}">${seen ? w.name : '??? 未发现'} ${meta.weaponsGoldFrame[id] ? '🏆' : ''}</div><div class="item-card-desc">${seen ? w.desc : '探索新地图解锁'}</div></div>`;
      }).join('')}</div>`;
    } else if (tab === 'stickers') {
      content = `<div class="grid-cards">${STICKER_IDS.map((id) => {
        const s = STICKERS[id];
        const seen = (meta.stickersSeen[id] ?? 0) > 0;
        return `<div class="item-card"><div class="item-card-title" style="color:${seen ? s.color : '#607d8b'}">${seen ? s.name : '???'}</div><div class="item-card-desc">${seen ? s.desc : '探索地牢解锁'}</div></div>`;
      }).join('')}</div>`;
    } else if (tab === 'bosses') {
      const bosses = [
        { k: 'boss_goblin_priest', n: '哥布林大祭司' },
        { k: 'boss_yeti_king', n: '雪山大猿王' },
        { k: 'boss_skeleton_lord', n: '骷髅霸主' },
        { k: 'boss_steam_mech', n: '蒸汽重装机甲' },
        { k: 'boss_twin_dragon', n: '熔岩双头龙' },
        { k: 'boss_glitch_lord', n: '错乱程序主宰' },
        { k: 'boss_goose_king', n: '隐藏 · 物业经理大鹅王' }
      ];
      content = `<div class="grid-cards">${bosses.map((b) => `<div class="item-card ${(meta.bossKills[b.k] ?? 0) > 0 ? 'gold-frame' : ''}"><div class="item-card-title">👑 ${b.n}</div><div class="item-card-desc">击杀次数：<b>${meta.bossKills[b.k] ?? 0}</b></div></div>`).join('')}</div>`;
    } else if (tab === 'ach') {
      content = `<div class="grid-cards">${ACHIEVEMENTS.map((a) => `<div class="item-card ${meta.achievements[a.id] ? 'gold-frame' : ''}"><div class="item-card-title">${meta.achievements[a.id] ? '✅' : '🔒'} ${a.title} (+${a.rewardGems}💎)</div><div class="item-card-desc">${a.desc}</div></div>`).join('')}</div>`;
    } else {
      const code = exportSaveCode(meta);
      content = `
        <div class="item-card" style="margin-bottom:10px">
          <div>出征：<b>${meta.runsPlayed}</b> · 通关：<b>${meta.runsWon}</b> · 最远：<b>第 ${meta.bestFloor} 区</b></div>
          <div style="margin-top:8px"><button class="px-btn primary" id="btn-open-ctrl">🎮 自定义键位 / 触屏按钮位置与大小</button></div>
        </div>
        <textarea id="save-code-box" rows="3" style="width:100%;background:#120e1a;color:#69f0ae;border:1.5px solid #5c4f7d;border-radius:6px;padding:8px;font-size:11px">${code}</textarea>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button class="px-btn primary" id="btn-copy-save">📋 复制存档码</button>
          <button class="px-btn ok" id="btn-import-save">📥 导入恢复存档</button>
        </div>
      `;
    }

    const body = this.renderCard(
      '🏆 图鉴 · 自定义键位 · 存档备份',
      `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <button class="px-btn ${tab === 'weapons' ? 'primary' : ''}" data-ctab="weapons">⚔️ 37武器</button>
          <button class="px-btn ${tab === 'stickers' ? 'primary' : ''}" data-ctab="stickers">🏷️ 24贴纸</button>
          <button class="px-btn ${tab === 'bosses' ? 'primary' : ''}" data-ctab="bosses">👑 7大Boss</button>
          <button class="px-btn ${tab === 'ach' ? 'primary' : ''}" data-ctab="ach">🏅 成就</button>
          <button class="px-btn ${tab === 'save' ? 'primary' : ''}" data-ctab="save">🎮 键位与存档</button>
        </div>
        ${content}
      `,
      opts.onClose
    );

    body.querySelectorAll('[data-ctab]').forEach((b) => b.addEventListener('click', () => this.openCellarAndSettingsHub(meta, opts, (b as HTMLElement).dataset.ctab as typeof tab)));
    body.querySelector('#btn-open-ctrl')?.addEventListener('click', () => {
      this.openControlsEditor(meta, opts.onApplyControls, opts.onToast, () => this.openCellarAndSettingsHub(meta, opts, 'save'));
    });
    body.querySelector('#btn-copy-save')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(exportSaveCode(meta)).catch(() => {});
      opts.onToast('📋 存档码已复制！');
    });
    body.querySelector('#btn-import-save')?.addEventListener('click', () => {
      const val = (body.querySelector('#save-code-box') as HTMLTextAreaElement).value;
      const imported = importSaveCode(val);
      if (imported) { opts.onImported(imported); opts.onToast('✅ 存档导入成功！'); this.close(); opts.onClose(); }
      else opts.onToast('❌ 存档码无效');
    });
  }
}

export { PETS };
