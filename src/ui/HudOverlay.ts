import { BIOMES, DAILY_FACTORS } from '../content/biomes';
import { HEROES, PETS } from '../content/heroes';
import { RARITY_COLORS, STICKERS } from '../content/stickers';
import { WEAPONS } from '../content/weapons';
import { getWeaponMaxSlots } from '../sim/combat/attackPipeline';
import { LobbyStationKind } from '../sim/lobby';
import { MetaSave, WorldState } from '../sim/types';

export interface HudActions {
  onPause: () => void;
  onSelectWeapon: (idx: number) => void;
  onOpenBag: () => void;
  onLobbyQuickAction: (kind: LobbyStationKind) => void;
  onResumeCheckpoint?: () => void;
}

export class HudOverlay {
  private root: HTMLElement;
  private toastContainer: HTMLDivElement;
  private toasts: Array<{ text: string; color: string; until: number }> = [];
  private mode: 'lobby' | 'dungeon' | null = null;
  private actions: HudActions;

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

  renderLobbyHud(meta: MetaSave, hasCheckpoint: boolean): void {
    if (this.mode !== 'lobby') {
      this.mode = 'lobby';
      this.root.innerHTML = `
        <div class="hud-top">
          <div class="hud-stats" id="lobby-top-stats"></div>
          <div class="hud-right">
            ${hasCheckpoint ? `<button class="px-btn ok" id="btn-hud-resume">▶ 继续上次冒险</button>` : ''}
            <button class="px-btn primary" id="btn-hud-start">🌀 立刻下地牢</button>
          </div>
        </div>
        <div class="lobby-shortcuts" id="lobby-shortcuts">
          <button class="px-btn" data-warp="hero_npc">🧙 英雄/升级</button>
          <button class="px-btn" data-warp="pet_bed">🐾 宠物</button>
          <button class="px-btn" data-warp="garden">🌱 魔法花园</button>
          <button class="px-btn" data-warp="forge">🔨 锻造台</button>
          <button class="px-btn" data-warp="sticker_bench">🏷️ 贴纸预印</button>
          <button class="px-btn" data-warp="gacha">🎰 扭蛋机</button>
          <button class="px-btn" data-warp="daily_board">📋 每日挑战</button>
          <button class="px-btn" data-warp="cellar">🏆 地下室图鉴</button>
          <button class="px-btn" data-warp="tv_stats">📺 存档/统计</button>
        </div>
      `;
      this.root.appendChild(this.toastContainer);

      this.root.querySelector('#btn-hud-start')?.addEventListener('click', () => this.actions.onLobbyQuickAction('portal'));
      this.root.querySelector('#btn-hud-resume')?.addEventListener('click', () => this.actions.onResumeCheckpoint?.());
      this.root.querySelectorAll('[data-warp]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const kind = (btn as HTMLElement).dataset.warp as LobbyStationKind;
          this.actions.onLobbyQuickAction(kind);
        });
      });
    }

    const h = HEROES[meta.selectedHero];
    const lv = meta.heroLevels[meta.selectedHero] ?? 1;
    const pet = PETS[meta.selectedPet];
    const prepW = meta.preparedWeapon ? WEAPONS[meta.preparedWeapon.defId].name : '无';
    const prepS = meta.preparedStickers.length > 0 ? STICKERS[meta.preparedStickers[0]].shortTag : '无';
    const statsEl = this.root.querySelector('#lobby-top-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div style="font-size:13px;font-weight:800;color:#ffd54f">🏰 魔改骑士 · 豪华魔法客厅</div>
        <div style="font-size:11px;margin-top:3px">出战：<b>${h.name} Lv.${lv}</b> + <b>${pet.name}</b></div>
        <div class="hud-meta-row">
          <span>💎 蓝币 ${meta.gems}</span>
          <span>🔨 出门装: ${prepW}</span>
          <span>🏷️ 预印: ${prepS}</span>
        </div>
      `;
    }
    this.renderToasts();
  }

  renderDungeonHud(world: WorldState): void {
    const p = world.players.p1;
    if (this.mode !== 'dungeon') {
      this.mode = 'dungeon';
      this.root.innerHTML = `
        <div class="hud-top">
          <div class="hud-stats" id="dng-stats"></div>
          <div id="dng-boss-wrap"></div>
          <div class="hud-right">
            <div class="floor-badge" id="dng-floor"></div>
            <div class="minimap-box"><canvas id="minimap-canvas" width="76" height="76"></canvas></div>
            <button class="px-btn" id="btn-bag">🏷️ 贴纸</button>
            <button class="px-btn" id="btn-pause">⏸️</button>
          </div>
        </div>
        <div class="weapon-strip" id="weapon-strip"></div>
      `;
      this.root.appendChild(this.toastContainer);
      this.root.querySelector('#btn-pause')?.addEventListener('click', () => this.actions.onPause());
      this.root.querySelector('#btn-bag')?.addEventListener('click', () => this.actions.onOpenBag());
    }

    const effShieldMax = p.maxShield + (p.talents.includes('gold_armor') ? Math.min(3, Math.floor(p.coins / 100)) : 0);
    const statsEl = this.root.querySelector('#dng-stats')!;
    statsEl.innerHTML = `
      <div class="bar-row"><span>❤️</span><div class="bar-track"><div class="bar-fill bar-hp" style="width:${Math.max(0, (p.hp / p.maxHp) * 100)}%"></div></div><span>${p.hp}/${p.maxHp}</span></div>
      <div class="bar-row"><span>🛡️</span><div class="bar-track"><div class="bar-fill bar-shield" style="width:${Math.max(0, (p.shield / Math.max(1, effShieldMax)) * 100)}%"></div></div><span>${p.shield}/${effShieldMax}</span></div>
      <div class="bar-row"><span>⚡</span><div class="bar-track"><div class="bar-fill bar-mana" style="width:${Math.max(0, (p.mana / p.maxMana) * 100)}%"></div></div><span>${Math.floor(p.mana)}/${p.maxMana}</span></div>
      <div class="hud-meta-row">
        <span>💰 ${p.coins}</span>
        <span>☠️ ${p.kills}</span>
        ${world.dailyFactors.length > 0 ? `<span>📋 ${world.dailyFactors.map((f) => DAILY_FACTORS[f].icon).join('')}</span>` : ''}
      </div>
    `;

    // Floor badge
    const floorEl = this.root.querySelector('#dng-floor')!;
    const bName = BIOMES[world.biome].name;
    floorEl.innerHTML = `
      <div style="color:#ffd54f">${world.endlessMode ? '无尽 ' : ''}${world.worldIndex}-${world.stageIndex}</div>
      <div style="font-size:10px;color:#b0bec5">${bName}</div>
    `;

    // Boss HP Bar
    const boss = world.enemies.find((e) => e.isBoss && e.hp > 0);
    const bossWrap = this.root.querySelector('#dng-boss-wrap')!;
    if (boss) {
      bossWrap.innerHTML = `
        <div class="boss-bar-wrap">
          <div class="boss-bar-title">👑 ${boss.name} (${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp})</div>
          <div class="bar-track" style="height:10px"><div class="bar-fill bar-hp" style="width:${Math.max(0, (boss.hp / boss.maxHp) * 100)}%"></div></div>
        </div>
      `;
    } else if (world.bossBannerTimer > 0) {
      bossWrap.innerHTML = `
        <div class="boss-bar-wrap">
          <div class="boss-bar-title">⚠️ ${world.bossBannerName}</div>
        </div>
      `;
    } else {
      bossWrap.innerHTML = '';
    }

    // Weapon strip
    const stripEl = this.root.querySelector('#weapon-strip')!;
    stripEl.innerHTML = p.weapons
      .map((w, idx) => {
        const def = WEAPONS[w.defId];
        const maxS = getWeaponMaxSlots(p, w, world.dailyFactors);
        const chips = w.stickers
          .map((sid) => `<span class="sticker-chip" style="background:${STICKERS[sid].color}">${STICKERS[sid].shortTag}</span>`)
          .join('');
        const emptyCount = Math.max(0, maxS - w.stickers.length);
        const empties = '<span class="sticker-chip" style="background:#2b2340;color:#7d6ca8">空槽</span>'.repeat(emptyCount);
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

    // Minimap
    this.drawMinimap(world);
    this.renderToasts();
  }

  private drawMinimap(world: WorldState): void {
    const canvas = this.root.querySelector('#minimap-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0d0a16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cell = 13;
    const off = 5;
    for (const r of world.map.rooms) {
      if (r.kind === 'secret' && !r.secretRevealed) continue;
      const x = off + r.gx * cell;
      const y = off + r.gy * cell;
      let col = '#455a64';
      if (r.id === world.activeRoomId) col = '#ffffff';
      else if (r.kind === 'boss') col = '#ff3b5c';
      else if (r.kind === 'portal') col = '#40c4ff';
      else if (r.kind === 'chest') col = '#ffd54f';
      else if (r.kind === 'curiosity') col = '#c77dff';
      else if (r.kind === 'secret') col = '#ff80ab';
      else if (r.cleared) col = '#69f0ae';

      ctx.fillStyle = r.discovered ? col : 'rgba(90, 90, 110, 0.35)';
      ctx.fillRect(x, y, 10, 10);
      if (r.id === world.activeRoomId) {
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, 10, 10);
      }
    }
  }
}
