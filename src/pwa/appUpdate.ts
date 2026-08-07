/**
 * Service worker registration and the update handshake behind it.
 *
 * The game is served from cache for speed and offline play, so "is there a new
 * version?" stops being something the browser answers on refresh and becomes
 * something the app must ask. This module owns that question: it registers the
 * worker, polls for a newer build, and exposes a tiny state machine the menus
 * render.
 *
 * Every browser object is injected, so the whole thing is unit-testable in
 * Node with no DOM — the same pattern as prefs/bindings/progress.
 */

export type UpdateStatus =
  /** No service worker support, or registration failed. Nothing to show. */
  | 'unsupported'
  /** Registered and current, as far as we know. */
  | 'current'
  /** A newer build is downloaded and waiting for the player to accept. */
  | 'ready'
  /** The player accepted; we are handing over and reloading. */
  | 'applying';

/** The slice of `ServiceWorkerRegistration` this module actually uses. */
export interface UpdateRegistration {
  installing: { state: string; addEventListener(t: 'statechange', fn: () => void): void } | null;
  waiting: { postMessage(msg: unknown): void } | null;
  addEventListener(type: 'updatefound', fn: () => void): void;
  update(): Promise<unknown>;
}

export interface UpdateEnv {
  register(): Promise<UpdateRegistration | null>;
  /** True when a worker is already in control (so an install IS an update). */
  hasController(): boolean;
  onControllerChange(fn: () => void): void;
  reload(): void;
  /** Schedules the periodic re-check; returns a cancel function. */
  every(ms: number, fn: () => void): () => void;
}

/** How often to ask the network whether a newer build exists. */
export const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export class AppUpdate {
  private state: UpdateStatus = 'unsupported';
  private listeners: ((s: UpdateStatus) => void)[] = [];
  private reg: UpdateRegistration | null = null;
  private env: UpdateEnv;
  private stopTimer: (() => void) | null = null;
  /** Guards the reload so a controllerchange storm cannot loop the page. */
  private reloading = false;

  constructor(env: UpdateEnv) {
    this.env = env;
  }

  get status(): UpdateStatus {
    return this.state;
  }

  /** True when the menus should offer the update row. */
  get ready(): boolean {
    return this.state === 'ready';
  }

  onChange(fn: (s: UpdateStatus) => void): void {
    this.listeners.push(fn);
  }

  private set(s: UpdateStatus): void {
    if (this.state === s) return;
    this.state = s;
    for (const fn of this.listeners) fn(s);
  }

  async start(): Promise<void> {
    let reg: UpdateRegistration | null = null;
    try {
      reg = await this.env.register();
    } catch {
      reg = null;
    }
    if (!reg) {
      this.set('unsupported');
      return;
    }
    this.reg = reg;
    this.set('current');

    // A worker already waiting means a previous visit downloaded an update
    // that was never applied.
    if (reg.waiting && this.env.hasController()) this.set('ready');

    reg.addEventListener('updatefound', () => {
      const installing = this.reg?.installing;
      if (!installing) return;
      const check = (): void => {
        // 'installed' with a controller already present = a NEW version is
        // waiting. Without a controller it is simply the first install.
        if (installing.state === 'installed' && this.env.hasController()) this.set('ready');
      };
      installing.addEventListener('statechange', check);
      check();
    });

    this.env.onControllerChange(() => {
      // The worker we asked to take over is now in control — reload so the
      // page is running the new build end to end.
      if (this.reloading) return;
      if (this.state !== 'applying') return;
      this.reloading = true;
      this.env.reload();
    });

    this.stopTimer = this.env.every(CHECK_INTERVAL_MS, () => void this.check());
  }

  /** Ask the network for a newer worker. Safe to call at any time. */
  async check(): Promise<void> {
    if (!this.reg) return;
    try {
      await this.reg.update();
    } catch {
      // Offline, or the check failed. Staying on the current build is correct.
    }
  }

  /** Take the waiting update: hand over, then reload on controllerchange. */
  apply(): void {
    const waiting = this.reg?.waiting;
    if (!waiting || this.state !== 'ready') return;
    this.set('applying');
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  stop(): void {
    this.stopTimer?.();
    this.stopTimer = null;
  }
}

/**
 * The real browser wiring. Kept out of `AppUpdate` so the state machine above
 * never touches a global.
 */
export function browserEnv(swUrl: string): UpdateEnv {
  const sw = globalThis.navigator?.serviceWorker;
  return {
    register: async () => {
      if (!sw) return null;
      // `updateViaCache: 'none'` keeps the HTTP cache from serving a stale
      // worker script — which would defeat the update check entirely.
      return (await sw.register(swUrl, { updateViaCache: 'none' })) as unknown as UpdateRegistration;
    },
    hasController: () => Boolean(sw?.controller),
    onControllerChange: (fn) => sw?.addEventListener('controllerchange', fn),
    reload: () => globalThis.location.reload(),
    every: (ms, fn) => {
      const id = globalThis.setInterval(fn, ms);
      // Coming back to the tab is the moment a check is most worth doing.
      const onVisible = (): void => {
        if (globalThis.document?.visibilityState === 'visible') fn();
      };
      globalThis.document?.addEventListener('visibilitychange', onVisible);
      return () => {
        globalThis.clearInterval(id);
        globalThis.document?.removeEventListener('visibilitychange', onVisible);
      };
    },
  };
}
