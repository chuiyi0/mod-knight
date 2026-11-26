import { moveCircleWithCollisions } from '../collision';
import { SeededRNG } from '../rng';
import {
  EnemyState,
  PlayerState,
  ProjectileState,
  WorldState
} from '../types';
import { createEnemy } from './enemies';

let eProjUid = 1;

export interface EnemyAIHelpers {
  damagePlayer: (player: PlayerState, amount: number, element?: 'fire' | 'ice' | 'poison') => void;
  spawnParticles: (x: number, y: number, color: string, count: number, speed?: number) => void;
  addFloatingText: (x: number, y: number, text: string, color: string, scale?: number) => void;
}

export function stepEnemyAI(
  world: WorldState,
  enemy: EnemyState,
  target: PlayerState,
  dt: number,
  rng: SeededRNG,
  helpers: EnemyAIHelpers
): void {
  if (enemy.hp <= 0) return;

  // Optional Field Bounty Mini-Boss: stays peacefully neutral until player enters close ring or attacks!
  if (enemy.isBounty && !enemy.bountyAwake) {
    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
    const d0 = Math.hypot(target.x - enemy.x, target.y - enemy.y);
    if (d0 < 56 || enemy.hp < enemy.maxHp) {
      enemy.bountyAwake = true;
      enemy.bossSpeech = '接下悬赏了是吧！来战个痛快！';
      enemy.bossSpeechTimer = 2.5;
      helpers.addFloatingText(enemy.x, enemy.y - 20, '👑 悬赏头领开战！', '#ffd54f', 1.15);
    } else {
      return;
    }
  }

  // Timers
  if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
  if (enemy.ccDiminishTimer > 0) enemy.ccDiminishTimer = Math.max(0, enemy.ccDiminishTimer - dt);
  if (enemy.bossSpeechTimer && enemy.bossSpeechTimer > 0) {
    enemy.bossSpeechTimer = Math.max(0, enemy.bossSpeechTimer - dt);
  }

  // DOT: Burn
  if (enemy.burnTimer > 0) {
    enemy.burnTimer -= dt;
    enemy.burnTickTimer -= dt;
    if (enemy.burnTickTimer <= 0) {
      enemy.burnTickTimer = 0.5;
      const dmg = Math.round(3 * (target.heroId === 'alchemist_quirk' ? 1.35 : 1));
      enemy.hp -= dmg;
      helpers.addFloatingText(enemy.x, enemy.y - 10, `${dmg}`, '#ff7043', 0.85);
      helpers.spawnParticles(enemy.x, enemy.y, '#ff5722', 3, 25);
    }
  }

  // DOT: Poison
  if (enemy.poisonTimer > 0) {
    enemy.poisonTimer -= dt;
    enemy.poisonTickTimer -= dt;
    if (enemy.poisonTickTimer <= 0) {
      enemy.poisonTickTimer = 0.55;
      const dmg = Math.round(3 * (target.heroId === 'alchemist_quirk' ? 1.35 : 1));
      enemy.hp -= dmg;
      helpers.addFloatingText(enemy.x, enemy.y - 10, `${dmg}`, '#76ff03', 0.85);
      helpers.spawnParticles(enemy.x, enemy.y, '#76ff03', 2, 20);
    }
  }

  // Freeze / Stun
  if (enemy.freezeTimer > 0) {
    enemy.freezeTimer -= dt;
    return;
  }
  if (enemy.stunTimer > 0) {
    enemy.stunTimer -= dt;
    return;
  }

  // Duck curse! Non-boss runs around harmlessly quacking
  if (enemy.duckTimer > 0) {
    enemy.duckTimer -= dt;
    enemy.aiTimer -= dt;
    if (enemy.aiTimer <= 0) {
      enemy.aiTimer = 0.5;
      const ang = rng.float(0, Math.PI * 2);
      enemy.vx = Math.cos(ang) * 45;
      enemy.vy = Math.sin(ang) * 45;
      helpers.addFloatingText(enemy.x, enemy.y - 12, '嘎嘎!', '#ffee58', 0.8);
    }
    const mv = moveCircleWithCollisions(world.map, world.props, enemy.x, enemy.y, enemy.vx * dt, enemy.vy * dt, enemy.radius);
    enemy.x = mv.x;
    enemy.y = mv.y;
    return;
  }

  // Slacker priest Lv.7 sanctuary slows enemies inside
  let slowFactor = enemy.poisonTimer > 0 ? 0.78 : 1.0;
  for (const s of world.sanctuaries) {
    if (s.levelMax && Math.hypot(enemy.x - s.x, enemy.y - s.y) < s.radius) {
      slowFactor *= 0.65;
    }
  }
  const speedMult = (world.dailyFactors.includes('turbo_speed') ? 1.3 : 1.0) * slowFactor;
  const bulletSpeedBase = (68 + world.floor * 3.5) * (world.dailyFactors.includes('turbo_speed') ? 1.25 : 1);
  const dmgMult = world.dailyFactors.includes('glass_cannon') ? 2 : 1;

  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const angToPlayer = Math.atan2(dy, dx);
  enemy.facingX = dx >= 0 ? 1 : -1;

  // Gold slime flees!
  if (enemy.kind === 'gold_slime') {
    const fleeSpeed = enemy.speed * speedMult;
    const mv = moveCircleWithCollisions(
      world.map,
      world.props,
      enemy.x,
      enemy.y,
      (-dx / dist) * fleeSpeed * dt,
      (-dy / dist) * fleeSpeed * dt,
      enemy.radius
    );
    enemy.x = mv.x;
    enemy.y = mv.y;
    return;
  }

  // Movement behavior
  if (enemy.speed > 0) {
    const preferredRange =
      enemy.kind === 'goblin_spear' ||
      enemy.kind === 'boar_rider' ||
      enemy.kind === 'frost_troll' ||
      enemy.kind === 'boom_skull' ||
      enemy.kind === 'headless_knight' ||
      enemy.kind === 'spring_boxer' ||
      enemy.kind === 'obsidian_knight' ||
      enemy.kind === 'mimic_chest_boss' ||
      enemy.kind === 'boss_goose_king'
        ? 16
        : enemy.isBoss
          ? 78
          : 82;

    let moveX = 0;
    let moveY = 0;
    if (dist > preferredRange + 14) {
      moveX = dx / dist;
      moveY = dy / dist;
    } else if (dist < preferredRange - 18 && preferredRange > 30) {
      moveX = -dx / dist;
      moveY = -dy / dist;
    } else {
      // Strafe gently
      const strafeDir = (enemy.aiPhase % 2 === 0 ? 1 : -1);
      moveX = (-dy / dist) * 0.55 * strafeDir;
      moveY = (dx / dist) * 0.55 * strafeDir;
    }
    const spd = enemy.speed * speedMult;
    const mv = moveCircleWithCollisions(
      world.map,
      world.props,
      enemy.x,
      enemy.y,
      moveX * spd * dt,
      moveY * spd * dt,
      enemy.radius
    );
    enemy.x = mv.x;
    enemy.y = mv.y;
  }

  // Contact damage for rush enemies
  if (dist < enemy.radius + target.radius + 2 && enemy.attackCooldown <= 0.35) {
    helpers.damagePlayer(target, 1 * dmgMult);
    // Secret Goose King weapon-steal gag!
    if (enemy.kind === 'boss_goose_king' && target.weapons.length > 1 && rng.chance(0.32)) {
      const offIdx = target.activeWeaponIndex === 0 ? 1 : 0;
      const stolen = target.weapons.splice(offIdx, 1)[0];
      if (target.activeWeaponIndex >= target.weapons.length) target.activeWeaponIndex = 0;
      world.pickups.push({
        id: `pk_goose_${eProjUid++}`,
        kind: 'weapon',
        x: target.x + rng.float(-38, 38),
        y: target.y + rng.float(-38, 38),
        vx: 0,
        vy: 0,
        value: 0,
        weapon: stolen,
        roomId: enemy.roomId
      });
      enemy.bossSpeech = '嘎嘎！副武器没收了，快去捡！';
      enemy.bossSpeechTimer = 2.5;
      helpers.addFloatingText(target.x, target.y - 16, '大鹅叼走了副武器！', '#ffee58', 1.1);
    }
  }

  // Attack cooldown
  enemy.attackCooldown -= dt * slowFactor;
  if (enemy.attackCooldown > 0) return;

  const fireEnemyBullet = (
    angle: number,
    speed: number,
    color = '#ff4d6d',
    radius = 4,
    damage = 1,
    shape: ProjectileState['shape'] = 'orb',
    homing = 0
  ) => {
    world.projectiles.push({
      id: `ep_${eProjUid++}`,
      ownerId: enemy.id,
      fromPlayer: false,
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      damage: damage * dmgMult,
      isCrit: false,
      life: 3.4,
      maxLife: 3.4,
      color,
      shape,
      pierce: 0,
      bouncesLeft: 0,
      homingStrength: homing,
      elements: [],
      hitIds: []
    });
  };

  // === BOSS PATTERNS ===
  if (enemy.isBoss) {
    stepBossAttack(world, enemy, target, angToPlayer, bulletSpeedBase, dmgMult, rng, fireEnemyBullet, helpers);
    return;
  }

  // === SPECIAL / ELITE / NORMAL ENEMY ATTACKS ===
  enemy.aiPhase = (enemy.aiPhase + 1) % 4;
  switch (enemy.kind) {
    case 'goblin_spear':
    case 'boar_rider':
    case 'frost_troll':
    case 'skeleton_shield':
    case 'spring_boxer':
    case 'headless_knight':
    case 'obsidian_knight': {
      // Melee shockwave / 3-way fan
      const n = enemy.isElite || enemy.kind === 'obsidian_knight' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.25;
        fireEnemyBullet(angToPlayer + off, bulletSpeedBase * 1.05, '#ff7043', 4, 1);
      }
      enemy.attackCooldown = 1.45;
      break;
    }
    case 'goblin_bomber':
    case 'goblin_chemist': {
      world.hazards.push({
        id: `hz_${eProjUid++}`,
        kind: 'bomb_warn',
        x: target.x + rng.float(-12, 12),
        y: target.y + rng.float(-12, 12),
        radius: 26,
        timer: 1.05,
        maxTimer: 1.05,
        damage: 2 * dmgMult,
        fromPlayer: false,
        canBreakWall: true
      });
      enemy.attackCooldown = 2.2;
      break;
    }
    case 'goblin_shaman':
    case 'blizzard_sprite':
    case 'void_tentacle':
    case 'inferno_warlock': {
      const count = enemy.isElite ? 8 : 6;
      const base = enemy.aiPhase * 0.35;
      const col =
        enemy.kind === 'blizzard_sprite'
          ? '#4fc3f7'
          : enemy.kind === 'void_tentacle'
            ? '#ce93d8'
            : '#ff9800';
      for (let i = 0; i < count; i++) {
        fireEnemyBullet(base + (i * Math.PI * 2) / count, bulletSpeedBase * 0.85, col, 4, 1);
      }
      enemy.attackCooldown = 2.05;
      break;
    }
    case 'armed_merchant': {
      // Gatling fury!
      for (let i = -2; i <= 2; i++) {
        fireEnemyBullet(angToPlayer + i * 0.14 + rng.float(-0.04, 0.04), bulletSpeedBase * 1.2, '#ffd54f', 4, 1, 'coin');
      }
      enemy.attackCooldown = 0.85;
      break;
    }
    case 'mimic_chest_boss':
    case 'angry_frog': {
      const n = 7;
      for (let i = 0; i < n; i++) {
        fireEnemyBullet(angToPlayer - 0.6 + (i * 1.2) / (n - 1), bulletSpeedBase * 0.95, '#ff4081', 4.5, 1);
      }
      enemy.attackCooldown = 1.35;
      break;
    }
    case 'boss_totem_pillar':
    case 'alchemy_turret':
    case 'astral_eye': {
      for (let i = 0; i < 4; i++) {
        fireEnemyBullet(enemy.aiPhase * 0.4 + (i * Math.PI) / 2, bulletSpeedBase * 0.9, '#ff5277', 4, 1);
      }
      enemy.attackCooldown = 1.65;
      break;
    }
    default: {
      // Standard shooter (dart, archer, gunner, mage, drake, ghost, ufo)
      const count = enemy.isElite || enemy.kind === 'ufo_elite' || enemy.kind === 'ice_miner' ? 3 : 2;
      const homing = enemy.kind === 'skeleton_mage' ? 1.8 : 0;
      const col = enemy.kind === 'skeleton_mage' ? '#b388ff' : '#ff4d6d';
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 0.18;
        fireEnemyBullet(angToPlayer + off, bulletSpeedBase, col, 4, 1, 'orb', homing);
      }
      enemy.attackCooldown = 1.6;
      break;
    }
  }
}

function stepBossAttack(
  world: WorldState,
  boss: EnemyState,
  target: PlayerState,
  angToPlayer: number,
  bulletSpeed: number,
  dmgMult: number,
  rng: SeededRNG,
  fire: (
    angle: number,
    speed: number,
    color?: string,
    radius?: number,
    damage?: number,
    shape?: ProjectileState['shape'],
    homing?: number
  ) => void,
  helpers: EnemyAIHelpers
) {
  const halfHp = boss.hp <= boss.maxHp * 0.5;
  boss.aiPhase = (boss.aiPhase + 1) % 3;

  switch (boss.kind) {
    case 'boss_goblin_priest': {
      if (halfHp && !boss.stageTriggered) {
        boss.stageTriggered = true;
        boss.bossSpeech = '召唤物业图腾柱！打爆它算你赢！';
        boss.bossSpeechTimer = 3.0;
        const room = world.map.rooms.find((r) => r.id === boss.roomId);
        if (room) {
          world.enemies.push(
            createEnemy('boss_totem_pillar', room.id, room.cx - 80, room.cy - 45, world.floor),
            createEnemy('boss_totem_pillar', room.id, room.cx + 80, room.cy + 45, world.floor)
          );
        }
      }
      if (boss.aiPhase === 0) {
        // Fan fireballs
        for (let i = -2; i <= 2; i++) {
          fire(angToPlayer + i * 0.2, bulletSpeed * 1.0, '#ff6d00', 5, 1);
        }
      } else if (boss.aiPhase === 1) {
        // Meteor rain telegraphs
        const room = world.map.rooms.find((r) => r.id === boss.roomId);
        for (let i = 0; i < (halfHp ? 6 : 4); i++) {
          const mx = (room ? room.cx : target.x) + rng.float(-100, 100);
          const my = (room ? room.cy : target.y) + rng.float(-65, 65);
          world.hazards.push({
            id: `met_${eProjUid++}`,
            kind: 'meteor_warn',
            x: mx,
            y: my,
            radius: 24,
            timer: 1.0,
            maxTimer: 1.0,
            damage: 2 * dmgMult,
            fromPlayer: false
          });
        }
      } else {
        // Ring burst
        const n = halfHp ? 14 : 10;
        for (let i = 0; i < n; i++) {
          fire((i * Math.PI * 2) / n + boss.aiTimer, bulletSpeed * 0.85, '#ff3b5c', 4.5, 1);
        }
      }
      boss.attackCooldown = halfHp ? 1.2 : 1.55;
      break;
    }

    case 'boss_yeti_king': {
      if (boss.aiPhase === 0) {
        for (let i = -3; i <= 3; i++) {
          fire(angToPlayer + i * 0.16, bulletSpeed * 1.05, '#4fc3f7', 5, 1);
        }
      } else if (boss.aiPhase === 1) {
        // Slam warning + ring
        world.hazards.push({
          id: `slam_${eProjUid++}`,
          kind: 'bomb_warn',
          x: target.x,
          y: target.y,
          radius: 34,
          timer: 0.9,
          maxTimer: 0.9,
          damage: 2 * dmgMult,
          fromPlayer: false
        });
        for (let i = 0; i < 12; i++) {
          fire((i * Math.PI * 2) / 12, bulletSpeed * 0.9, '#80d8ff', 4.5, 1);
        }
      } else {
        for (let i = -1; i <= 1; i++) {
          fire(angToPlayer + i * 0.28, bulletSpeed * 1.25, '#e1f5fe', 6, 2);
        }
      }
      boss.attackCooldown = halfHp ? 1.1 : 1.45;
      break;
    }

    case 'boss_skeleton_lord': {
      if (halfHp && !boss.stageTriggered) {
        boss.stageTriggered = true;
        boss.bossSpeech = '骷髅小弟们，起来蹦迪！！';
        boss.bossSpeechTimer = 3.0;
        for (let i = 0; i < 3; i++) {
          world.enemies.push(
            createEnemy('boom_skull', boss.roomId, boss.x + rng.float(-50, 50), boss.y + rng.float(-40, 40), world.floor)
          );
        }
      }
      if (boss.aiPhase === 0) {
        for (let i = 0; i < 14; i++) {
          fire((i * Math.PI * 2) / 14, bulletSpeed * 0.85, '#ce93d8', 4.5, 1);
        }
      } else if (boss.aiPhase === 1) {
        for (let i = 0; i < 14; i++) {
          fire((i * Math.PI * 2) / 14 + 0.22, bulletSpeed * 0.95, '#ff4081', 4.5, 1);
        }
      } else {
        for (let i = -2; i <= 2; i++) {
          fire(angToPlayer + i * 0.22, bulletSpeed * 1.15, '#e040fb', 5, 1, 'orb', 1.4);
        }
      }
      boss.attackCooldown = halfHp ? 1.05 : 1.35;
      break;
    }

    case 'boss_steam_mech': {
      if (halfHp && !boss.stageTriggered) {
        boss.stageTriggered = true;
        boss.bossSpeech = '装甲过载！部署维修无人机！';
        boss.bossSpeechTimer = 3.0;
        world.enemies.push(
          createEnemy('boss_drone', boss.roomId, boss.x - 45, boss.y - 30, world.floor),
          createEnemy('boss_drone', boss.roomId, boss.x + 45, boss.y + 30, world.floor)
        );
      }
      if (boss.aiPhase === 0) {
        // Homing micro-missiles
        for (let i = -1; i <= 1; i++) {
          fire(angToPlayer + i * 0.45, bulletSpeed * 0.88, '#ff5252', 5.5, 2, 'bomb', 2.6);
        }
      } else if (boss.aiPhase === 1) {
        // High-speed gatling stream
        for (let i = -3; i <= 3; i++) {
          fire(angToPlayer + i * 0.1, bulletSpeed * 1.25, '#ffb74d', 4, 1);
        }
      } else {
        for (let i = 0; i < 16; i++) {
          fire((i * Math.PI * 2) / 16, bulletSpeed * 0.85, '#ffd54f', 4.5, 1);
        }
      }
      boss.attackCooldown = halfHp ? 1.05 : 1.35;
      break;
    }

    case 'boss_twin_dragon': {
      // Bickering gag: 15% chance heads argue and self-stun 1.8s!
      if (halfHp && rng.chance(0.16)) {
        boss.stunTimer = 1.8;
        boss.bossSpeech = '冰头：别烤我脖子！ 火头：你冰到我鳞片了！（吵架硬直！）';
        boss.bossSpeechTimer = 2.4;
        helpers.addFloatingText(boss.x, boss.y - 24, '两头吵架硬直！快输出！', '#ffeb3b', 1.2);
        boss.attackCooldown = 1.2;
        return;
      }
      if (boss.aiPhase === 0) {
        // Ice fan + Fire fan crossed
        for (let i = -3; i <= 3; i++) {
          fire(angToPlayer + i * 0.18, bulletSpeed * 1.05, i % 2 === 0 ? '#4fc3f7' : '#ff5722', 5, 1);
        }
      } else if (boss.aiPhase === 1) {
        // Dual spiral ring
        const n = halfHp ? 18 : 12;
        for (let i = 0; i < n; i++) {
          fire((i * Math.PI * 2) / n + world.time, bulletSpeed * 0.9, i % 2 === 0 ? '#ff6d00' : '#40c4ff', 4.5, 1);
        }
      } else {
        for (let i = 0; i < (halfHp ? 7 : 4); i++) {
          world.hazards.push({
            id: `dm_${eProjUid++}`,
            kind: 'meteor_warn',
            x: target.x + rng.float(-90, 90),
            y: target.y + rng.float(-60, 60),
            radius: 26,
            timer: 0.95,
            maxTimer: 0.95,
            damage: 2 * dmgMult,
            fromPlayer: false
          });
        }
      }
      boss.attackCooldown = halfHp ? 0.95 : 1.25;
      break;
    }

    case 'boss_glitch_lord': {
      if (halfHp && !boss.stageTriggered) {
        boss.stageTriggered = true;
        world.glitchBlueScreenTimer = 0.42;
        boss.bossSpeech = 'FATAL ERROR 0x404：启动蓝屏分身协议！';
        boss.bossSpeechTimer = 3.2;
        world.enemies.push(
          createEnemy('boss_glitch_clone', boss.roomId, boss.x - 60, boss.y, world.floor),
          createEnemy('boss_glitch_clone', boss.roomId, boss.x + 60, boss.y, world.floor)
        );
      }
      if (boss.aiPhase === 0) {
        // Square grid bullets
        for (let i = 0; i < 16; i++) {
          fire((i * Math.PI * 2) / 16, bulletSpeed * (i % 2 === 0 ? 1.15 : 0.78), '#00e5ff', 4.5, 1);
        }
      } else if (boss.aiPhase === 1) {
        for (let i = -3; i <= 3; i++) {
          fire(angToPlayer + i * 0.14, bulletSpeed * 1.18, '#ff4081', 5, 1);
        }
      } else {
        for (let i = 0; i < 5; i++) {
          world.hazards.push({
            id: `gl_${eProjUid++}`,
            kind: 'bomb_warn',
            x: target.x + rng.float(-85, 85),
            y: target.y + rng.float(-65, 65),
            radius: 24,
            timer: 0.9,
            maxTimer: 0.9,
            damage: 2 * dmgMult,
            fromPlayer: false
          });
        }
      }
      boss.attackCooldown = halfHp ? 0.95 : 1.2;
      break;
    }

    case 'boss_goose_king': {
      if (boss.aiPhase === 0) {
        // Flying utility bills!
        for (let i = -3; i <= 3; i++) {
          fire(angToPlayer + i * 0.2, bulletSpeed * 1.12, '#ffffff', 5, 1, 'bill');
        }
      } else if (boss.aiPhase === 1) {
        // Honk ring!
        boss.bossSpeech = '嘎嘎嘎！！催缴水电费！！';
        boss.bossSpeechTimer = 1.8;
        for (let i = 0; i < 14; i++) {
          fire((i * Math.PI * 2) / 14, bulletSpeed * 0.95, '#ffeb3b', 5, 1, 'bill');
        }
      } else {
        // Homing bill barrage
        for (let i = -1; i <= 1; i++) {
          fire(angToPlayer + i * 0.5, bulletSpeed * 0.95, '#ffffff', 5.5, 1, 'bill', 2.2);
        }
      }
      boss.attackCooldown = 1.05;
      break;
    }
  }
}
