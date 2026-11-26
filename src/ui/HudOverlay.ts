import { BIOMES, DAILY_FACTORS } from '../content/biomes';
import { HEROES, PETS } from '../content/heroes';
import { RARITY_COLORS, STICKERS } from '../content/stickers';
import { WEAPONS } from '../content/weapons';
import { getWeaponMaxSlots } from '../sim/combat/attackPipeline';
import { MAX_WEAPON_VAULT, MetaSave, PickupState, WorldState } from '../sim/types';

export interface HudActions {
  onPause: () => void;
  onSelectWeapon: (idx: number) => void;
  onOpenBag: () => void;
  onOpenControls: () => void;
  onTeleportRoom: (roomId: string) => void;
  onGroundEquip: (pickupId: string) => void;
  onGroundStore: (pickupId: string) => void;
  onGroundRecycle: (pickupId: string) => void;
  // Simple Lobby actions (only 4 clean main buttons!)
  onLobbyStart: () => void;
  onLobbyResume: () => void;
  onLobbyHeroes: () => void;
  onLobbyCamp: () => void;
  onLobbyCellar: () => void;
}

export class HudOverlay {
  private root: HTMLElement;
  private toastContainer: HTMLDivElement;
  private toasts: Array<{ text: string; color: string; until: number }> = [];
  private mode: 'lobby' | 'dungeon' | null = null;
  private actions: HudActions;
  private lastGroundCardId: string | null = null;
  private lastWorldRef: WorldState | null = null;

  constructor(root: HTMLElement, actions: HudActions) {
    this.root = root;
    this.actions = actions;
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-feed';
  }

  pushToast(text: string, color = '#ffd54f'): void {
    this.toasts.push({ text, color, until: performance.now() + 3000 });
    if (this.toasts.length > 4) this.toasts.shift();
    this.renderToasts();
  }

  private renderToasts(): void {
    const now = performance.now();
    this.toasts = this.toasts.filter((t) => t.until > now);
    this.toastContainer.innerHTML = this.toasts
      .map((t) => `<div class="toast-item" style="border-color:${t.color};color:${t.color}">${t.text}</div>`)
      .join('');
  }

  /**
   * Super Clean Single-Screen Simple Lobby! No walking clutter, 1-second jump into adventure!
   */
  renderSimpleLobbyHud(meta: MetaSave, hasCheckpoint: boolean): void {
    if (this.mode !== 'lobby') {
      this.mode = 'lobby';
      this.root.innerHTML = `
        <div class="simple-lobby-wrap">
          <div class="lobby-left-card" id="lobby-hero-card"></div>
          <div class="lobby-right-menu">
            <div style="font-size:22px;font-weight:900;color:#ffd54f;text-shadow:0 2px 8px #000;margin-bottom:2px">
              ⚔️ 魔改骑士 <span style="font-size:12px;color:#80d8ff">v2.0 探索版</span>
            </div>
            ${hasCheckpoint ? `<button class="px-btn ok lobby-big-btn" id="btn-s-resume"><span>▶ 继续上次探险</span><span>💾</span></button>` : ''}
            <button class="px-btn primary lobby-big-btn" id="btn-s-start"><span>🚀 开始地牢探险</span><span>1-1 出发 →</span></button>
            <button class="px-btn lobby-big-btn" id="btn-s-heroes"><span>🧙 英雄与宠物</span><span style="font-size:12px;color:#b0bec5">6英雄 / 升级</span></button>
            <button class="px-btn lobby-big-btn" id="btn-s-camp"><span>⛺ 营地养成</span><span style="font-size:12px;color:#b0bec5">花园/锻造/扭蛋/每日</span></button>
            <button class="px-btn lobby-big-btn" id="btn-s-cellar"><span>🏆 图鉴 · 键位 · 存档</span><span style="font-size:12px;color:#b0bec5">设置</span></button>
          </div>
        </div>
      `;
      this.root.appendChild(this.toastContainer);
      this.root.querySelector('#btn-s-start')?.addEventListener('click', () => this.actions.onLobbyStart());
      this.root.querySelector('#btn-s-resume')?.addEventListener('click', () => this.actions.onLobbyResume());
      this.root.querySelector('#btn-s-heroes')?.addEventListener('click', () => this.actions.onLobbyHeroes());
      this.root.querySelector('#btn-s-camp')?.addEventListener('click', () => this.actions.onLobbyCamp());
      this.root.querySelector('#btn-s-cellar')?.addEventListener('click', () => this.actions.onLobbyCellar());
    }

    const h = HEROES[meta.selectedHero];
    const lv = meta.heroLevels[meta.selectedHero] ?? 1;
    const pet = PETS[meta.selectedPet];
    const card = this.root.querySelector('#lobby-hero-card');
    if (card) {
      card.innerHTML = `
        <div style="font-size:15px;font-weight:900;color:${h.color}">${h.name} · Lv.${lv}</div>
        <div style="font-size:12px;color:#cfd8dc;margin-top:2px">🐾 ${pet.name} · 💎 蓝币 <b>${meta.gems}</b></div>
        <div style="font-size:11px;color:#90a4ae;margin-top:4px">
          出门装：${meta.preparedWeapon ? WEAPONS[meta.preparedWeapon.defId].name : '初始武器'} ·
          预印贴纸：${meta.preparedStickers[0] ? STICKERS[meta.preparedStickers[0]].shortTag : '无'}
        </div>
      `;
    }
    this.renderToasts();
  }

  renderDungeonHud(world: WorldState, nearGroundWeapon: PickupState | null, exploration: { percent: number }): void {
    this.lastWorldRef = world;
    const p = world.players.p1;
    if (this.mode !== 'dungeon') {
      this.mode = 'dungeon';
      this.lastGroundCardId = null;
      this.root.innerHTML = `
        <div class="hud-top">
          <div class="hud-stats" id="dng-stats"></div>
          <div id="dng-boss-wrap"></div>
          <div class="hud-right">
            <div class="floor-badge" id="dng-floor"></div>
            <div class="minimap-box" title="点击已发现房间可快捷传送"><canvas id="minimap-canvas" width="90" height="76" style="cursor:pointer"></canvas></div>
            <button class="px-btn primary" id="btn-bag">🎒 仓库/贴纸</button>
            <button class="px-btn" id="btn-pause">⚙️</button>
          </div>
        </div>
        <div id="ground-card-slot"></div>
        <div class="weapon-strip" id="weapon-strip"></div>
      `;
      this.root.appendChild(this.toastContainer);
      this.root.querySelector('#btn-pause')?.addEventListener('click', () => this.actions.onPause());
      this.root.querySelector('#btn-bag')?.addEventListener('click', () => this.actions.onOpenBag());
      this.root.querySelector('#minimap-canvas')?.addEventListener('click', (ev) => {
        const w = this.lastWorldRef;
        if (!w) return;
        const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
        const cx = ((ev as MouseEvent).clientX - rect.left) * (90 / rect.width);
        const cy = ((ev as MouseEvent).clientY - rect.top) * (76 / rect.height);
        for (const r of w.map.rooms) {
          if (!r.discovered) continue;
          const rx = 4 + r.gx * 14;
          const ry = 4 + r.gy * 14;
          if (cx >= rx && cx <= rx + 12 && cy >= ry && cy <= ry + 12) {
            this.actions.onTeleportRoom(r.id);
            break;
          }
        }
      });
    }

    const effShieldMax = p.maxShield + (p.talents.includes('gold_armor') ? Math.min(3, Math.floor(p.coins / 100)) : 0);
    const statsEl = this.root.querySelector('#dng-stats')!;
    statsEl.innerHTML = `
      <div class="bar-row"><span>❤️</span><div class="bar-track"><div class="bar-fill bar-hp" style="width:${Math.max(0, (p.hp / p.maxHp) * 100)}%"></div></div><span>${p.hp}/${p.maxHp}</span></div>
      <div class="bar-row"><span>🛡️</span><div class="bar-track"><div class="bar-fill bar-shield" style="width:${Math.max(0, (p.shield / Math.max(1, effShieldMax)) * 100)}%"></div></div><span>${p.shield}/${effShieldMax}</span></div>
      <div class="bar-row"><span>⚡</span><div class="bar-track"><div class="bar-fill bar-mana" style="width:${Math.max(0, (p.mana / p.maxMana) * 100)}%"></div></div><span>${Math.floor(p.mana)}/${p.maxMana}</span></div>
      <div class="hud-meta-row">
        <span>💰 ${p.coins}</span>
        <span>🏷️ 包:${p.stickerBag.length}</span>
        <span>🎒 仓:${p.weaponVault.length}/${MAX_WEAPON_VAULT}</span>
        ${world.dailyFactors.length > 0 ? `<span>${world.dailyFactors.map((f) => DAILY_FACTORS[f].icon).join('')}</span>` : ''}
      </div>
    `;

    // Bag button badge
    const bagBtn = this.root.querySelector('#btn-bag')!;
    bagBtn.textContent = p.stickerBag.length > 0 ? `🎒 背包 (贴纸${p.stickerBag.length})` : '🎒 仓库/贴纸';

    // Floor & exploration badge
    const floorEl = this.root.querySelector('#dng-floor')!;
    floorEl.innerHTML = `
      <div style="color:#ffd54f">第 ${world.floor} 区 · ${BIOMES[world.biome].name}</div>
      <div style="font-size:11px;color:#80d8ff">🗺️ 探索度 ${exploration.percent}%</div>
    `;

    // Boss or Awake Bounty Boss HP Bar
    const boss = world.enemies.find((e) => (e.isBoss || (e.isBounty && e.bountyAwake)) && e.hp > 0);
    const bossWrap = this.root.querySelector('#dng-boss-wrap')!;
    if (boss) {
      bossWrap.innerHTML = `
        <div class="boss-bar-wrap">
          <div class="boss-bar-title">👑 ${boss.name} (${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp})</div>
          <div class="bar-track" style="height:10px"><div class="bar-fill bar-hp" style="width:${Math.max(0, (boss.hp / boss.maxHp) * 100)}%"></div></div>
        </div>
      `;
    } else if (world.bossBannerTimer > 0) {
      bossWrap.innerHTML = `<div class="boss-bar-wrap"><div class="boss-bar-title">⚠️ ${world.bossBannerName}</div></div>`;
    } else {
      bossWrap.innerHTML = '';
    }

    // Crisp Floating Ground Weapon Action Card (Equip / Store in Vault / Recycle for Gold!)
    const gId = nearGroundWeapon?.id ?? null;
    if (gId !== this.lastGroundCardId) {
      this.lastGroundCardId = gId;
      const slot = this.root.querySelector('#ground-card-slot')!;
      if (nearGroundWeapon && nearGroundWeapon.weapon) {
        const wd = WEAPONS[nearGroundWeapon.weapon.defId];
        slot.innerHTML = `
          <div class="ground-weapon-card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <b style="color:${RARITY_COLORS[wd.rarity]};font-size:14px">${wd.name}</b>
              <span style="font-size:11px;color:#ffd54f">伤${wd.damage} · 蓝耗${wd.manaCost}</span>
            </div>
            <div style="font-size:11px;color:#cfd8dc;margin-top:3px">${wd.desc}</div>
            <div class="ground-weapon-actions">
              <button class="px-btn primary" id="btn-gw-equip">⚔️ 直接装备</button>
              <button class="px-btn" id="btn-gw-store">🎒 存入仓库(${p.weaponVault.length}/${MAX_WEAPON_VAULT})</button>
              <button class="px-btn ok" id="btn-gw-recycle">♻️ 回收换金币</button>
            </div>
          </div>
        `;
        slot.querySelector('#btn-gw-equip')?.addEventListener('click', () => this.actions.onGroundEquip(nearGroundWeapon.id));
        slot.querySelector('#btn-gw-store')?.addEventListener('click', () => this.actions.onGroundStore(nearGroundWeapon.id));
        slot.querySelector('#btn-gw-recycle')?.addEventListener('click', () => this.actions.onGroundRecycle(nearGroundWeapon.id));
      } else {
        slot.innerHTML = '';
      }
    }

    // Bottom weapon strip
    const stripEl = this.root.querySelector('#weapon-strip')!;
    stripEl.innerHTML = p.weapons
      .map((w, idx) => {
        const def = WEAPONS[w.defId];
        const maxS = getWeaponMaxSlots(p, w, world.dailyFactors);
        const chips = w.stickers.map((sid) => `<span class="sticker-chip" style="background:${STICKERS[sid].color}">${STICKERS[sid].shortTag}</span>`).join('');
        const empties = '<span class="sticker-chip" style="background:#2b2340;color:#7d6ca8">空</span>'.repeat(Math.max(0, maxS - w.stickers.length));
        return `
          <div class="weapon-pill ${idx === p.activeWeaponIndex ? 'active' : ''}" data-widx="${idx}">
            <div style="color:${RARITY_COLORS[def.rarity]};font-weight:800">${def.name}</div>
            <div class="sticker-tags">${chips}${empties}</div>
          </div>
        `;
      })
      .join('');
    stripEl.querySelectorAll('[data-widx]').forEach((el) => {
      el.addEventListener('click', () => this.actions.onSelectWeapon(Number((el as HTMLElement).dataset.widx)));
    });

    this.drawMinimap(world);
    this.renderToasts();
  }

  private drawMinimap(world: WorldState): void {
    const canvas = this.root.querySelector('#minimap-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0d0a16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const r of world.map.rooms) {
      if (r.kind === 'secret' && !r.secretRevealed) continue;
      const x = 4 + r.gx * 14;
      const y = 4 + r.gy * 14;
      let col = '#455a64';
      if (r.id === world.activeRoomId) col = '#ffffff';
      else if (r.kind === 'boss') col = '#ff3b5c';
      else if (r.kind === 'bounty') col = '#ff9100';
      else if (r.kind === 'shop') col = '#69f0ae';
      else if (r.kind === 'portal') col = '#40c4ff';
      else if (r.kind === 'chest') col = '#ffd54f';
      else if (r.kind === 'curiosity') col = '#c77dff';
      else if (r.kind === 'secret') col = '#ff80ab';
      else if (r.cleared) col = '#4db6ac';

      ctx.fillStyle = r.discovered ? col : 'rgba(100, 100, 125, 0.35)';
      ctx.fillRect(x, y, 11, 11);
      if (r.id === world.activeRoomId) {
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, 11, 11);
      }
    }
  }
}
