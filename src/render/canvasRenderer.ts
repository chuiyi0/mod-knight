import { BIOMES } from '../content/biomes';
import { HEROES, PETS } from '../content/heroes';
import { RARITY_COLORS, STICKERS } from '../content/stickers';
import { WEAPONS } from '../content/weapons';
import { LobbyState } from '../sim/lobby';
import {
  EnemyState,
  MetaSave,
  TILE_SIZE,
  TileType,
  WorldState
} from '../sim/types';
import { getEnemySprite, getHeroSprite, getPetSprite } from './pixelSprites';

export class PixelCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camX = 0;
  private camY = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  public shakeEnabled = true;

  private logicalHeight = 270;
  private logicalWidth = 480;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize(): void {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(200, window.innerHeight);
    const aspect = w / h;
    // Extend horizontal FOV cleanly on 20:9 modern Android screens!
    this.logicalHeight = 270;
    this.logicalWidth = Math.max(380, Math.min(600, Math.round(this.logicalHeight * aspect)));
    this.canvas.width = this.logicalWidth;
    this.canvas.height = this.logicalHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  triggerShake(intensity: number, duration: number): void {
    if (!this.shakeEnabled) return;
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  renderDungeon(world: WorldState, dt: number): void {
    const ctx = this.ctx;
    const p1 = world.players.p1;
    const bdef = BIOMES[world.biome];

    // Smooth camera follow
    const targetX = p1.x - this.logicalWidth / 2;
    const targetY = p1.y - this.logicalHeight / 2;
    if (this.camX === 0 && this.camY === 0) {
      this.camX = targetX;
      this.camY = targetY;
    } else {
      this.camX += (targetX - this.camX) * Math.min(1, dt * 9);
      this.camY += (targetY - this.camY) * Math.min(1, dt * 9);
    }

    let ox = 0;
    let oy = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      ox = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      oy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      if (this.shakeTimer === 0) this.shakeIntensity = 0;
    }

    const vx = Math.round(this.camX + ox);
    const vy = Math.round(this.camY + oy);

    // Clear background
    ctx.fillStyle = '#0f0c16';
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    ctx.save();
    ctx.translate(-vx, -vy);

    // 1. Visible Tilemap
    const minTx = Math.max(0, Math.floor(vx / TILE_SIZE) - 1);
    const maxTx = Math.min(world.map.width - 1, Math.ceil((vx + this.logicalWidth) / TILE_SIZE) + 1);
    const minTy = Math.max(0, Math.floor(vy / TILE_SIZE) - 1);
    const maxTy = Math.min(world.map.height - 1, Math.ceil((vy + this.logicalHeight) / TILE_SIZE) + 1);
    const showCrackedGlow = p1.talents.includes('curiosity_sense');

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const tile = world.map.tiles[ty * world.map.width + tx] as TileType;
        if (tile === TileType.VOID) continue;
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        if (tile === TileType.FLOOR || tile === TileType.DOOR_OPEN) {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? bdef.floorColor : bdef.floorAltColor;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          if (tile === TileType.DOOR_OPEN) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }
        } else if (tile === TileType.ICE) {
          ctx.fillStyle = '#4fc3f7';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(px + 2, py + 3, 6, 2);
        } else if (tile === TileType.LAVA) {
          ctx.fillStyle = Math.sin(world.time * 4 + tx) > 0 ? '#ff5722' : '#ff9800';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (tile === TileType.CONVEYOR_R) {
          ctx.fillStyle = '#455a64';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          const arrowOff = Math.floor(world.time * 24) % 8;
          ctx.fillStyle = '#ffb74d';
          ctx.fillRect(px + arrowOff, py + 6, 4, 4);
        } else if (tile === TileType.WALL || tile === TileType.CRACKED_WALL) {
          ctx.fillStyle = bdef.wallColor;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = bdef.wallTopColor;
          ctx.fillRect(px, py, TILE_SIZE, 5);
          ctx.fillStyle = '#120e1a';
          ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
          if (tile === TileType.CRACKED_WALL) {
            // Subtle cracks (or golden shimmer with Curiosity Sense!)
            ctx.strokeStyle = showCrackedGlow
              ? `rgba(255,215,64,${0.55 + Math.sin(world.time * 6) * 0.35})`
              : '#1a1423';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px + 3, py + 4);
            ctx.lineTo(px + 8, py + 9);
            ctx.lineTo(px + 13, py + 6);
            ctx.moveTo(px + 8, py + 9);
            ctx.lineTo(px + 6, py + 14);
            ctx.stroke();
          }
        } else if (tile === TileType.DOOR_LOCKED) {
          ctx.fillStyle = '#6d213c';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#ff5277';
          ctx.fillRect(px + 3, py + 2, 2, TILE_SIZE - 4);
          ctx.fillRect(px + 11, py + 2, 2, TILE_SIZE - 4);
        }
      }
    }

    // 2. Sanctuaries, Black Holes & Hazard Zones
    for (const s of world.sanctuaries) {
      ctx.fillStyle = 'rgba(255, 245, 157, 0.22)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff59d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    for (const bh of world.blackHoles) {
      ctx.fillStyle = 'rgba(124, 77, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, bh.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090612';
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, 12 + Math.sin(world.time * 12) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b388ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (const h of world.hazards) {
      if (h.kind === 'meteor_warn' || h.kind === 'bomb_warn') {
        const prog = 1 - h.timer / h.maxTimer;
        ctx.fillStyle = 'rgba(255, 59, 92, 0.18)';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff3b5c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 59, 92, 0.45)';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * prog, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle =
          h.kind === 'fire_pool'
            ? 'rgba(255, 87, 34, 0.35)'
            : h.kind === 'ice_pool'
              ? 'rgba(79, 195, 247, 0.35)'
              : 'rgba(118, 255, 3, 0.32)';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Props
    for (const pr of world.props) {
      const flash = pr.hitFlashTimer > 0;
      if (pr.kind === 'pillar') {
        ctx.fillStyle = '#120e1a';
        ctx.fillRect(pr.x - 9, pr.y - 9, 18, 18);
        ctx.fillStyle = bdef.wallColor;
        ctx.fillRect(pr.x - 8, pr.y - 8, 16, 16);
        ctx.fillStyle = bdef.wallTopColor;
        ctx.fillRect(pr.x - 8, pr.y - 8, 16, 6);
      } else if (pr.kind === 'crate' || pr.kind === 'tombstone') {
        ctx.fillStyle = flash ? '#ffffff' : pr.kind === 'tombstone' ? '#78909c' : '#8d6e63';
        ctx.fillRect(pr.x - 7, pr.y - 7, 14, 14);
        ctx.strokeStyle = '#120e1a';
        ctx.strokeRect(pr.x - 7, pr.y - 7, 14, 14);
      } else if (pr.kind === 'coffee_machine') {
        ctx.fillStyle = flash ? '#ffffff' : '#ff7043';
        ctx.fillRect(pr.x - 8, pr.y - 10, 16, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.fillText('☕', pr.x - 5, pr.y + 3);
      } else {
        // Elemental barrels!
        ctx.fillStyle = flash
          ? '#ffffff'
          : pr.kind === 'barrel_red'
            ? '#e53935'
            : pr.kind === 'barrel_ice'
              ? '#29b6f6'
              : '#64dd17';
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#120e1a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 4. Interactables
    for (const inter of world.interactables) {
      this.drawInteractable(ctx, inter, world.time);
    }

    // 5. Pickups
    for (const pk of world.pickups) {
      const bob = Math.sin(world.time * 5 + pk.x) * 2;
      if (pk.kind === 'coin') {
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (pk.kind === 'mana') {
        ctx.fillStyle = '#40c4ff';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (pk.kind === 'hp_potion' || pk.kind === 'blood_drop') {
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(pk.x - 3, pk.y - 4 + bob, 6, 8);
      } else if (pk.kind === 'weapon' && pk.weapon) {
        const wd = WEAPONS[pk.weapon.defId];
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(pk.x - 10, pk.y - 6 + bob, 20, 12);
        ctx.strokeStyle = RARITY_COLORS[wd.rarity];
        ctx.lineWidth = 1.5;
        ctx.strokeRect(pk.x - 10, pk.y - 6 + bob, 20, 12);
        ctx.fillStyle = wd.color;
        ctx.fillRect(pk.x - 6, pk.y - 2 + bob, 12, 4);
        ctx.fillStyle = RARITY_COLORS[wd.rarity];
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(wd.name, pk.x, pk.y - 10 + bob);
      } else if (pk.kind === 'sticker' && pk.stickerId) {
        const sd = STICKERS[pk.stickerId];
        ctx.fillStyle = sd.color;
        ctx.fillRect(pk.x - 7, pk.y - 7 + bob, 14, 14);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(pk.x - 7, pk.y - 7 + bob, 14, 14);
        ctx.fillStyle = '#110e18';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('贴', pk.x, pk.y + 3 + bob);
        ctx.fillStyle = sd.color;
        ctx.fillText(`[${sd.shortTag}]`, pk.x, pk.y - 10 + bob);
      }
    }

    // 6. Pet, Mercs, Turrets & Summons
    const petDef = PETS[world.pet.id];
    const petSpr = getPetSprite(petDef.color);
    ctx.drawImage(petSpr, Math.round(world.pet.x - 8), Math.round(world.pet.y - 8));
    if (world.pet.alertTimer && world.pet.alertTimer > 0 && world.pet.alertText) {
      this.drawSpeechBubble(ctx, world.pet.x, world.pet.y - 16, world.pet.alertText, '#ffd54f');
    }

    for (const m of world.mercs) {
      if (!m.alive) continue;
      const mspr = getHeroSprite('#66bb6a', '#ffd54f', false);
      ctx.drawImage(mspr, Math.round(m.x - 8), Math.round(m.y - 8));
      ctx.fillStyle = '#a5d6a7';
      ctx.font = '6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.name, m.x, m.y - 10);
    }

    for (const t of world.turrets) {
      ctx.fillStyle = '#ffb74d';
      ctx.fillRect(t.x - 6, t.y - 6, 12, 12);
      ctx.strokeStyle = '#110e18';
      ctx.strokeRect(t.x - 6, t.y - 6, 12, 12);
      ctx.fillStyle = '#ff5277';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    }

    for (const s of world.summons) {
      ctx.fillStyle = s.kind === 'chicken' ? '#ffee58' : s.kind === 'slime' ? '#69f0ae' : '#e0e0e0';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#110e18';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 7. Enemies & Bosses
    for (const e of world.enemies) {
      this.drawEnemy(ctx, e, world);
    }

    // 8. Player
    if (p1.alive) {
      const hDef = HEROES[p1.heroId];
      const spr = getHeroSprite(hDef.color, hDef.accentColor, p1.hitFlashTimer > 0);
      const sz = Math.round(16 * p1.miniPlayerScale);
      ctx.save();
      ctx.translate(Math.round(p1.x), Math.round(p1.y));
      if (p1.invulnTimer > 0 && Math.floor(world.time * 20) % 2 === 0) {
        ctx.globalAlpha = 0.55;
      }
      if (p1.facingX < 0) ctx.scale(-1, 1);
      ctx.drawImage(spr, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();

      // Held weapon visual!
      const curW = p1.weapons[p1.activeWeaponIndex];
      if (curW) {
        const wDef = WEAPONS[curW.defId];
        ctx.save();
        ctx.translate(p1.x, p1.y);
        ctx.rotate(p1.aimAngle);
        ctx.fillStyle = '#110e18';
        ctx.fillRect(4, -3.5, 13, 7);
        ctx.fillStyle = wDef.color;
        ctx.fillRect(5, -2.5, 11, 5);
        // Sticker glow dots on weapon!
        curW.stickers.forEach((sid, idx) => {
          ctx.fillStyle = STICKERS[sid].color;
          ctx.fillRect(6 + idx * 3, -4, 2, 2);
        });
        ctx.restore();
      }

      // Auto-aim reticle on locked enemy!
      if (p1.lockedEnemyId) {
        const target = world.enemies.find((e) => e.id === p1.lockedEnemyId);
        if (target) {
          ctx.strokeStyle = 'rgba(255, 213, 79, 0.85)';
          ctx.lineWidth = 1;
          const r = target.radius + 3;
          ctx.strokeRect(target.x - r, target.y - r, r * 2, r * 2);
        }
      }

      // Shield shimmer / Paladin barrier / Dual wield aura
      if (p1.paladinBarrier) {
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p1.dualWieldTimer > 0) {
        ctx.strokeStyle = 'rgba(107, 184, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 11 + Math.sin(world.time * 16), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 9. Melee Slashes & Laser Beams
    for (const sl of world.slashes) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.15, sl.life / sl.maxLife);
      ctx.strokeStyle = sl.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(sl.x, sl.y, sl.radius, sl.angle - sl.arcRad / 2, sl.angle + sl.arcRad / 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    for (const l of world.lasers) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, l.life / l.maxLife);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, l.width * 0.4);
      ctx.stroke();
      ctx.restore();
    }

    // 10. Projectiles (with dynamic player-bullet fade when >40 on screen for mobile readability!)
    const playerBulletCount = world.projectiles.filter((pr) => pr.fromPlayer).length;
    const playerAlpha = playerBulletCount > 40 ? 0.55 : 0.95;

    for (const pr of world.projectiles) {
      ctx.save();
      ctx.globalAlpha = pr.fromPlayer ? playerAlpha : 1.0;
      if (pr.shape === 'text' && pr.labelText) {
        ctx.fillStyle = '#110e18';
        ctx.font = `bold ${Math.max(8, pr.radius * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(pr.labelText, pr.x + 1, pr.y + 4);
        ctx.fillStyle = pr.color;
        ctx.fillText(pr.labelText, pr.x, pr.y + 3);
      } else if (pr.shape === 'bill') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pr.x - pr.radius, pr.y - pr.radius * 0.7, pr.radius * 2, pr.radius * 1.4);
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 1;
        ctx.strokeRect(pr.x - pr.radius, pr.y - pr.radius * 0.7, pr.radius * 2, pr.radius * 1.4);
      } else {
        // High-contrast enemy bullet outline!
        ctx.fillStyle = pr.fromPlayer ? pr.color : '#ffffff';
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pr.fromPlayer ? '#110e18' : pr.color;
        ctx.lineWidth = pr.fromPlayer ? 1.2 : 2.2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 11. Particles & Floating Texts
    for (const pt of world.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
    }

    for (const ft of world.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 1.5);
      ctx.font = `bold ${Math.round(9 * ft.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#110e18';
      ctx.fillText(ft.text, Math.round(ft.x) + 1, Math.round(ft.y) + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
      ctx.restore();
    }

    ctx.restore();

    // Glitch Lord fake pixel blue-screen gag!
    if (world.glitchBlueScreenTimer > 0) {
      ctx.fillStyle = 'rgba(0, 82, 204, 0.42)';
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(':( 404 SYSTEM GLITCH OVERLOAD', this.logicalWidth / 2, this.logicalHeight / 2);
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyState, world: WorldState): void {
    const scale =
      (e.isBoss ? 1.85 : e.isElite ? 1.25 : 1.0) *
      (world.floorMutator === 'big_head' ? 1.35 : 1.0);
    const sz = Math.round(16 * scale);
    const color = e.freezeTimer > 0 ? '#4fc3f7' : e.isBoss ? '#ff5277' : e.kind === 'gold_slime' ? '#ffd54f' : '#66bb6a';
    const accent = e.isElite ? '#ffd54f' : '#ff7043';
    const spr = getEnemySprite(e.kind, color, accent, e.hitFlashTimer > 0, e.duckTimer > 0);

    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y));
    if (e.isElite) {
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.facingX < 0) ctx.scale(-1, 1);
    ctx.drawImage(spr, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();

    // Mini HP bar above wounded non-boss enemies
    if (!e.isBoss && e.hp < e.maxHp) {
      const bw = 18;
      ctx.fillStyle = '#110e18';
      ctx.fillRect(e.x - bw / 2, e.y - sz / 2 - 5, bw, 3);
      ctx.fillStyle = '#ff5252';
      ctx.fillRect(e.x - bw / 2, e.y - sz / 2 - 5, Math.max(1, bw * (e.hp / e.maxHp)), 3);
    }

    if (e.bossSpeechTimer && e.bossSpeechTimer > 0 && e.bossSpeech) {
      this.drawSpeechBubble(ctx, e.x, e.y - sz / 2 - 14, e.bossSpeech, '#ffd54f');
    }
  }

  private drawInteractable(
    ctx: CanvasRenderingContext2D,
    inter: WorldState['interactables'][number],
    time: number
  ): void {
    const pulse = Math.sin(time * 5) * 2;
    if (inter.kind === 'portal') {
      ctx.fillStyle = 'rgba(79, 195, 247, 0.35)';
      ctx.beginPath();
      ctx.arc(inter.x, inter.y, 16 + pulse * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#40c4ff';
      ctx.beginPath();
      ctx.arc(inter.x, inter.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('下一层传送门', inter.x, inter.y - 20);
      return;
    }

    const iconMap: Record<string, { icon: string; color: string; label: string }> = {
      chest: { icon: '🎁', color: '#ffd54f', label: inter.used ? '已开启' : '宝箱' },
      slot_machine: { icon: '🎰', color: '#ff5277', label: inter.used ? '已报废' : `老虎机(${inter.cost}金)` },
      wishing_well: { icon: '⛲', color: '#4fc3f7', label: `许愿池(${inter.cost}金)` },
      workshop_npc: { icon: '🏷️', color: '#c77dff', label: '贴纸工坊' },
      merchant_npc: { icon: '🛒', color: '#ffb74d', label: '黑心奸商' },
      demon_npc: { icon: '😈', color: '#ff1744', label: '诅咒祭坛' },
      forge_npc: { icon: '🔨', color: '#ff7043', label: '重铸铁匠' },
      recycle_bot: { icon: '♻️', color: '#69f0ae', label: '回收机器人' },
      statue: { icon: '🗿', color: '#ffd54f', label: inter.used ? '已供奉' : `雕像(${inter.cost}金)` },
      mimic_red: { icon: '🟥', color: '#ff5252', label: inter.used ? '空' : '赌命红箱' },
      mimic_blue: { icon: '🟦', color: '#4db8ff', label: inter.used ? '空' : '赌命蓝箱' },
      fate_wheel: { icon: '🎲', color: '#ff80ab', label: inter.used ? '已转动' : '命运转盘' },
      tavern_npc: { icon: '🍺', color: '#ffb74d', label: inter.used ? '已雇佣' : `雇佣兵(${inter.cost}金)` },
      clinic_npc: { icon: '💊', color: '#69f0ae', label: inter.used ? '已看诊' : `怪医(${inter.cost}金)` },
      arena_flag: { icon: '⚔️', color: '#ff9f1c', label: inter.used ? '试炼中' : '竞技场旗' },
      enchanter_npc: { icon: '🔮', color: '#ce93d8', label: inter.used ? '已附魔' : `天赋师(${inter.cost}金)` },
      collector_npc: { icon: '🧙', color: '#b388ff', label: inter.used ? '已交换' : '武器收藏家' },
      bonus_portal: { icon: '🛸', color: '#ffd54f', label: inter.used ? '已开启' : '赏金裂隙' },
      secret_goose_door: { icon: '🪿', color: '#ffee58', label: '物业办公室(Boss)' }
    };

    const info = iconMap[inter.kind] ?? { icon: '❓', color: '#ffffff', label: '' };
    ctx.fillStyle = inter.used ? 'rgba(60,60,70,0.6)' : 'rgba(20,16,32,0.85)';
    ctx.beginPath();
    ctx.arc(inter.x, inter.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = inter.used ? '#546e7a' : info.color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(info.icon, inter.x, inter.y + 4);
    ctx.fillStyle = inter.used ? '#78909c' : info.color;
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText(info.label, inter.x, inter.y - 16);
  }

  /**
   * Renders the cozy Walkable Deluxe Pixel Lobby!
   */
  renderLobby(lobby: LobbyState, meta: MetaSave, dt: number): void {
    const ctx = this.ctx;
    const targetX = lobby.playerX - this.logicalWidth / 2;
    const targetY = lobby.playerY - this.logicalHeight / 2;
    this.camX += (targetX - this.camX) * Math.min(1, dt * 8);
    this.camY += (targetY - this.camY) * Math.min(1, dt * 8);
    const vx = Math.round(this.camX);
    const vy = Math.round(this.camY);

    ctx.fillStyle = '#120e1b';
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    ctx.save();
    ctx.translate(-vx, -vy);

    // Warm wooden floor + 4 themed zones
    const w = lobby.widthPx;
    const h = lobby.heightPx;
    for (let y = 16; y < h - 16; y += 16) {
      for (let x = 16; x < w - 16; x += 16) {
        let col = (x / 16 + y / 16) % 2 === 0 ? '#3a2a24' : '#423029';
        if (x < 160) col = (x / 16 + y / 16) % 2 === 0 ? '#243a29' : '#2a4430'; // West Garden
        else if (x > w - 160) col = (x / 16 + y / 16) % 2 === 0 ? '#332d3d' : '#3b3447'; // East Forge
        else if (y > h - 92) col = (x / 16 + y / 16) % 2 === 0 ? '#242238' : '#2b2944'; // South Cellar
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 16, 16);
      }
    }

    // Perimeter pixel walls
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Cozy central red carpet
    ctx.fillStyle = 'rgba(183, 28, 28, 0.35)';
    ctx.fillRect(w / 2 - 90, h / 2 - 44, 180, 108);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w / 2 - 90, h / 2 - 44, 180, 108);

    // Zone Titles painted on floor
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('🌱 魔法花园', 86, 36);
    ctx.fillText('🔨 锻造与贴纸工坊', w - 88, 36);
    ctx.fillText('🏆 地下收藏陈列室', w / 2, h - 78);

    // Draw all stations & lounging heroes!
    for (const st of lobby.stations) {
      const isNear = st.id === lobby.nearestStationId;
      if (st.kind === 'hero_npc' && st.heroId) {
        const hd = HEROES[st.heroId];
        const unlocked = meta.unlockedHeroes.includes(st.heroId);
        const bob = Math.sin(lobby.time * 3 + st.x) * 1.2;
        ctx.save();
        if (!unlocked) ctx.globalAlpha = 0.45;
        const spr = getHeroSprite(hd.color, hd.accentColor);
        ctx.drawImage(spr, Math.round(st.x - 8), Math.round(st.y - 8 + bob));
        ctx.restore();
        ctx.fillStyle = isNear ? '#ffd54f' : unlocked ? '#ffffff' : '#90a4ae';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(unlocked ? `${hd.name} Lv.${meta.heroLevels[st.heroId] ?? 1}` : `🔒${hd.name}`, st.x, st.y - 12);
        if (isNear && st.speech) {
          this.drawSpeechBubble(ctx, st.x, st.y - 24, st.speech, '#ffd54f');
        }
      } else {
        const pulse = st.kind === 'portal' ? Math.sin(lobby.time * 6) * 2 : 0;
        ctx.fillStyle = isNear ? 'rgba(255,213,79,0.28)' : 'rgba(18,14,28,0.82)';
        ctx.beginPath();
        ctx.arc(st.x, st.y, 16 + pulse * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isNear ? '#ffd54f' : st.color;
        ctx.lineWidth = isNear ? 2.2 : 1.5;
        ctx.stroke();
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(st.icon, st.x, st.y + 5);
        ctx.fillStyle = isNear ? '#ffd54f' : '#eceff1';
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText(st.label, st.x, st.y - 19);
      }
    }

    // Active Pet
    const petSpr = getPetSprite(PETS[meta.selectedPet].color);
    ctx.drawImage(petSpr, Math.round(lobby.petX - 8), Math.round(lobby.petY - 8));

    // Active Player Hero
    const curH = HEROES[meta.selectedHero];
    const pSpr = getHeroSprite(curH.color, curH.accentColor);
    ctx.save();
    ctx.translate(Math.round(lobby.playerX), Math.round(lobby.playerY));
    if (lobby.facingX < 0) ctx.scale(-1, 1);
    ctx.drawImage(pSpr, -9, -9, 18, 18);
    ctx.restore();

    ctx.restore();
  }

  private drawSpeechBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    borderColor: string
  ): void {
    ctx.font = 'bold 7px sans-serif';
    const w = Math.min(180, ctx.measureText(text).width + 10);
    ctx.fillStyle = 'rgba(16, 12, 26, 0.9)';
    ctx.fillRect(x - w / 2, y - 10, w, 13);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y - 10, w, 13);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 1);
  }
}
