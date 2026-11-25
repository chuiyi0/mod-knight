import { raycastSolid } from './collision';
import { EnemyState, FloorMap, PlayerState, TILE_SIZE } from './types';

export const AUTO_AIM_RANGE_PX = 11 * TILE_SIZE; // 176 px
export const POINT_BLANK_MELEE_PX = 1.45 * TILE_SIZE; // ~23 px

/**
 * Soul-Knight-style auto-aim:
 * - Looks for visible living enemies within 11 tiles.
 * - Applies 15% sticky distance bonus to currently locked target to avoid jitter.
 * - Falls back to player's movement direction when no target is in sight.
 */
export function updateAutoAim(
  player: PlayerState,
  enemies: EnemyState[],
  map: FloorMap,
  manualAimX?: number,
  manualAimY?: number
): { target: EnemyState | null; isPointBlank: boolean } {
  let best: EnemyState | null = null;
  let bestScore = Infinity;
  let bestRealDist = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.hp <= 0) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > AUTO_AIM_RANGE_PX) continue;

    // Require clear line of sight through solid walls
    const los = raycastSolid(map, player.x, player.y, e.x, e.y, 6);
    if (los.blocked) continue;

    const score = e.id === player.lockedEnemyId ? dist * 0.85 : dist;
    if (score < bestScore) {
      bestScore = score;
      bestRealDist = dist;
      best = e;
    }
  }

  if (best) {
    player.lockedEnemyId = best.id;
    player.aimAngle = Math.atan2(best.y - player.y, best.x - player.x);
    player.facingX = best.x >= player.x ? 1 : -1;
    return {
      target: best,
      isPointBlank: bestRealDist <= POINT_BLANK_MELEE_PX + best.radius
    };
  }

  player.lockedEnemyId = null;
  if (
    manualAimX !== undefined &&
    manualAimY !== undefined &&
    (Math.abs(manualAimX) > 0.1 || Math.abs(manualAimY) > 0.1)
  ) {
    player.aimAngle = Math.atan2(manualAimY, manualAimX);
    player.facingX = manualAimX >= 0 ? 1 : -1;
  } else if (Math.abs(player.vx) > 1 || Math.abs(player.vy) > 1) {
    player.aimAngle = Math.atan2(player.vy, player.vx);
  }
  return { target: null, isPointBlank: false };
}
