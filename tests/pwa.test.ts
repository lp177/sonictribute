import { describe, it, expect } from 'vitest';
import {
  fingerprint,
  renderServiceWorker,
  selectPrecache,
  type PrecacheEntry,
} from '../src/pwa/buildSw.ts';
import {
  AppUpdate,
  type UpdateEnv,
  type UpdateRegistration,
  type UpdateStatus,
} from '../src/pwa/appUpdate.ts';

const BUILT = [
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'assets/index-CpomLnWb.js',
  'assets/index-BfJhXYWT.css',
  'social-card-v2.png',
  '.nojekyll',
  'sw.js',
];

const entries = (names: string[], content = 'x'): PrecacheEntry[] =>
  names.map((name) => ({ name, content }));

describe('Precache manifest', () => {
  it('takes the app shell and leaves the rest alone', () => {
    const got = selectPrecache(BUILT);
    expect(got).toEqual([
      'assets/index-BfJhXYWT.css',
      'assets/index-CpomLnWb.js',
      'favicon.svg',
      'index.html',
      'manifest.webmanifest',
    ]);
  });

  it('excludes the social card — 250 kB no player ever requests', () => {
    expect(selectPrecache(BUILT)).not.toContain('social-card-v2.png');
  });

  it('never precaches the worker itself (it would cache its own staleness)', () => {
    expect(selectPrecache(BUILT)).not.toContain('sw.js');
  });

  it('ignores source maps and nested non-asset files', () => {
    const got = selectPrecache(['assets/index-abc.js.map', 'assets/sub/deep.js', 'index.html']);
    expect(got).toEqual(['index.html']);
  });

  it('is order-independent, so the build stays byte-reproducible', () => {
    expect(selectPrecache(BUILT)).toEqual(selectPrecache([...BUILT].reverse()));
  });
});

describe('Version fingerprint', () => {
  it('changes when a file’s CONTENT changes even though no name did', () => {
    // index.html is not content-hashed, so a meta-tag-only edit must still
    // produce a new version or the change never reaches players.
    const a = fingerprint([{ name: 'index.html', content: '<title>A</title>' }]);
    const b = fingerprint([{ name: 'index.html', content: '<title>B</title>' }]);
    expect(a).not.toBe(b);
  });

  it('changes when a hashed bundle is renamed', () => {
    expect(fingerprint(entries(['assets/a.js']))).not.toBe(fingerprint(entries(['assets/b.js'])));
  });

  it('is stable across input order', () => {
    const a = fingerprint(entries(['index.html', 'assets/a.js']));
    const b = fingerprint(entries(['assets/a.js', 'index.html']));
    expect(a).toBe(b);
  });

  it('does not collide when content moves between files', () => {
    const a = fingerprint([
      { name: 'index.html', content: 'one' },
      { name: 'assets/a.js', content: 'two' },
    ]);
    const b = fingerprint([
      { name: 'index.html', content: 'two' },
      { name: 'assets/a.js', content: 'one' },
    ]);
    expect(a).not.toBe(b);
  });
});

describe('Service worker rendering', () => {
  const TEMPLATE = "const V = '__VERSION__';\nconst P = __PRECACHE__;\n";

  it('injects the version and the real file list', () => {
    const out = renderServiceWorker(TEMPLATE, entries(['index.html', 'assets/a.js']));
    expect(out).toMatch(/const V = '[0-9a-f]{8}';/);
    expect(out).toContain('"assets/a.js"');
    expect(out).toContain('"index.html"');
  });

  it('replaces EVERY occurrence, including ones in the template’s own prose', () => {
    // Regression: a doc comment mentioning __VERSION__ consumed the single
    // replacement and left the real constant unsubstituted.
    const withProse = `/* __VERSION__ and __PRECACHE__ are injected */\n${TEMPLATE}`;
    const out = renderServiceWorker(withProse, entries(['index.html', 'assets/a.js']));
    expect(out).not.toContain('__VERSION__');
    expect(out).not.toContain('__PRECACHE__');
  });

  it('refuses to emit a worker that would precache no shell', () => {
    expect(() => renderServiceWorker(TEMPLATE, entries(['assets/a.js']))).toThrow(/index\.html/);
  });

  it('refuses to emit a worker with no JS bundle', () => {
    expect(() => renderServiceWorker(TEMPLATE, entries(['index.html']))).toThrow(/JS bundle/);
  });

  it('handles the shipped template’s shape: prose mention then real constant', () => {
    // Mirrors src/pwa/sw.template.js, which documents both placeholders above
    // the constants that use them. The shipped file itself is validated at
    // build time — renderServiceWorker throws, failing `npm run build`.
    const shaped = [
      '/**',
      ' * The VERSION and PRECACHE constants below (__VERSION__, __PRECACHE__)',
      ' * are substituted at build time.',
      ' */',
      "const VERSION = '__VERSION__';",
      'const PRECACHE = __PRECACHE__;',
    ].join('\n');
    const out = renderServiceWorker(shaped, entries(['index.html', 'assets/a.js']));
    expect(out).not.toContain('__VERSION__');
    expect(out).not.toContain('__PRECACHE__');
    expect(out).toMatch(/const VERSION = '[0-9a-f]{8}';/);
    expect(out).toContain('"assets/a.js"');
  });
});

/** A controllable stand-in for the browser's service-worker plumbing. */
function harness(opts: { controller?: boolean; waiting?: boolean; register?: boolean } = {}) {
  const posted: unknown[] = [];
  let controllerChange = (): void => {};
  let updateFound = (): void => {};
  let stateChange = (): void => {};
  const installing = {
    state: 'installing',
    addEventListener: (_t: 'statechange', fn: () => void) => {
      stateChange = fn;
    },
  };
  const reg: UpdateRegistration = {
    installing,
    waiting: opts.waiting ? { postMessage: (m: unknown) => posted.push(m) } : null,
    addEventListener: (_t: 'updatefound', fn: () => void) => {
      updateFound = fn;
    },
    update: async () => undefined,
  };
  let controller = opts.controller ?? true;
  let reloads = 0;
  const env: UpdateEnv = {
    register: async () => (opts.register === false ? null : reg),
    hasController: () => controller,
    onControllerChange: (fn) => {
      controllerChange = fn;
    },
    reload: () => {
      reloads++;
    },
    every: () => () => {},
  };
  const seen: UpdateStatus[] = [];
  const app = new AppUpdate(env);
  app.onChange((s) => seen.push(s));
  return {
    app,
    reg,
    posted,
    seen,
    reloads: () => reloads,
    setController: (v: boolean) => (controller = v),
    /** Simulate a newer worker downloading and finishing installation. */
    installUpdate() {
      reg.waiting = { postMessage: (m: unknown) => posted.push(m) };
      updateFound();
      installing.state = 'installed';
      stateChange();
    },
    fireControllerChange: () => controllerChange(),
  };
}

describe('App update state machine', () => {
  it('reports unsupported when there is no service worker', async () => {
    const h = harness({ register: false });
    await h.app.start();
    expect(h.app.status).toBe('unsupported');
    expect(h.app.ready).toBe(false);
  });

  it('survives a registration that throws', async () => {
    const app = new AppUpdate({
      register: async () => {
        throw new Error('insecure context');
      },
      hasController: () => false,
      onControllerChange: () => {},
      reload: () => {},
      every: () => () => {},
    });
    await app.start();
    expect(app.status).toBe('unsupported');
  });

  it('is current after a first install, and offers NO update', async () => {
    // No controller yet = this is the very first visit, not a new version.
    const h = harness({ controller: false });
    await h.app.start();
    expect(h.app.status).toBe('current');
    h.installUpdate();
    expect(h.app.ready).toBe(false);
  });

  it('goes ready when a new worker installs while one is in control', async () => {
    const h = harness({ controller: true });
    await h.app.start();
    expect(h.app.status).toBe('current');
    h.installUpdate();
    expect(h.app.status).toBe('ready');
  });

  it('picks up an update left waiting by a previous visit', async () => {
    const h = harness({ controller: true, waiting: true });
    await h.app.start();
    expect(h.app.ready).toBe(true);
  });

  it('applies by asking the waiting worker to take over, then reloads', async () => {
    const h = harness({ controller: true });
    await h.app.start();
    h.installUpdate();
    h.app.apply();
    expect(h.posted).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(h.app.status).toBe('applying');
    expect(h.reloads()).toBe(0);
    h.fireControllerChange();
    expect(h.reloads()).toBe(1);
  });

  it('never reloads on a controller change the player did not ask for', async () => {
    // A controllerchange with no pending apply must not yank the page out from
    // under a run.
    const h = harness({ controller: true });
    await h.app.start();
    h.fireControllerChange();
    expect(h.reloads()).toBe(0);
  });

  it('reloads at most once even if controllerchange fires repeatedly', async () => {
    const h = harness({ controller: true });
    await h.app.start();
    h.installUpdate();
    h.app.apply();
    h.fireControllerChange();
    h.fireControllerChange();
    h.fireControllerChange();
    expect(h.reloads()).toBe(1);
  });

  it('ignores apply() when nothing is waiting', async () => {
    const h = harness({ controller: true });
    await h.app.start();
    h.app.apply();
    expect(h.posted).toEqual([]);
    expect(h.app.status).toBe('current');
  });

  it('swallows a failed update check (offline is not an error)', async () => {
    const h = harness({ controller: true });
    await h.app.start();
    h.reg.update = async () => {
      throw new Error('network down');
    };
    await expect(h.app.check()).resolves.toBeUndefined();
    expect(h.app.status).toBe('current');
  });

  it('emits each status transition exactly once', async () => {
    const h = harness({ controller: true });
    await h.app.start();
    h.installUpdate();
    h.installUpdate();
    h.app.apply();
    expect(h.seen).toEqual(['current', 'ready', 'applying']);
  });
});
