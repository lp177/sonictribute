/**
 * Player options that are not key bindings: audio mix, comfort and display.
 * Pure state plus a guarded localStorage layer (same pattern as bindings.ts
 * and progress.ts), so it is unit-testable headless.
 *
 * Every option has a sensible default that respects the OS: screen shake and
 * flashes start off when `prefers-reduced-motion` is set, touch controls
 * appear only on a touch-first device. The player can override any of it.
 */
import { prefersReducedMotion } from './prefs.ts';

export type TouchMode = 'auto' | 'on' | 'off';

export interface GameSettings {
  /** 0..1, in steps of 0.1. */
  musicVolume: number;
  /** 0..1, in steps of 0.1. */
  sfxVolume: number;
  /** Camera shake on impacts. */
  screenShake: boolean;
  /** Full-screen impact flashes (photosensitivity). */
  flashes: boolean;
  /** On-screen touch controls. */
  touch: TouchMode;
  /** Speedrun timer with hundredths, or plain minutes:seconds. */
  preciseTimer: boolean;
  /** Vintage CRT glaze over the picture (scanlines, grille, vignette). */
  crt: boolean;
}

const STORAGE_KEY = 'bolt.settings.v1';

export function defaultSettings(reducedMotion = prefersReducedMotion()): GameSettings {
  return {
    musicVolume: 0.7,
    sfxVolume: 0.8,
    screenShake: !reducedMotion,
    flashes: !reducedMotion,
    touch: 'auto',
    preciseTimer: true,
    crt: true,
  };
}

const clamp01 = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(1, v)) * 10) / 10 : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

/** Validates untrusted (stored) data field by field; junk falls back to defaults. */
export function sanitizeSettings(raw: unknown, base = defaultSettings()): GameSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    musicVolume: clamp01(o.musicVolume, base.musicVolume),
    sfxVolume: clamp01(o.sfxVolume, base.sfxVolume),
    screenShake: bool(o.screenShake, base.screenShake),
    flashes: bool(o.flashes, base.flashes),
    touch: o.touch === 'on' || o.touch === 'off' || o.touch === 'auto' ? o.touch : base.touch,
    preciseTimer: bool(o.preciseTimer, base.preciseTimer),
    crt: bool(o.crt, base.crt),
  };
}

type Listener = (s: Readonly<GameSettings>) => void;

let current: GameSettings | null = null;
const listeners = new Set<Listener>();

function load(): GameSettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) return sanitizeSettings(JSON.parse(raw));
  } catch {
    // Corrupt or blocked storage: defaults.
  }
  return defaultSettings();
}

/** The live settings (loaded lazily on first read). */
export function settings(): Readonly<GameSettings> {
  if (!current) current = load();
  return current;
}

/** Applies a patch, persists it and notifies listeners (audio mixer, FX…). */
export function updateSettings(patch: Partial<GameSettings>): Readonly<GameSettings> {
  current = sanitizeSettings({ ...settings(), ...patch }, settings());
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private mode: the change still applies for this session.
  }
  for (const fn of listeners) fn(current);
  return current;
}

/** Subscribe to changes; returns the unsubscribe function. */
export function onSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test hook: forget the cached state so the next read reloads. */
export function resetSettingsForTest(next?: GameSettings): void {
  current = next ?? null;
  listeners.clear();
}
