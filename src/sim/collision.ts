import { FloorMap, PropState, TILE_SIZE, TileType } from './types';

export function getTileAt(map: FloorMap, tx: number, ty: number): TileType {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) {
    return TileType.VOID;
  }
  return map.tiles[ty * map.width + tx] as TileType;
}

export function setTileAt(map: FloorMap, tx: number, ty: number, tile: TileType): void {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
  map.tiles[ty * map.width + tx] = tile;
}

export function isSolidTile(tile: TileType): boolean {
  return (
    tile === TileType.VOID ||
    tile === TileType.WALL ||
    tile === TileType.DOOR_LOCKED ||
    tile === TileType.CRACKED_WALL
  );
}

export function isPointSolid(map: FloorMap, px: number, py: number): boolean {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  return isSolidTile(getTileAt(map, tx, ty));
}

export function circleIntersectsSolidTile(
  map: FloorMap,
  x: number,
  y: number,
  radius: number
): boolean {
  const minTx = Math.floor((x - radius) / TILE_SIZE);
  const maxTx = Math.floor((x + radius) / TILE_SIZE);
  const minTy = Math.floor((y - radius) / TILE_SIZE);
  const maxTy = Math.floor((y + radius) / TILE_SIZE);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolidTile(getTileAt(map, tx, ty))) continue;
      const rx = tx * TILE_SIZE;
      const ry = ty * TILE_SIZE;
      const closestX = Math.max(rx, Math.min(x, rx + TILE_SIZE));
      const closestY = Math.max(ry, Math.min(y, ry + TILE_SIZE));
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < radius * radius) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Axis-separated movement with smooth sliding against tile walls & solid props.
 */
export function moveCircleWithCollisions(
  map: FloorMap,
  props: PropState[],
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius: number
): { x: number; y: number; hitX: boolean; hitY: boolean } {
  let nx = x + dx;
  let ny = y;
  let hitX = false;
  let hitY = false;

  if (circleIntersectsSolidTile(map, nx, ny, radius) || collidesWithProps(props, nx, ny, radius)) {
    nx = x;
    hitX = true;
  }

  ny = y + dy;
  if (circleIntersectsSolidTile(map, nx, ny, radius) || collidesWithProps(props, nx, ny, radius)) {
    ny = y;
    hitY = true;
  }

  return { x: nx, y: ny, hitX, hitY };
}

function collidesWithProps(props: PropState[], x: number, y: number, radius: number): boolean {
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.hp <= 0) continue;
    const dx = x - p.x;
    const dy = y - p.y;
    const minDist = radius + p.radius;
    if (dx * dx + dy * dy < minDist * minDist) {
      return true;
    }
  }
  return false;
}

/**
 * Simple tile raycast for line-of-sight & laser hit point calculation.
 */
export function raycastSolid(
  map: FloorMap,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stepPx = 4
): { blocked: boolean; hitX: number; hitY: number; hitTile: TileType; tx: number; ty: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) {
    const tx = Math.floor(x1 / TILE_SIZE);
    const ty = Math.floor(y1 / TILE_SIZE);
    return { blocked: false, hitX: x2, hitY: y2, hitTile: getTileAt(map, tx, ty), tx, ty };
  }
  const steps = Math.ceil(dist / stepPx);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    const tile = getTileAt(map, tx, ty);
    if (isSolidTile(tile)) {
      return { blocked: true, hitX: px, hitY: py, hitTile: tile, tx, ty };
    }
  }
  const tx = Math.floor(x2 / TILE_SIZE);
  const ty = Math.floor(y2 / TILE_SIZE);
  return { blocked: false, hitX: x2, hitY: y2, hitTile: getTileAt(map, tx, ty), tx, ty };
}
