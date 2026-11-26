import { HeroId, WeaponId } from '../sim/types';

/**
 * High-Charm Outlined Pixel Sprite Generator (Multi-tone shading + distinct silhouettes).
 */
const spriteCache = new Map<string, HTMLCanvasElement>();

function makeSprite(grid: string[], palette: Record<string, string>): HTMLCanvasElement {
  const h = grid.length;
  const w = grid[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
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
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

const HERO_GRIDS: Record<HeroId, string[]> = {
  // Steel bucket helmet with specular shine + visor slit + knight cape
  bucket_knight: [
    '....OOOOOOOO....',
    '...OAAHHHHAAO...',
    '...OAAAAAAAAO...',
    '...OAADDDDAAO...',
    '...OAOOKKOOAO...',
    '...OAAWWWWAAO...',
    '...OAAAAAAAAO...',
    '..OOCCCCCCCCOO..',
    '.OCBBBBBBBBBBCO.',
    '.OCBBBYYYYBBBCO.',
    '.OOCBBBBBBBBCOO.',
    '...OOBBBBBBOO...',
    '...OODDOODDOO...',
    '...OODDOODDOO...',
    '...OO..OO..OO...',
    '................'
  ],
  // Brass workshop goggles + tall cap + sticker apron
  sticker_smith: [
    '.....OOOOOO.....',
    '....OAAHHAAO....',
    '...OAAAAAAAAO...',
    '..OOYYOYYOYYOO..',
    '..OOGGOOOGGOOO..',
    '..OOSSSSSSSSOO..',
    '...OSSSSSSSSO...',
    '..OOBBBBBBBBOO..',
    '.OOBBCCCCCCBBOO.',
    '.OOBBCYYYYCBBOO.',
    '..OOBBCCCCBBOO..',
    '...OOBBBBBBOO...',
    '...OODDOODDOO...',
    '...OO..OO..OO...',
    '................',
    '................'
  ],
  // Pointed black cat ears + bright eyes + flowing red scarf
  ranger_cat: [
    '..OO........OO..',
    '..OAO......OAO..',
    '..OAAOOOOOOAAO..',
    '..OAAAAAAAAAAO..',
    '..OAAYYAAYYAAO..',
    '..OAAKKAAKKAAO..',
    '...OAAAPPAAAO...',
    '..OOCCCCCCCCOO..',
    '.OCCCCCCCCCCCCO.',
    '..OOBBBBBBBBOO..',
    '...OOBBBBBBOO...',
    '...OOBBOOBBOO...',
    '...OODDOODDOO...',
    '...OO..OO..OO...',
    '................',
    '................'
  ],
  // Hooded alchemist + glowing emerald goggles + lab coat
  alchemist_quirk: [
    '.....OOOOOO.....',
    '....OAAAAAAO....',
    '...OAAHHHHAAO...',
    '..OAAAAAAAAAAO..',
    '..OADGGDDGGDAO..',
    '..OADGGDDGGDAO..',
    '...OADDDDDDAO...',
    '..OOBBBBBBBBOO..',
    '.OOBBCCCCCCBBOO.',
    '.OOBBCGGGGCBBOO.',
    '..OOBBBBBBBBOO..',
    '...OOBBOOBBOO...',
    '...OODDOODDOO...',
    '...OO..OO..OO...',
    '................',
    '................'
  ],
  // Floating golden halo + cozy robe
  slacker_priest: [
    '....OYYYYYYO....',
    '....OOOOOOOO....',
    '...OAAHHHHAAO...',
    '..OAAAAAAAAAAO..',
    '..OOSSSSSSSSOO..',
    '..OSSKSSSSKSSO..',
    '..OSSSSSSSSSSO..',
    '..OOBBBBBBBBOO..',
    '.OOBBCCCCCCBBOO.',
    '.OOBBCYYYYCBBOO.',
    '.OOBBCCCCCCBBOO.',
    '..OOBBBBBBBBOO..',
    '...OOBBOOBBOO...',
    '...OO..OO..OO...',
    '................',
    '................'
  ],
  // Horned samurai crest + intense eyes + dark haori
  blade_ashura: [
    '..OY........YO..',
    '..OYYO....OYYO..',
    '...OAAOOOOAAO...',
    '..OAAHHHHHHAAO..',
    '..OOSSSSSSSSOO..',
    '..OSSRSSSSRSSO..',
    '...OSSSSSSSSO...',
    '..OOCCCCCCCCOO..',
    '.OCBBBBBBBBBBCO.',
    '.OCBBCYYYYCBBCO.',
    '..OOBBBBBBBBOO..',
    '...OOBBOOBBOO...',
    '...OODDOODDOO...',
    '...OO..OO..OO...',
    '................',
    '................'
  ]
};

const PET_GRID = [
  '................',
  '................',
  '...OO......OO...',
  '..OAAO....OAAO..',
  '..OAAOOOOOOAAO..',
  '.OAAHHAAAAHHAAO.',
  '.OAAWAAAAAAWAAO.',
  '.OAAKAAKKAAKAAO.',
  '.OAAAAAPPPAAAAO.',
  '..OAAABBBBAAAO..',
  '..OAAAAAAAAAAO..',
  '...OAAO..OAAO...',
  '...OOO....OOO...',
  '................',
  '................',
  '................'
];

const GOBLIN_GRID = [
  '................',
  '.OO..........OO.',
  'OAAOOOOOOOOOOAAO',
  '.OAAHHHHHHHHAAO.',
  '.OAAARAAAARAAAO.',
  '.OAAAAAAAAAAAAO.',
  '..OAAWWWWWWAAO..',
  '..OOBBBBBBBBOO..',
  '.OBBBCCCCCCBBBO.',
  '.OBBBCYYYYCBBBO.',
  '..OOBBBBBBBBOO..',
  '...OOBO..OBOO...',
  '...OOO....OOO...',
  '................',
  '................',
  '................'
];

const BOSS_GRID = [
  '....OO..OO..OO....',
  '...OYYOOYYOOYYO...',
  '..OYYHHYYYYHHYYO..',
  '..OAAAAAAAAAAAAO..',
  '.OAAARRAAAARRAAAO.',
  '.OAAAYRAAAAYRAAAO.',
  '.OAAAAAAAAAAAAAAO.',
  '.OAAAWWWWWWWWAAAO.',
  '..OAAAAAAAAAAAAO..',
  '.OOBBBBBBBBBBBBOO.',
  'OOBBCCCCCCCCCCBBOO',
  'OOBBCYYYYYYYYCBBOO',
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

// Crisp 16x10 pixel weapon sprites!
const WEAPON_SHAPES: Record<string, string[]> = {
  fish: [
    '................',
    '......OOOOOO....',
    '..OO.OAAHHAAOO..',
    '.OAAOAAAAAAAKAO.',
    '.OAAAAAAAAAAAAO.',
    '..OO.OAAAAAAOO..',
    '......OOOOOO....',
    '................'
  ],
  chicken: [
    '..........OOO...',
    '.........OYYYO..',
    '..OOOOOO.OYKYRO.',
    '.OYYYYYYOOYYYOO.',
    '.OYYYYYYYYYYO...',
    '..OOOOOOOOOO....',
    '................',
    '................'
  ],
  pan: [
    '........OOOOO...',
    '.......OYYHHYO..',
    '.OOOOOOYYYYYYO..',
    '.ODDDDOYYYYYYO..',
    '.OOOOOOYYYYYYO..',
    '.......OYYYYYO..',
    '........OOOOO...',
    '................'
  ],
  sword: [
    '....O...........',
    '...OYO..OOOOOOO.',
    '.OOYYOOAAHHHHAAO',
    '.ODYYOAAAAAAAAAO',
    '...OYO..OOOOOOO.',
    '....O...........',
    '................',
    '................'
  ],
  staff: [
    '..........OOOO..',
    '.........OAHHAO.',
    '.OOOOOOOOOAAAAO.',
    '.ODDDDDDDOAAAAO.',
    '.OOOOOOOOOAAAAO.',
    '.........OAAAAO.',
    '..........OOOO..',
    '................'
  ],
  gatling: [
    '..OOOOOOOOOOOO..',
    '.OAAHHHHAAAAAAO.',
    '.OADDDDDDDDDAAO.',
    '.OAAAAAAAAAAAAO.',
    '..OOODDOOOOOOO..',
    '....O..O........',
    '................',
    '................'
  ],
  gun: [
    '................',
    '..OOOOOOOOOO....',
    '.OAAHHHHAAAAO...',
    '.OAAAAAAAAAAO...',
    '..OODDOOOOOO....',
    '..O..O..........',
    '................',
    '................'
  ],
  bow: [
    '......OOO.......',
    '........OO......',
    '..OOOOOOOAO.....',
    '.OAAHHHHAAAO....',
    '..OOOOOOOAO.....',
    '........OO......',
    '......OOO.......',
    '................'
  ]
};

export function getHeroSprite(
  heroId: HeroId | string,
  color: string,
  accent: string,
  flash = false
): HTMLCanvasElement {
  const key = `hero_${heroId}_${color}_${accent}_${flash}`;
  let spr = spriteCache.get(key);
  if (!spr) {
    const grid = HERO_GRIDS[heroId as HeroId] ?? HERO_GRIDS.bucket_knight;
    spr = makeSprite(grid, {
      O: '#110e18',
      A: flash ? '#ffffff' : accent,
      H: '#ffffff',
      D: flash ? '#ffffff' : '#37474f',
      S: flash ? '#ffffff' : '#ffdbac',
      W: '#e0f7fa',
      K: '#110e18',
      C: flash ? '#ffffff' : accent,
      B: flash ? '#ffffff' : color,
      Y: '#ffd54f',
      G: '#69f0ae',
      P: '#ff80ab',
      R: '#ff3b5c'
    });
    spriteCache.set(key, spr);
  }
  return spr;
}

export function getWeaponSprite(weaponId: WeaponId, color: string): HTMLCanvasElement {
  const key = `wpn_${weaponId}_${color}`;
  let spr = spriteCache.get(key);
  if (!spr) {
    let shapeKey = 'gun';
    if (weaponId === 'salted_fish') shapeKey = 'fish';
    else if (weaponId === 'rubber_chicken') shapeKey = 'chicken';
    else if (weaponId === 'golden_pan' || weaponId === 'bug_zapper') shapeKey = 'pan';
    else if (weaponId === 'goblin_gatling' || weaponId === 'carrot_gatling' || weaponId === 'twin_flamethrower' || weaponId === 'mech_laser_arm') shapeKey = 'gatling';
    else if (weaponId.includes('sword') || weaponId === 'twin_lightsaber' || weaponId === 'plunger_spear' || weaponId === 'folding_stool' || weaponId === 'goblin_totem') shapeKey = 'sword';
    else if (weaponId.includes('staff') || weaponId.includes('tome') || weaponId.includes('bible') || weaponId.includes('prism') || weaponId.includes('vacuum')) shapeKey = 'staff';
    else if (weaponId.includes('bow') || weaponId === 'slingshot' || weaponId === 'boomerang_blade') shapeKey = 'bow';

    spr = makeSprite(WEAPON_SHAPES[shapeKey], {
      O: '#110e18',
      A: color,
      H: '#ffffff',
      D: '#546e7a',
      Y: '#ffd54f',
      K: '#110e18',
      R: '#ff5252'
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
      H: '#ffffff',
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
      H: '#ffffff',
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
