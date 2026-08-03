/**
 * Game-juice layer: particles (dust, smoke, sparks, glows) and screen shake.
 * Pure logic apart from `render`, so it is unit-testable headless. All
 * randomness comes from an internal LCG — fully deterministic. Respects
 * reduced-motion: shake is disabled and particle counts are halved.
 */

export type ParticleKind = 'dot' | 'spark' | 'smoke' | 'glow';

export interface Particle {
  x: number;
  y: number;
  xsp: number;
  ysp: number;
  age: number;
  life: number;
  size: number;
  color: string;
  grav: number;
  kind: ParticleKind;
}

/** Screen shake per event type: [magnitude px, duration frames]. */
const SHAKES: Record<string, [number, number]> = {
  hurt: [4, 14],
  die: [5, 18],
  enemy: [1.5, 5],
  monitor: [1.5, 5],
  'loop-boost': [2, 6],
  spring: [1.5, 5],
  'dash-pad': [2, 6],
  dash: [2, 8],
  'boss-hit': [3, 10],
  'boss-slam': [5, 20],
  'boss-telegraph': [1.5, 8],
  'boss-dig': [2.5, 16],
  'boss-burst': [6, 24],
  'boss-defeated': [6, 30],
  'gate-slam': [5, 18],
  crumble: [2, 8],
  'spike-trap': [2, 8],
  'stalactite-fall': [1.5, 6],
  'stalactite-shatter': [2.5, 9],
  'cart-crash': [5, 18],
  'cart-wreck': [4, 14],
  'boss-trace': [2, 10],
  'boss-derez': [3, 12],
};

/**
 * Hit-stop: how many frames the whole world freezes on impact. A few frozen
 * frames read as WEIGHT, making a stomp feel like it connected.
 *
 * ONLY hits the player LANDS freeze the world. Freezing while the player is
 * being hurt steals reaction time exactly when they need it, and repeated
 * damage would stack freezes into an unplayable stutter — so 'hurt' and
 * 'die' get shake and a flash for feedback, never a freeze.
 *
 * Kept short: past ~12 frames a freeze stops reading as impact and starts
 * reading as lag.
 */
const HIT_STOP: Record<string, number> = {
  'boss-hit': 7,
  'boss-defeated': 12,
  'boss-slam': 5,
  'boss-burst': 6,
  enemy: 4,
  'hopper-stomp': 4,
  monitor: 3,
  crumble: 2,
  'cart-crash': 7,
};

/** Absolute ceiling, so no event or bug can ever hold the world still. */
const MAX_HIT_STOP = 12;

/** Full-screen colour flashes: [css colour, frames]. */
const FLASHES: Record<string, [string, number]> = {
  'boss-hit': ['rgba(255,255,255,0.30)', 5],
  'boss-defeated': ['rgba(255,220,150,0.55)', 14],
  hurt: ['rgba(232,56,79,0.28)', 7],
  die: ['rgba(232,56,79,0.38)', 10],
  crystal: ['rgba(75,225,255,0.22)', 8],
  'loop-boost': ['rgba(180,240,255,0.16)', 5],
};

export class FxSystem {
  particles: Particle[] = [];
  shakeMag = 0;
  shakeFrames = 0;
  /** Frames the world stays frozen for impact weight. */
  hitStop = 0;
  flashColor = '';
  flashFrames = 0;
  flashTotal = 0;
  readonly reducedMotion: boolean;
  private seed = 1234567;

  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
  }

  /* -------------------------------- Hit-stop ------------------------------- */

  /** Freeze the world for `frames` to sell an impact. Longest wins. */
  freeze(frames: number): void {
    // Reduced motion still gets a token freeze: it reads as weight, not
    // motion, and removing it entirely makes hits feel unresponsive.
    const f = this.reducedMotion ? Math.min(2, frames) : frames;
    this.hitStop = Math.min(MAX_HIT_STOP, Math.max(this.hitStop, f));
  }

  /**
   * Consumes one frame of hit-stop. Returns true while the world should stay
   * frozen — the caller skips physics AND particle updates for that frame.
   */
  tickFreeze(): boolean {
    if (this.hitStop <= 0) return false;
    this.hitStop--;
    return true;
  }

  /* --------------------------------- Flash --------------------------------- */

  flash(color: string, frames: number): void {
    if (frames >= this.flashFrames) {
      this.flashColor = color;
      this.flashFrames = frames;
      this.flashTotal = frames;
    }
  }

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  shake(mag: number, frames: number): void {
    if (this.reducedMotion) return;
    if (mag >= this.shakeMag) {
      this.shakeMag = mag;
      this.shakeFrames = frames;
    }
  }

  /** Deterministic per-frame camera offset for the current shake. */
  shakeOffset(frame: number): { x: number; y: number } {
    if (this.shakeFrames <= 0 || this.shakeMag <= 0) return { x: 0, y: 0 };
    const decay = Math.min(1, this.shakeFrames / 10);
    const m = this.shakeMag * decay;
    return {
      x: Math.round(Math.sin(frame * 2.3) * m),
      y: Math.round(Math.cos(frame * 3.1) * m * 0.7),
    };
  }

  private emit(x: number, y: number, count: number, opts: {
    colors: string[];
    speed: number;
    life: number;
    size: number;
    grav?: number;
    kind?: ParticleKind;
    up?: number;
  }): void {
    const n = this.reducedMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const sp = opts.speed * (0.4 + this.rnd() * 0.6);
      this.particles.push({
        x: x + (this.rnd() - 0.5) * 6,
        y: y + (this.rnd() - 0.5) * 6,
        xsp: Math.cos(a) * sp,
        ysp: Math.sin(a) * sp - (opts.up ?? 0),
        age: 0,
        life: Math.round(opts.life * (0.7 + this.rnd() * 0.6)),
        size: opts.size * (0.7 + this.rnd() * 0.6),
        color: opts.colors[Math.floor(this.rnd() * opts.colors.length)],
        grav: opts.grav ?? 0,
        kind: opts.kind ?? 'dot',
      });
    }
  }

  /** Map a gameplay event (player/level/boss) to juice at world (x, y). */
  onEvent(ev: string, x: number, y: number): void {
    const s = SHAKES[ev];
    if (s) this.shake(s[0], s[1]);
    const hs = HIT_STOP[ev];
    if (hs) this.freeze(hs);
    const fl = FLASHES[ev];
    if (fl) this.flash(fl[0], fl[1]);
    switch (ev) {
      case 'ring':
        this.emit(x, y, 3, { colors: ['#ffd94a', '#fff3b0'], speed: 1.2, life: 18, size: 2, kind: 'spark' });
        break;
      case 'crystal':
        this.emit(x, y, 12, { colors: ['#4be1ff', '#b7f3ff', '#fff'], speed: 2.2, life: 34, size: 3, kind: 'spark' });
        break;
      case 'secret':
        this.emit(x, y, 10, { colors: ['#4be1ff', '#ffd94a'], speed: 1.6, life: 40, size: 2, kind: 'glow' });
        break;
      case 'enemy':
      case 'hopper-stomp':
        this.emit(x, y, 10, { colors: ['#ff9d40', '#ffd94a', '#fff'], speed: 2.6, life: 24, size: 3, kind: 'spark', grav: 0.08 });
        this.emit(x, y, 5, { colors: ['#8f96a3', '#565d6e'], speed: 1.2, life: 30, size: 4, kind: 'smoke', up: 0.6 });
        break;
      case 'stalactite-shatter':
        this.emit(x, y, 9, { colors: ['#b7f3ff', '#45c3e2', '#fff'], speed: 2.2, life: 24, size: 2, kind: 'spark', grav: 0.14 });
        break;
      case 'cart-board':
        this.emit(x, y, 6, { colors: ['#ffd94a', '#cfd6e4'], speed: 1.6, life: 18, size: 2, kind: 'spark' });
        break;
      case 'cart-wreck':
      case 'cart-crash':
        this.emit(x, y, 14, { colors: ['#8a5a32', '#6e4525', '#cfd6e4', '#ffd94a'], speed: 3, life: 34, size: 3, kind: 'dot', grav: 0.16 });
        this.emit(x, y, 8, { colors: ['#9aa3b2', '#6b7280'], speed: 1.8, life: 30, size: 5, kind: 'smoke', up: 0.9 });
        break;
      case 'phase-blink':
        this.emit(x, y, 3, { colors: ['#41f0ff'], speed: 0.8, life: 14, size: 2, kind: 'glow' });
        break;
      case 'boss-trace':
        this.emit(x, y, 8, { colors: ['#ff4fa8', '#41f0ff'], speed: 2, life: 22, size: 2, kind: 'spark' });
        break;
      case 'boss-derez':
        this.emit(x, y, 14, { colors: ['#ff4fa8', '#41f0ff', '#fff'], speed: 2.6, life: 28, size: 2, kind: 'spark' });
        break;
      case 'monitor':
        this.emit(x, y, 8, { colors: ['#b6c2d9', '#e8f0ff'], speed: 2.2, life: 22, size: 2, kind: 'spark', grav: 0.12 });
        break;
      case 'hurt':
      case 'die':
        this.emit(x, y, 8, { colors: ['#e8384f', '#fff'], speed: 2.4, life: 20, size: 2, kind: 'spark' });
        break;
      case 'loop-boost':
        this.emit(x, y, 14, { colors: ['#fff', '#4be1ff', '#ffd94a'], speed: 3, life: 26, size: 3, kind: 'spark' });
        break;
      case 'rail-on':
        this.emit(x, y, 8, { colors: ['#fff', '#b7f3ff', '#ffd94a'], speed: 2, life: 20, size: 2, kind: 'spark', grav: 0.12 });
        break;
      case 'dash':
      case 'dash-pad':
        this.emit(x, y, 8, { colors: ['#cfd6e4', '#9aa3b2'], speed: 1.6, life: 26, size: 4, kind: 'smoke', up: 0.4 });
        break;
      case 'spring':
        this.emit(x, y, 5, { colors: ['#e8c832', '#fff3b0'], speed: 1.4, life: 16, size: 2, kind: 'spark' });
        break;
      case 'checkpoint':
        this.emit(x, y - 24, 8, { colors: ['#4be1ff', '#fff'], speed: 1.5, life: 30, size: 2, kind: 'glow' });
        break;
      case 'glider':
        this.emit(x, y, 8, { colors: ['#ffb03d', '#fff3b0'], speed: 1.8, life: 24, size: 2, kind: 'spark' });
        break;
      case 'board':
        this.emit(x, y, 10, { colors: ['#38e0c8', '#b7fff4'], speed: 2, life: 26, size: 3, kind: 'glow' });
        break;
      case 'board-lost':
        this.emit(x, y, 12, { colors: ['#38e0c8', '#1a9c8a', '#fff'], speed: 3, life: 28, size: 3, kind: 'spark', grav: 0.1 });
        break;
      case 'boss-hit':
        this.emit(x, y, 8, { colors: ['#fff', '#ffd94a'], speed: 2.4, life: 20, size: 3, kind: 'spark' });
        break;
      case 'boss-dig':
        this.emit(x, y, 10, { colors: ['#3a2b5e', '#6b5a9e', '#9aa3b2'], speed: 1.8, life: 30, size: 4, kind: 'smoke', up: 0.5 });
        break;
      case 'boss-burst':
        this.emit(x, y, 20, { colors: ['#4be1ff', '#b7f3ff', '#ff6bd6', '#fff'], speed: 3.6, life: 36, size: 3, kind: 'spark', grav: 0.12 });
        this.emit(x, y, 10, { colors: ['#3a2b5e', '#6b5a9e'], speed: 2, life: 34, size: 5, kind: 'smoke', up: 1 });
        break;
      case 'boss-shards':
        this.emit(x, y, 8, { colors: ['#4be1ff', '#fff'], speed: 2, life: 18, size: 2, kind: 'spark' });
        break;
      case 'boss-slam':
        this.emit(x - 24, y, 8, { colors: ['#9aa3b2', '#6b7280'], speed: 2, life: 30, size: 5, kind: 'smoke', up: 1.2 });
        this.emit(x + 24, y, 8, { colors: ['#9aa3b2', '#6b7280'], speed: 2, life: 30, size: 5, kind: 'smoke', up: 1.2 });
        break;
      case 'boss-defeated':
        this.emit(x, y, 24, { colors: ['#ff9d40', '#ffd94a', '#fff', '#e8384f'], speed: 3.4, life: 44, size: 4, kind: 'spark', grav: 0.06 });
        this.emit(x, y, 10, { colors: ['#8f96a3', '#565d6e'], speed: 1.6, life: 50, size: 6, kind: 'smoke', up: 0.8 });
        break;
      case 'goal':
        this.emit(x, y - 20, 20, { colors: ['#4be1ff', '#ffd94a', '#e8384f', '#fff'], speed: 3, life: 55, size: 3, kind: 'spark', grav: 0.05 });
        break;
      case 'gate-slam':
        this.emit(x, y, 14, { colors: ['#9aa3b2', '#6b7280', '#cfd6e4'], speed: 2.4, life: 30, size: 5, kind: 'smoke', up: 0.8 });
        this.emit(x, y, 8, { colors: ['#ffd94a', '#fff'], speed: 2.8, life: 18, size: 2, kind: 'spark', grav: 0.1 });
        break;
      case 'crumble':
        this.emit(x, y, 10, { colors: ['#8a5a32', '#6e4525', '#4a4f5c'], speed: 1.8, life: 34, size: 3, kind: 'dot', grav: 0.16 });
        break;
      case 'spike-trap':
        this.emit(x, y, 6, { colors: ['#9aa3b2', '#cfd6e4'], speed: 1.6, life: 16, size: 2, kind: 'spark' });
        break;
      default:
        break;
    }
  }

  /** Impact dust when landing, scaled by how hard the landing was. */
  emitLandingDust(x: number, y: number, impact: number): void {
    const n = Math.min(10, Math.round(impact));
    if (n <= 0) return;
    this.emit(x, y, n, {
      colors: ['#cfd6e4', '#9aa3b2'],
      speed: 1 + impact * 0.15,
      life: 20,
      size: 3,
      kind: 'smoke',
      up: 0.2,
    });
    if (impact > 7) this.shake(1.5, 5);
  }

  /* ------------------------- Continuous state emitters ----------------------- */

  /** Dust kicked up at the feet while running fast. */
  emitRunDust(x: number, y: number, gsp: number): void {
    this.emit(x, y, 1, {
      colors: ['#cfd6e4', '#9aa3b2'],
      speed: 0.6,
      life: 16,
      size: 2.5,
      kind: 'smoke',
      up: 0.3,
    });
    // Kick a puff opposite the direction of travel.
    const p = this.particles[this.particles.length - 1];
    if (p) p.xsp -= Math.sign(gsp) * 0.8;
  }

  /** Smoke plume while charging a spin dash. */
  emitSpindashSmoke(x: number, y: number, facing: number): void {
    this.emit(x - facing * 10, y, 2, {
      colors: ['#cfd6e4', '#e8f0ff'],
      speed: 0.8,
      life: 20,
      size: 3,
      kind: 'smoke',
      up: 0.5,
    });
  }

  /** Cyan mag-field wake behind the hoverboard. */
  emitBoardTrail(x: number, y: number): void {
    this.emit(x, y, 1, {
      colors: ['#38e0c8', '#7ff0e0'],
      speed: 0.4,
      life: 18,
      size: 2.5,
      kind: 'glow',
      up: -0.1,
    });
  }

  /** Golden streaks while speed shoes are active. */
  emitShoesTrail(x: number, y: number): void {
    this.emit(x, y, 1, { colors: ['#ffd94a', '#fff3b0'], speed: 0.5, life: 14, size: 2, kind: 'glow' });
  }

  update(): void {
    if (this.shakeFrames > 0) this.shakeFrames--;
    if (this.shakeFrames === 0) this.shakeMag = 0;
    if (this.flashFrames > 0) this.flashFrames--;
    for (const p of this.particles) {
      p.age++;
      p.ysp += p.grav;
      p.x += p.xsp;
      p.y += p.ysp;
      if (p.kind === 'smoke') {
        p.xsp *= 0.96;
        p.ysp *= 0.96;
        p.size *= 1.02;
      }
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  /** Draw in world space (call inside the camera translate). */
  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = p.kind === 'smoke' ? 0.35 * t : Math.min(1, t * 1.4);
      ctx.fillStyle = p.color;
      if (p.kind === 'spark') {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.kind === 'glow') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Screen-space pass drawn after the world: speed streaks that build with
   * velocity, then the impact flash on top. `speed` is |gsp| in px/frame.
   */
  renderScreen(ctx: CanvasRenderingContext2D, w: number, h: number, speed: number, frame: number): void {
    if (!this.reducedMotion && speed > 8) {
      const intensity = Math.min(1, (speed - 8) / 6);
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.10 * intensity})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        // Deterministic lane placement; the streak slides each frame so the
        // lines read as motion rather than a static overlay.
        const lane = (i * 2654435761) % 1000;
        const y = (lane / 1000) * h;
        const len = 40 + ((lane % 7) + 1) * 14 * intensity;
        const x = w - (((frame * (14 + (lane % 5) * 4)) + lane) % (w + 260));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y);
        ctx.stroke();
      }
      // Tunnel vignette tightens the frame at speed.
      const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.34, w / 2, h / 2, h * 0.78);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(0,0,0,${0.30 * intensity})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (this.flashFrames > 0 && this.flashTotal > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashFrames / this.flashTotal;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
