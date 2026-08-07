/**
 * A module-level handle to the running `AppUpdate`, so menus can ask "is there
 * an update waiting?" without threading a service-worker object through every
 * scene constructor. Same shape as `keyboardLayout`'s singleton: set once from
 * `main.ts`, read from anywhere, and inert (never "ready") under tests.
 */
import type { AppUpdate } from './appUpdate.ts';

let current: AppUpdate | null = null;

export function setAppUpdate(updater: AppUpdate | null): void {
  current = updater;
}

export function appUpdate(): AppUpdate | null {
  return current;
}

/** True only when a newer build is downloaded and waiting to be accepted. */
export function updateReady(): boolean {
  return current?.ready ?? false;
}

/** True while the handover is in flight, so the menu can say so. */
export function updateApplying(): boolean {
  return current?.status === 'applying';
}
