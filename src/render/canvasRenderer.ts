import { BIOMES } from '../content/biomes';
import { HEROES, PETS } from '../content/heroes';
import { RARITY_COLORS, STICKERS } from '../content/stickers';
import { WEAPONS } from '../content/weapons';
import {
  EnemyState,
  MetaSave,
  TILE_SIZE,
  TileType,
  WorldState
} from '../sim/types';
import { getEnemySprite, getHeroSprite, getPetSprite, getWeaponSprite } from './pixelSprites';

interface LabelDrawCmd {
  wx: number;
  wy: number;
  text: string;
  color: string;
  sizePx?: number;
  bubble?: boolean;
  borderColor?: string;
}

export class PixelCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textCanvas: HTMLCanvasElement;
  private tctx: CanvasRenderingContext2D;

  private camX = 0;
  private camY = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  public shakeEnabled = true;

  private logicalHeight = 270;
  private logicalWidth = 480;
  private cssW = 800;
  private cssH = 450;
  private dpr = 1;
  private lobbyTime = 0;

  constructor(canvas: HTMLCanvasElement, textCanvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.textCanvas = textCanvas;
    this.tctx = textCanvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(200, window.innerHeight);
    this.cssW = w;
    this.cssH = h;
    this.dpr = Math.min(3, window.devicePixelRatio || 1);

    const aspect = w / h;
    this.logicalHeight = 270;
    this.logicalWidth = Math.max(380, Math.min(600, Math.round(this.logicalHeight * aspect)));

    this.canvas.width = this.logicalWidth;
    this.canvas.height = this.logicalHeight;
    this.ctx.imageSmoothingEnabled = false;

    // Native HiDPI text overlay canvas — razor-sharp Chinese text on 1080p/2K/4K phones!
    this.textCanvas.width = Math.round(w * this.dpr);
    this.textCanvas.height = Math.round(h * this.dpr);
    this.tctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  triggerShake(intensity: number, duration: number): void {
    if (!this.shakeEnabled) return;
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  resetCamera(): void {
    this.camX = 0;
    this.camY = 0;
  }

  renderDungeon(world: WorldState, dt: number): void {
    const ctx = this.ctx;
    const p1 = world.players.p1;
    const bdef = BIOMES[world.biome];
    const labels: LabelDrawCmd[] = [];

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
          // Subtle handcrafted pixel pebble/grass/sparkle texture
          const hash = ((tx * 73856093) ^ (ty * 19349663)) & 15;
          if (hash === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(px + 3, py + 4, 3, 2);
          } else if (hash === 5) {
            ctx.fillStyle = 'rgba(0,0,0,0.14)';
            ctx.fillRect(px + 9, py + 10, 4, 2);
          } else if (hash === 11) {
            ctx.fillStyle = bdef.accentColor;
            ctx.globalAlpha = 0.14;
            ctx.fillRect(px + 6, py + 7, 2, 2);
            ctx.globalAlpha = 1;
          }
          // Cast soft 2.5D shadow beneath north walls!
          if (ty > 0 && world.map.tiles[(ty - 1) * world.map.width + tx] === TileType.WALL) {
            ctx.fillStyle = 'rgba(0,0,0,0.34)';
            ctx.fillRect(px, py, TILE_SIZE, 5);
          }
          if (tile === TileType.DOOR_OPEN) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }
        } else if (tile === TileType.ICE) {
          ctx.fillStyle = '#4fc3f7';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(px + 2, py + 3, 6, 2);
          ctx.fillRect(px + 9, py + 10, 4, 2);
        } else if (tile === TileType.LAVA) {
          ctx.fillStyle = Math.sin(world.time * 4 + tx) > 0 ? '#ff5722' : '#ff9800';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#ffeb3b';
          ctx.fillRect(px + 4, py + 5, 4, 2);
        } else if (tile === TileType.CONVEYOR_R) {
          ctx.fillStyle = '#455a64';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          const arrowOff = Math.floor(world.time * 24) % 8;
          ctx.fillStyle = '#ffb74d';
          ctx.fillRect(px + arrowOff, py + 6, 4, 4);
        } else if (tile === TileType.WALL || tile === TileType.CRACKED_WALL) {
          // Beveled pixel stone bricks!
          ctx.fillStyle = bdef.wallColor;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = bdef.wallTopColor;
          ctx.fillRect(px, py, TILE_SIZE, 6);
          ctx.fillStyle = 'rgba(255,255,255,0.14)';
          ctx.fillRect(px, py, TILE_SIZE, 1);
          // Brick mortar seams
          ctx.fillStyle = 'rgba(12, 8, 20, 0.45)';
          ctx.fillRect(px, py + 6, TILE_SIZE, 1);
          ctx.fillRect(px + 7, py + 6, 1, 5);
          ctx.fillRect(px, py + 11, TILE_SIZE, 1);
          ctx.fillRect(px + 3, py + 11, 1, 5);
          ctx.fillStyle = '#120e1a';
          ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
          if (tile === TileType.CRACKED_WALL) {
            ctx.strokeStyle = showCrackedGlow
              ? `rgba(255,215,64,${0.6 + Math.sin(world.time * 6) * 0.35})`
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

    // 2. Sanctuaries, Black Holes & Hazards
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
        ctx.fillStyle = h.kind === 'fire_pool' ? 'rgba(255,87,34,0.35)' : h.kind === 'ice_pool' ? 'rgba(79,195,247,0.35)' : 'rgba(118,255,3,0.32)';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Props (including glowing Ore Veins!)
    for (const pr of world.props) {
      const flash = pr.hitFlashTimer > 0;
      if (pr.kind === 'pillar') {
        ctx.fillStyle = '#120e1a';
        ctx.fillRect(pr.x - 9, pr.y - 9, 18, 18);
        ctx.fillStyle = bdef.wallColor;
        ctx.fillRect(pr.x - 8, pr.y - 8, 16, 16);
        ctx.fillStyle = bdef.wallTopColor;
        ctx.fillRect(pr.x - 8, pr.y - 8, 16, 6);
      } else if (pr.kind === 'ore_vein') {
        ctx.fillStyle = flash ? '#ffffff' : '#263238';
        ctx.fillRect(pr.x - 8, pr.y - 6, 16, 12);
        ctx.fillStyle = flash ? '#ffffff' : '#00e5ff';
        ctx.fillRect(pr.x - 5, pr.y - 8, 4, 7);
        ctx.fillRect(pr.x + 1, pr.y - 6, 4, 6);
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(pr.x - 1, pr.y - 3, 3, 3);
        labels.push({ wx: pr.x, wy: pr.y - 12, text: '⛏️ 魔晶矿脉', color: '#80d8ff', sizePx: 11 });
      } else if (pr.kind === 'crate' || pr.kind === 'tombstone') {
        ctx.fillStyle = flash ? '#ffffff' : pr.kind === 'tombstone' ? '#78909c' : '#8d6e63';
        ctx.fillRect(pr.x - 7, pr.y - 7, 14, 14);
        ctx.strokeStyle = '#120e1a';
        ctx.strokeRect(pr.x - 7, pr.y - 7, 14, 14);
      } else if (pr.kind === 'coffee_machine') {
        ctx.fillStyle = flash ? '#ffffff' : '#ff7043';
        ctx.fillRect(pr.x - 8, pr.y - 10, 16, 20);
        labels.push({ wx: pr.x, wy: pr.y - 14, text: '☕ 程序员咖啡机', color: '#ffd54f', sizePx: 12 });
      } else {
        ctx.fillStyle = flash ? '#ffffff' : pr.kind === 'barrel_red' ? '#e53935' : pr.kind === 'barrel_ice' ? '#29b6f6' : '#64dd17';
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#120e1a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 4. Interactables (Portals, Rune Plates, Campfire, Shops, Chests)
    for (const inter of world.interactables) {
      this.drawInteractable(ctx, inter, world.time, labels);
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
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(pk.x, pk.y + 6, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = RARITY_COLORS[wd.rarity];
        ctx.lineWidth = 1.3;
        ctx.strokeRect(pk.x - 10, pk.y - 6 + bob, 20, 12);
        ctx.drawImage(getWeaponSprite(wd.id, wd.color), Math.round(pk.x - 8), Math.round(pk.y - 4 + bob));
        labels.push({ wx: pk.x, wy: pk.y - 12 + bob, text: wd.name, color: RARITY_COLORS[wd.rarity], sizePx: 12 });
      } else if (pk.kind === 'sticker' && pk.stickerId) {
        const sd = STICKERS[pk.stickerId];
        ctx.fillStyle = sd.color;
        ctx.fillRect(pk.x - 6, pk.y - 6 + bob, 12, 12);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(pk.x - 6, pk.y - 6 + bob, 12, 12);
        labels.push({ wx: pk.x, wy: pk.y - 12 + bob, text: `🏷️ ${sd.shortTag}`, color: sd.color, sizePx: 11 });
      }
    }

    // 6. Pet, Mercs, Turrets & Summons
    const petDef = PETS[world.pet.id];
    ctx.drawImage(getPetSprite(petDef.color), Math.round(world.pet.x - 8), Math.round(world.pet.y - 8));
    if (world.pet.alertTimer && world.pet.alertTimer > 0 && world.pet.alertText) {
      labels.push({ wx: world.pet.x, wy: world.pet.y - 16, text: world.pet.alertText, color: '#ffd54f', bubble: true, borderColor: '#ffd54f', sizePx: 12 });
    }

    for (const m of world.mercs) {
      if (!m.alive) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + 7, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(getHeroSprite('bucket_knight', '#66bb6a', '#ffd54f', false), Math.round(m.x - 8), Math.round(m.y - 8));
      labels.push({ wx: m.x, wy: m.y - 12, text: m.name, color: '#a5d6a7', sizePx: 11 });
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

    // 7. Enemies & Bosses (with clear non-jumpscare Bounty Warning Ring!)
    for (const e of world.enemies) {
      this.drawEnemy(ctx, e, world, labels);
    }

    // 8. Player (with distinct hero silhouette, soft ground shadow & real pixel weapon sprite!)
    if (p1.alive) {
      const hDef = HEROES[p1.heroId];
      const spr = getHeroSprite(p1.heroId, hDef.color, hDef.accentColor, p1.hitFlashTimer > 0);
      const sz = Math.round(16 * p1.miniPlayerScale);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(p1.x, p1.y + sz * 0.44, 6.5 * p1.miniPlayerScale, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(Math.round(p1.x), Math.round(p1.y));
      if (p1.invulnTimer > 0 && Math.floor(world.time * 20) % 2 === 0) ctx.globalAlpha = 0.55;
      if (p1.facingX < 0) ctx.scale(-1, 1);
      ctx.drawImage(spr, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();

      const curW = p1.weapons[p1.activeWeaponIndex];
      if (curW) {
        const wDef = WEAPONS[curW.defId];
        const wSpr = getWeaponSprite(wDef.id, wDef.color);
        ctx.save();
        ctx.translate(p1.x, p1.y + 1);
        ctx.rotate(p1.aimAngle);
        if (Math.abs(p1.aimAngle) > Math.PI / 2) ctx.scale(1, -1);
        ctx.drawImage(wSpr, 2, -4, 16, 8);
        curW.stickers.forEach((sid, idx) => {
          ctx.fillStyle = STICKERS[sid].color;
          ctx.fillRect(5 + idx * 3, -5, 2, 2);
        });
        ctx.restore();
      }

      if (p1.lockedEnemyId) {
        const target = world.enemies.find((e) => e.id === p1.lockedEnemyId);
        if (target) {
          ctx.strokeStyle = 'rgba(255, 213, 79, 0.85)';
          ctx.lineWidth = 1;
          const r = target.radius + 3;
          ctx.strokeRect(target.x - r, target.y - r, r * 2, r * 2);
        }
      }

      if (p1.paladinBarrier || p1.campfireBuffTimer > 0) {
        ctx.strokeStyle = p1.paladinBarrier ? '#ffd54f' : 'rgba(255, 183, 77, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 9. Slashes & Lasers
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

    // 10. Projectiles
    const playerBulletCount = world.projectiles.filter((pr) => pr.fromPlayer).length;
    const playerAlpha = playerBulletCount > 40 ? 0.55 : 0.95;
    for (const pr of world.projectiles) {
      if (pr.shape === 'text' && pr.labelText) {
        labels.push({ wx: pr.x, wy: pr.y, text: pr.labelText, color: pr.color, sizePx: Math.max(14, pr.radius * 3) });
        continue;
      }
      ctx.save();
      ctx.globalAlpha = pr.fromPlayer ? playerAlpha : 1.0;
      if (pr.shape === 'bill') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pr.x - pr.radius, pr.y - pr.radius * 0.7, pr.radius * 2, pr.radius * 1.4);
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 1;
        ctx.strokeRect(pr.x - pr.radius, pr.y - pr.radius * 0.7, pr.radius * 2, pr.radius * 1.4);
      } else {
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

    // 11. Particles
    for (const pt of world.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
    }

    ctx.restore();

    // Floating damage numbers go to crisp HiDPI text layer!
    for (const ft of world.floatingTexts) {
      labels.push({
        wx: ft.x,
        wy: ft.y,
        text: ft.text,
        color: ft.color,
        sizePx: Math.round(14 * ft.scale)
      });
    }

    // Render all text razor-sharp on the native HiDPI overlay canvas!
    this.flushHiDpiLabels(labels, vx, vy, world.glitchBlueScreenTimer > 0);
  }

  /**
   * Clean, atmospheric animated pixel campfire scene for the Simple Single-Screen Lobby!
   */
  renderSimpleLobbyBackdrop(meta: MetaSave, dt: number): void {
    this.lobbyTime += dt;
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    // Warm dungeon tavern backdrop
    ctx.fillStyle = '#181224';
    ctx.fillRect(0, 0, w, h);

    // Subtle pixel stone tiles
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = (x / 16 + y / 16) % 2 === 0 ? '#1f182d' : '#241c35';
        ctx.fillRect(x, y, 16, 16);
      }
    }

    // Cozy campfire glow on left stage (where hero & pet stand)
    const stageX = Math.round(w * 0.28);
    const stageY = Math.round(h * 0.56);
    const glowR = 64 + Math.sin(this.lobbyTime * 6) * 4;
    const grad = ctx.createRadialGradient(stageX, stageY, 6, stageX, stageY, glowR);
    grad.addColorStop(0, 'rgba(255, 167, 38, 0.42)');
    grad.addColorStop(1, 'rgba(255, 167, 38, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(stageX, stageY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Campfire logs & flickering flame
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(stageX - 10, stageY + 14, 20, 5);
    ctx.fillStyle = '#ff7043';
    ctx.fillRect(stageX - 5, stageY + 6 + Math.sin(this.lobbyTime * 14) * 1.5, 10, 9);
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(stageX - 3, stageY + 9, 6, 5);

    // Selected Hero & Pet crisp enlarged pixel showcase!
    const hDef = HEROES[meta.selectedHero];
    const pDef = PETS[meta.selectedPet];
    const bob = Math.sin(this.lobbyTime * 4) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(stageX - 26, stageY + 20, 16, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(stageX + 30, stageY + 22, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(getHeroSprite(meta.selectedHero, hDef.color, hDef.accentColor), stageX - 46, stageY - 22 + bob, 40, 40);
    ctx.drawImage(getPetSprite(pDef.color), stageX + 16, stageY - 6 - bob * 0.8, 28, 28);

    // Clear text overlay canvas in lobby (lobby UI uses crisp native HTML!)
    this.tctx.clearRect(0, 0, this.cssW, this.cssH);
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyState, world: WorldState, labels: LabelDrawCmd[]): void {
    const scale = (e.isBoss ? 1.85 : e.isBounty ? 1.5 : e.isElite ? 1.25 : 1.0) * (world.floorMutator === 'big_head' ? 1.35 : 1.0);
    const sz = Math.round(16 * scale);
    const color = e.freezeTimer > 0 ? '#4fc3f7' : e.isBoss ? '#ff5277' : e.isBounty ? '#ffd54f' : e.kind === 'gold_slime' ? '#ffd54f' : '#66bb6a';
    const accent = e.isElite || e.isBounty ? '#ffd54f' : '#ff7043';
    const spr = getEnemySprite(e.kind, color, accent, e.hitFlashTimer > 0, e.duckTimer > 0);

    // Dormant Field Bounty Boss: clear dashed golden warning circle so player chooses whether to fight!
    if (e.isBounty && !e.bountyAwake) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.78)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      labels.push({
        wx: e.x,
        wy: e.y - sz / 2 - 14,
        text: `👑 悬赏头领：${e.name}（进圈或开火开战）`,
        color: '#ffd54f',
        bubble: true,
        borderColor: '#ffd54f',
        sizePx: 12
      });
    }

    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y));
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, sz * 0.44, e.radius * 0.85, Math.max(2.5, e.radius * 0.32), 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.isElite || e.isBounty) {
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.facingX < 0) ctx.scale(-1, 1);
    ctx.drawImage(spr, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();

    if (!e.isBoss && (e.hp < e.maxHp || e.isBounty)) {
      const bw = e.isBounty ? 30 : 18;
      ctx.fillStyle = '#110e18';
      ctx.fillRect(e.x - bw / 2, e.y - sz / 2 - 6, bw, 3.5);
      ctx.fillStyle = e.isBounty ? '#ffd54f' : '#ff5252';
      ctx.fillRect(e.x - bw / 2, e.y - sz / 2 - 6, Math.max(1, bw * (e.hp / e.maxHp)), 3.5);
    }

    if (e.bossSpeechTimer && e.bossSpeechTimer > 0 && e.bossSpeech && (!e.isBounty || e.bountyAwake)) {
      labels.push({ wx: e.x, wy: e.y - sz / 2 - 16, text: e.bossSpeech, color: '#ffd54f', bubble: true, borderColor: '#ffd54f', sizePx: 12 });
    }
  }

  private drawInteractable(
    ctx: CanvasRenderingContext2D,
    inter: WorldState['interactables'][number],
    time: number,
    labels: LabelDrawCmd[]
  ): void {
    const pulse = Math.sin(time * 5) * 2;
    if (inter.kind === 'portal') {
      const isBossPortal = inter.portalDest?.flavor === 'boss_lair';
      const ringCol = isBossPortal ? '#ff5277' : inter.portalDest?.flavor === 'treasure' ? '#ffd54f' : '#40c4ff';
      ctx.fillStyle = isBossPortal ? 'rgba(255, 82, 119, 0.35)' : 'rgba(79, 195, 247, 0.35)';
      ctx.beginPath();
      ctx.arc(inter.x, inter.y, 16 + pulse * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ringCol;
      ctx.beginPath();
      ctx.arc(inter.x, inter.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      labels.push({
        wx: inter.x,
        wy: inter.y - 20,
        text: inter.portalDest?.label ?? '🌀 前往新地图',
        color: ringCol,
        bubble: true,
        borderColor: ringCol,
        sizePx: 12
      });
      return;
    }

    if (inter.kind === 'rune_plate') {
      ctx.fillStyle = inter.used ? 'rgba(255, 213, 79, 0.35)' : 'rgba(0, 229, 255, 0.22)';
      ctx.fillRect(inter.x - 10, inter.y - 10, 20, 20);
      ctx.strokeStyle = inter.used ? '#ffd54f' : '#00e5ff';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(inter.x - 10, inter.y - 10, 20, 20);
      labels.push({
        wx: inter.x,
        wy: inter.y - 14,
        text: inter.used ? '✨ 已点亮' : '踩亮符文',
        color: inter.used ? '#ffd54f' : '#00e5ff',
        sizePx: 11
      });
      return;
    }

    if (inter.kind === 'campfire') {
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(inter.x - 9, inter.y + 2, 18, 5);
      ctx.fillStyle = inter.used ? '#90a4ae' : '#ff7043';
      ctx.beginPath();
      ctx.arc(inter.x, inter.y - 1, 7 + pulse * 0.3, 0, Math.PI * 2);
      ctx.fill();
      if (!inter.used) {
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.arc(inter.x, inter.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      labels.push({
        wx: inter.x,
        wy: inter.y - 16,
        text: inter.used ? '🔥 营火(已休息)' : '🔥 旅途营火(免费满血)',
        color: '#ffb74d',
        bubble: !inter.used,
        borderColor: '#ffb74d',
        sizePx: 12
      });
      return;
    }

    const iconMap: Record<string, { color: string; label: string }> = {
      chest: { color: '#ffd54f', label: inter.used ? '🎁 已开启' : '🎁 安全宝箱' },
      slot_machine: { color: '#ff5277', label: inter.used ? '🎰 已转满' : `🎰 老虎机(${inter.cost}金)` },
      wishing_well: { color: '#4fc3f7', label: `⛲ 许愿池(${inter.cost}金)` },
      workshop_npc: { color: '#c77dff', label: '🏷️ 贴纸工坊' },
      merchant_npc: { color: '#69f0ae', label: '🛒 旅途商店(花金币!)' },
      demon_npc: { color: '#ff1744', label: '😈 恶魔交易坛' },
      forge_npc: { color: '#ff7043', label: '🔨 铁匠重铸' },
      recycle_bot: { color: '#69f0ae', label: '♻️ 高价回收机' },
      statue: { color: '#ffd54f', label: inter.used ? '🗿 已供奉' : `🗿 远古雕像(${inter.cost}金)` },
      mimic_red: { color: '#ff5252', label: inter.used ? '已选' : '🟥 福利红箱(武器)' },
      mimic_blue: { color: '#4db8ff', label: inter.used ? '已选' : '🟦 福利蓝箱(双贴纸)' },
      fate_wheel: { color: '#ff80ab', label: inter.used ? '已转动' : '🎲 命运转盘(免费)' },
      tavern_npc: { color: '#ffb74d', label: inter.used ? '已雇佣' : `🍺 雇佣兵(${inter.cost}金)` },
      clinic_npc: { color: '#69f0ae', label: inter.used ? '已强化' : `💊 怪医诊所(${inter.cost}金)` },
      arena_flag: { color: '#ff9f1c', label: inter.used ? '试炼中' : '⚔️ 竞技场(主动挑战)' },
      enchanter_npc: { color: '#ce93d8', label: inter.used ? '已附魔' : `🔮 天赋导师(${inter.cost}金)` },
      collector_npc: { color: '#b388ff', label: inter.used ? '已交换' : '🧙 武器收藏家' },
      bonus_portal: { color: '#ffd54f', label: inter.used ? '已开启' : '🛸 黄金史莱姆裂隙' },
      secret_goose_door: { color: '#ffee58', label: '🪿 挑战大鹅王(明牌)' }
    };

    const info = iconMap[inter.kind] ?? { color: '#ffffff', label: '' };
    ctx.fillStyle = inter.used ? 'rgba(60,60,70,0.6)' : 'rgba(20,16,32,0.88)';
    ctx.beginPath();
    ctx.arc(inter.x, inter.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = inter.used ? '#546e7a' : info.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    labels.push({
      wx: inter.x,
      wy: inter.y - 16,
      text: info.label,
      color: inter.used ? '#90a4ae' : info.color,
      bubble: !inter.used,
      borderColor: info.color,
      sizePx: 12
    });
  }

  private flushHiDpiLabels(
    labels: LabelDrawCmd[],
    vx: number,
    vy: number,
    blueScreen: boolean
  ): void {
    const tctx = this.tctx;
    tctx.clearRect(0, 0, this.cssW, this.cssH);

    const sx = this.cssW / this.logicalWidth;
    const sy = this.cssH / this.logicalHeight;

    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';

    for (const lb of labels) {
      const px = (lb.wx - vx) * sx;
      const py = (lb.wy - vy) * sy;
      if (px < -120 || px > this.cssW + 120 || py < -40 || py > this.cssH + 40) continue;

      const fontSize = lb.sizePx ?? 13;
      tctx.font = `700 ${fontSize}px 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif`;

      if (lb.bubble) {
        const padX = 8;
        const tw = tctx.measureText(lb.text).width + padX * 2;
        const th = fontSize + 10;
        tctx.fillStyle = 'rgba(14, 11, 24, 0.88)';
        tctx.beginPath();
        tctx.roundRect(px - tw / 2, py - th / 2, tw, th, 6);
        tctx.fill();
        tctx.strokeStyle = lb.borderColor ?? lb.color;
        tctx.lineWidth = 1.5;
        tctx.stroke();
      } else {
        tctx.lineWidth = 3;
        tctx.strokeStyle = 'rgba(10, 8, 18, 0.92)';
        tctx.strokeText(lb.text, px, py);
      }

      tctx.fillStyle = lb.color;
      tctx.fillText(lb.text, px, py);
    }

    if (blueScreen) {
      tctx.fillStyle = 'rgba(0, 82, 204, 0.45)';
      tctx.fillRect(0, 0, this.cssW, this.cssH);
      tctx.fillStyle = '#ffffff';
      tctx.font = '800 20px monospace';
      tctx.fillText(':( 404 SYSTEM GLITCH OVERLOAD', this.cssW / 2, this.cssH / 2);
    }
  }
}
