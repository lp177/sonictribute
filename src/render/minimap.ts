import { PHYS } from '../physics/constants.ts';
import { Level, type LevelDef, type LevelTheme } from '../game/Level.ts';

const T = PHYS.tile;

/** Per-theme colours for the level-select thumbnails. */
const MINI: Record<LevelTheme, { sky: [string, string]; ground: string; cap: string; deco: string }> = {
  verdant: { sky: ['#1b2c50', '#6b4a3f'], ground: '#2b2016', cap: '#3fae5a', deco: '#ffd94a' },
  gear: { sky: ['#0d0d16', '#3a2620'], ground: '#23262e', cap: '#7b8496', deco: '#e8c832' },
  crystal: { sky: ['#080513', '#241640'], ground: '#221739', cap: '#45c3e2', deco: '#ff6bd6' },
  neon: { sky: ['#0a0618', '#33104a'], ground: '#161420', cap: '#ff4fa3', deco: '#41f0ff' },
};

/**
 * Renders a recognisable postcard of an act for the level select: the real
 * terrain silhouette of the whole map (so each act's actual shape IS its
 * picture), with the route landmarks — crystals, springs, the goal — dotted
 * on top. Built once per act and cached by the caller.
 */
export function renderThumbnail(def: LevelDef, w = 132, h = 36): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const level = new Level(def);
  const pal = MINI[def.theme];

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, pal.sky[0]);
  sky.addColorStop(1, pal.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sx = w / level.map.w;
  const sy = h / level.map.h;

  // Terrain: one column of pixels per run of tiles, cap highlighted.
  for (let tx = 0; tx < level.map.w; tx++) {
    let capDrawn = false;
    for (let ty = 0; ty < level.map.h; ty++) {
      const tile = level.map.get(tx, ty, 0);
      if (!tile.heights.some((v) => v > 0)) continue;
      const x = tx * sx;
      const y = ty * sy;
      if (!capDrawn && !tile.oneWay) {
        ctx.fillStyle = pal.cap;
        ctx.fillRect(x, y, Math.ceil(sx), Math.max(1, sy * 0.6));
        capDrawn = true;
      }
      ctx.fillStyle = tile.oneWay ? pal.cap : pal.ground;
      ctx.globalAlpha = tile.oneWay ? 0.8 : 1;
      ctx.fillRect(x, y + (capDrawn && !tile.oneWay ? sy * 0.6 : 0), Math.ceil(sx), Math.ceil(sy));
      ctx.globalAlpha = 1;
      if (!tile.oneWay) {
        // The rest of this column is body; fill and stop scanning.
        ctx.fillStyle = pal.ground;
        ctx.fillRect(x, y, Math.ceil(sx), h - y);
        break;
      }
    }
  }

  // Landmarks: crystals and the goal, so the postcard hints at the treasure.
  ctx.fillStyle = pal.deco;
  for (const c of level.crystals) ctx.fillRect(c.x * (w / level.map.pixelW) - 1, (c.y / (level.map.h * T)) * h - 1, 2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect((level.goal.x / level.map.pixelW) * w - 1, (level.goal.y / level.map.pixelH) * h - 4, 2, 4);

  return cv;
}
