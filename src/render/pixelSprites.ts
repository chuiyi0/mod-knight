/**
 * Procedural 16x16 / 24x24 Outlined Pixel Sprite Generator.
 * Generates crisp offscreen pixel-art canvases with 1px dark outlines,
 * plus supports seamless drop-in PNG spritesheet overrides later.
 */

const spriteCache = new Map<string, HTMLCanvasElement>();

function makeSprite(grid: string[], palette: Record<string, string>, scale = 1): HTMLCanvasElement {
  const h = grid.length;
  const w = grid[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

const HERO_BASE_GRID = [
  '....OOOOOOOO....',
  '...OAAAAAAAAO...',
  '..OAAAHHHHAAAO..',
  '..OAAAAAAAAAAO..',
  '..OOSSSSSSSSOO..',
  '..OSWOSWOSWSSO..',
  '..OSSSSSSSSSSO..',
  '...OCCCCCCCCO...',
  '..OCCBBBBBBCCO..',
  '..OCCBBBBBBCCO..',
  '..OOCBBBBBBCOO..',
  '...OOBBBBBBOO...',
  '...OOBBOOBBOO...',
  '...OOBBOOBBOO...',
  '...OO..OO..OO...',
  '................'
];

const PET_GRID = [
  '................',
  '................',
  '....OO....OO....',
  '...OAAO..OAAO...',
  '...OAAAAAAAAO...',
  '..OAAWAAAWAAAO..',
  '..OAAKAAAKAAAO..',
  '..OAAAAPPAAAAO..',
  '...OAAAAAAAAO...',
  '...OAAABBBAAO...',
  '...OAAAAAAAAO...',
  '....OO....OO....',
  '................',
  '................',
  '................',
  '................'
];

const GOBLIN_GRID = [
  '................',
  '..OO........OO..',
  '.OAAOOOOOOOOAAO.',
  '..OAAAAAAAAAAO..',
  '..OAAARAAARAAO..',
  '..OAAAAAAAAAAO..',
  '...OAAWWWWAAO...',
  '...OBBBBBBBBO...',
  '..OBBCCCCCCBBO..',
  '..OBBCCCCCCBBO..',
  '...OBBBBBBBBO...',
  '...OOBO..OBOO...',
  '...OOO....OOO...',
  '................',
  '................',
  '................'
];

const BOSS_GRID = [
  '....OO..OO..OO....',
  '...OYYOOYYOOYYO...',
  '..OYYYYYYYYYYYYO..',
  '..OAAAAAAAAAAAAO..',
  '.OAAARRAAAARRAAAO.',
  '.OAAARRAAAARRAAAO.',
  '.OAAAAAAAAAAAAAAO.',
  '.OAAAWWWWWWWWAAAO.',
  '..OAAAAAAAAAAAAO..',
  '.OOBBBBBBBBBBBBOO.',
  'OOBBCCCCCCCCCCBBOO',
  'OOBBCCCCCCCCCCBBOO',
  'OOBBBBBBBBBBBBBBOO',
  '.OOBBBBBBBBBBBBOO.',
  '..OOBBBO..OBBBOO..',
  '..OOOOO....OOOOO..'
];

const GOOSE_GRID = [
  '......OOOO......',
  '.....OWWWWO.....',
  '....OWWKKWWOO...',
  '....OWWWWWYYYO..',
  '.....OWWWOOOO...',
  '.....OWWWO......',
  '....OWWWWWO.....',
  '...OWWWWWWWOO...',
  '..OWWWWRRRWWWO..',
  '..OWWWWWWWWWWO..',
  '...OWWWWWWWWO...',
  '....OOWWWWO.....',
  '.....OY..YO.....',
  '....OYY..YYO....',
  '................',
  '................'
];

const DUCK_GRID = [
  '................',
  '.....OOOO.......',
  '....OYYYYO......',
  '...OYYKYYYO.....',
  '...OYYYYYYOO....',
  '....OYYYYYRO....',
  '...OYYYYYYO.....',
  '..OYYYYYYYYO....',
  '..OYYYYYYYYO....',
  '...OYYYYYYO.....',
  '....OO..OO......',
  '................',
  '................',
  '................',
  '................',
  '................'
];

export function getHeroSprite(color: string, accent: string, flash = false): HTMLCanvasElement {
  const key = `hero_${color}_${accent}_${flash}`;
  let spr = spriteCache.get(key);
  if (!spr) {
    spr = makeSprite(HERO_BASE_GRID, {
      O: '#110e18',
      A: flash ? '#ffffff' : accent,
      H: '#ffffff',
      S: flash ? '#ffffff' : '#ffdbac',
      W: '#110e18',
      C: flash ? '#ffffff' : accent,
      B: flash ? '#ffffff' : color
    });
    spriteCache.set(key, spr);
  }
  return spr;
}

export function getPetSprite(color: string): HTMLCanvasElement {
  const key = `pet_${color}`;
  let spr = spriteCache.get(key);
  if (!spr) {
    spr = makeSprite(PET_GRID, {
      O: '#110e18',
      A: color,
      B: '#ffffff',
      W: '#ffffff',
      K: '#110e18',
      P: '#ff80ab'
    });
    spriteCache.set(key, spr);
  }
  return spr;
}

export function getEnemySprite(
  kind: string,
  color: string,
  accent: string,
  flash = false,
  isDuck = false
): HTMLCanvasElement {
  if (isDuck) {
    const dKey = `duck_${flash}`;
    let d = spriteCache.get(dKey);
    if (!d) {
      d = makeSprite(DUCK_GRID, {
        O: '#110e18',
        Y: flash ? '#ffffff' : '#ffee58',
        K: '#110e18',
        R: '#ff7043'
      });
      spriteCache.set(dKey, d);
    }
    return d;
  }

  if (kind === 'boss_goose_king') {
    const gKey = `goose_${flash}`;
    let g = spriteCache.get(gKey);
    if (!g) {
      g = makeSprite(GOOSE_GRID, {
        O: '#110e18',
        W: flash ? '#ffffff' : '#f5f7fa',
        K: '#110e18',
        Y: '#ff9800',
        R: '#ff1744'
      });
      spriteCache.set(gKey, g);
    }
    return g;
  }

  const isBoss = kind.startsWith('boss_');
  const key = `en_${isBoss ? 'boss' : 'mob'}_${color}_${accent}_${flash}`;
  let spr = spriteCache.get(key);
  if (!spr) {
    spr = makeSprite(isBoss ? BOSS_GRID : GOBLIN_GRID, {
      O: '#110e18',
      A: flash ? '#ffffff' : color,
      B: flash ? '#ffffff' : accent,
      C: flash ? '#ffffff' : '#263238',
      R: '#ff1744',
      W: '#ffffff',
      Y: '#ffd54f'
    });
    spriteCache.set(key, spr);
  }
  return spr;
}
