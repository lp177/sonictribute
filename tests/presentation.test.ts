import { describe, it, expect } from 'vitest';
import { GLYPHS, hasGlyphs, measureText, wrapLines, glyphKey } from '../src/render/font.ts';
import { fitScale, VIEW_W, VIEW_H, MAX_SCALE } from '../src/core/view.ts';
import { defaultSettings, sanitizeSettings } from '../src/core/settings.ts';
import { buildColumns, solidPolys, columnRuns, ledges, interiorRects } from '../src/render/terrainGeometry.ts';
import { BOSS_TAUNTS } from '../src/game/story.ts';
import { LEVELS, BIOMES } from '../src/levels/index.ts';
import { TileMap, TILE_FULL } from '../src/physics/TileMap.ts';
import { makeFlatMap, fillRect, clearRect } from './helpers.ts';

describe('BOLT Display typeface', () => {
  it('has a glyph for every character the game prints', () => {
    const strings = [
      ...LEVELS.map((l) => l.title.toUpperCase()),
      ...LEVELS.map((l) => l.act),
      ...BIOMES.flatMap((b) => [b.name, b.hour]),
      ...Object.values(BOSS_TAUNTS).flat(),
      'DR. YOLK',
      'WRECKING POD',
      'PISTON CRUSHER',
      'SHARD DRILL',
      'MIRAGE PACER',
      'BOLT GOT THROUGH',
      'CHRONO CRYSTALS 3/5',
      'SECRET ROOM FOUND!',
      'TOTAL 0123456789',
      '1:23.45',
      '★ UNTOUCHABLE',
      '◀ ▶ ← → ↑ ↓',
    ];
    for (const s of strings) expect(hasGlyphs(s), s).toBe(true);
  });

  it('maps lowercase and accented letters onto the caps', () => {
    expect(glyphKey('a')).toBe('A');
    expect(glyphKey('é')).toBe('E');
    expect(glyphKey('ç')).toBe('C');
    expect(glyphKey('~')).toBe('?');
  });

  it('draws figures at one width, so counters never jitter', () => {
    const widths = '0123456789'.split('').map((d) => GLYPHS[d].w);
    expect(new Set(widths).size).toBe(1);
    expect(measureText('1111', 10)).toBeCloseTo(measureText('8888', 10));
  });

  it('kerns open letter pairs tighter than the plain advance', () => {
    const lt = measureText('LT', 10);
    const plain = measureText('LI', 10) + (GLYPHS.T.w - GLYPHS.I.w) * (10 / 6);
    expect(lt).toBeLessThan(plain);
  });

  it('measures proportionally to the size', () => {
    expect(measureText('BOLT', 20)).toBeCloseTo(measureText('BOLT', 10) * 2);
    expect(measureText('', 10)).toBeGreaterThan(0); // the stroke itself
  });

  it('word-wraps prose to a width', () => {
    const lines = wrapLines('one two three four five', 9, (s) => s.length);
    expect(lines).toEqual(['one two', 'three', 'four five']);
    expect(wrapLines('', 10, (s) => s.length)).toEqual([]);
  });
});

describe('render scale', () => {
  it('fills the window in quarter steps, clamped to [1, MAX_SCALE]', () => {
    expect(fitScale(1920, 1080, 1)).toBe(3);
    expect(fitScale(1280, 720, 1)).toBe(2);
    expect(fitScale(1280, 720, 1.5)).toBe(3);
    expect(fitScale(1000, 562.5, 1)).toBe(1.5);
    expect(fitScale(320, 180, 1)).toBe(1);
    expect(fitScale(3840, 2160, 2)).toBe(MAX_SCALE);
  });

  it('keeps the logical view and its 64-px chunk grid on whole device pixels', () => {
    for (let s = 1; s <= MAX_SCALE; s += 0.25) {
      expect(Number.isInteger(VIEW_W * s)).toBe(true);
      expect(Number.isInteger(VIEW_H * s)).toBe(true);
      expect(Number.isInteger(64 * s)).toBe(true);
    }
  });
});

describe('settings', () => {
  it('defaults respect reduced motion', () => {
    expect(defaultSettings(true).screenShake).toBe(false);
    expect(defaultSettings(true).flashes).toBe(false);
    expect(defaultSettings(false).screenShake).toBe(true);
  });

  it('sanitises stored junk field by field', () => {
    const base = defaultSettings(false);
    const s = sanitizeSettings({ musicVolume: 7, sfxVolume: '0.3', touch: 'sometimes', crt: false, preciseTimer: 1 }, base);
    expect(s.musicVolume).toBe(1);
    expect(s.sfxVolume).toBe(base.sfxVolume);
    expect(s.touch).toBe('auto');
    expect(s.crt).toBe(false);
    expect(s.preciseTimer).toBe(base.preciseTimer);
    expect(sanitizeSettings(null, base)).toEqual(base);
  });

  it('snaps volumes to tenths', () => {
    expect(sanitizeSettings({ musicVolume: 0.33 }).musicVolume).toBe(0.3);
  });
});

describe('terrain geometry', () => {
  it('turns a flat floor into one run per column down to the window', () => {
    const map = makeFlatMap(10, 10, 96);
    const runs = columnRuns(map, 20, 0, 160);
    expect(runs).toHaveLength(1);
    expect(runs[0].top).toBe(96);
    expect(runs[0].openBottom).toBe(true);
    expect(runs[0].sb).toBe(160);
  });

  it('treats the space above the map as sky and below it as bedrock', () => {
    const map = new TileMap(4, 4);
    expect(columnRuns(map, 8, -64, 0)).toHaveLength(0);
    expect(columnRuns(map, 8, 64, 96)[0]).toMatchObject({ top: 64, bottom: 96 });
  });

  it('keeps every drawn surface within a pixel of the collision surface', () => {
    // A gentle ramp is a 1-px staircase every two columns in the tile data.
    const map = makeFlatMap(12, 10, 128);
    for (let x = 2; x < 10; x++) map.set(x, 7, x % 2 ? 5 : 4);
    const cols = buildColumns(map, 0, 192, 0, 160);
    for (const col of cols) for (const r of col) expect(Math.abs(r.st - r.top)).toBeLessThanOrEqual(1);
  });

  it('never smooths across a real step', () => {
    const map = makeFlatMap(10, 10, 128);
    fillRect(map, 5, 6, 9, 7, TILE_FULL); // a 2-tile step up
    const cols = buildColumns(map, 0, 160, 0, 160);
    expect(cols[79][0].st).toBe(128);
    expect(cols[80][0].st).toBe(96);
  });

  it('covers the solid area with its polygons', () => {
    const map = makeFlatMap(8, 8, 64);
    const cols = buildColumns(map, 0, 64, 0, 128);
    const polys = solidPolys(cols, 0);
    const area = polys.reduce((sum, p) => {
      let a = 0;
      for (let i = 0; i < p.length; i += 2) {
        const j = (i + 2) % p.length;
        a += p[i] * p[j + 1] - p[j] * p[i + 1];
      }
      return sum + Math.abs(a) / 2;
    }, 0);
    expect(area).toBeCloseTo(64 * 64, 0);
  });

  it('merges one-way tiles into ledges with their true ends', () => {
    const map = new TileMap(20, 10);
    for (let x = 3; x < 9; x++) map.set(x, 4, 8);
    expect(ledges(map, 100, 0, 120, 160)).toEqual([{ x: 48, y: 64, w: 96 }]);
  });

  it('puts a back wall behind a roofed gallery, never under open sky', () => {
    const map = makeFlatMap(12, 16, 64);
    clearRect(map, 3, 8, 8, 10); // a 3-row gallery under a 4-tile roof
    const walls = interiorRects(map, 0, 0, 192, 256);
    expect(walls.length).toBeGreaterThan(0);
    for (const w of walls) {
      expect(w.y).toBeGreaterThanOrEqual(8 * 16);
      expect(w.y + w.h).toBeLessThanOrEqual(11 * 16);
    }
  });
});
