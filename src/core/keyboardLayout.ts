/**
 * Keyboard-layout awareness for key LABELS.
 *
 * Bindings store physical key positions (KeyboardEvent.code), so the default
 * layout already sits under the same fingers on every keyboard: on AZERTY,
 * `KeyW`/`KeyA`/`KeyS`/`KeyD` ARE the keys printed Z/Q/S/D. What lies is the
 * DISPLAY — naming those codes "W/A/S/D" tells a French player the wrong
 * letters and makes a correct default look wrong. This module resolves each
 * physical code to the character the player's keyboard actually prints, via
 * the Keyboard Layout API where available (Chromium), falling back to a
 * language heuristic plus a static AZERTY map elsewhere.
 */

let layoutMap: Map<string, string> | null = null;
let azerty = false;

/**
 * The QWERTY→AZERTY differences that matter for our codes, used when the
 * Layout API is unavailable and the browser language says French.
 */
const AZERTY_FALLBACK: Record<string, string> = {
  KeyQ: 'A',
  KeyA: 'Q',
  KeyW: 'Z',
  KeyZ: 'W',
  KeyM: ',',
  Semicolon: 'M',
};

/**
 * Resolve the player's layout once at boot. Async and fire-and-forget: label
 * lookups are re-read every frame, so they simply sharpen when this lands.
 */
export async function initKeyboardLayout(nav: Navigator | undefined = globalThis.navigator): Promise<void> {
  try {
    const kb = (nav as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } })?.keyboard;
    if (kb?.getLayoutMap) {
      const m = await kb.getLayoutMap();
      layoutMap = new Map();
      for (const [code, key] of m.entries()) layoutMap.set(code, String(key));
      azerty =
        (layoutMap.get('KeyW') ?? '').toLowerCase() === 'z' &&
        (layoutMap.get('KeyA') ?? '').toLowerCase() === 'q';
      return;
    }
  } catch {
    // Layout API refused (permissions policy, etc.) — fall through.
  }
  const lang = (nav?.language ?? '').toLowerCase();
  azerty = lang.startsWith('fr');
  layoutMap = azerty ? new Map(Object.entries(AZERTY_FALLBACK)) : null;
}

export function isAzerty(): boolean {
  return azerty;
}

/**
 * The printable character the physical key produces on the player's layout,
 * uppercased — or null when unknown (named keys, unresolved layouts), in
 * which case the caller falls back to positional names.
 */
export function layoutLabel(code: string): string | null {
  const ch = layoutMap?.get(code);
  if (!ch || ch.trim().length !== 1) return null;
  return ch.toUpperCase();
}

/** Test hook: install a fake layout without touching `navigator`. */
export function setLayoutForTest(map: Record<string, string> | null, isAz = false): void {
  layoutMap = map ? new Map(Object.entries(map)) : null;
  azerty = isAz;
}
