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
  'boss-hit': [2, 8],
  'boss-slam': [5, 20],
  'boss-defeated': [6, 30],
};

export class FxSystem {
  particles: Particle[] = [];
  shakeMag = 0;
  shakeFrames = 0;
  readonly reducedMotion: boolean;
  private seed = 1234567;

  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
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
        this.emit(x, y, 10, { colors: ['#ff9d40', '#ffd94a', '#fff'], speed: 2.6, life: 24, size: 3, kind: 'spark', grav: 0.08 });
        this.emit(x, y, 5, { colors: ['#8f96a3', '#565d6e'], speed: 1.2, life: 30, size: 4, kind: 'smoke', up: 0.6 });
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
      case 'board':
        this.emit(x, y, 10, { colors: ['#38e0c8', '#b7fff4'], speed: 2, life: 26, size: 3, kind: 'glow' });
        break;
      case 'board-lost':
        this.emit(x, y, 12, { colors: ['#38e0c8', '#1a9c8a', '#fff'], speed: 3, life: 28, size: 3, kind: 'spark', grav: 0.1 });
        break;
      case 'boss-hit':
        this.emit(x, y, 8, { colors: ['#fff', '#ffd94a'], speed: 2.4, life: 20, size: 3, kind: 'spark' });
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
      default:
        break;
    }
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
}
