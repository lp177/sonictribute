import type { Player } from './Player.ts';
import { playerBox, overlaps, type Rect } from './entities.ts';

export type BossPhase = 'intro' | 'sway' | 'telegraph' | 'dive' | 'retreat' | 'stunned' | 'defeated';

/**
 * Common contract every end-of-zone boss fulfils. The LEVEL owns the fight:
 * bosses report contacts from `interact` and never damage the player
 * themselves (single damage path — see AGENTS.md).
 */
export interface BossLike {
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  invuln: number;
  phase: string;
  /** Which procedural art/pattern this boss uses. */
  readonly kind: 'pod' | 'press' | 'shard' | 'mirage';
  /** Intro banner / health bar labels. */
  readonly title: string;
  readonly subtitle: string;
  readonly defeated: boolean;
  update(player: Player): string[];
  interact(p: Player): 'hit' | 'hurt' | null;
}

/**
 * Dr. Yolk's Wrecking Pod: hovers above the arena swinging a mace, dives at
 * the player after a telegraph. Eight hits to defeat. Fully deterministic
 * (pattern is timer-driven, no RNG) so unit tests are stable.
 */
export class Boss implements BossLike {
  readonly kind = 'pod' as const;
  readonly title = 'DR. YOLK';
  readonly subtitle = 'WRECKING POD';
  readonly maxHp = 8;
  x: number;
  y: number;
  hp = 8;
  phase: BossPhase = 'intro';
  timer = 0;
  invuln = 0;
  /** Base hover position. */
  readonly homeY: number;
  readonly minX: number;
  readonly maxX: number;
  /** Mace swing angle. */
  maceAngle = 0;
  /**
   * Animation clock for the mace. Deliberately SEPARATE from `timer`, which
   * is reset on every phase change: driving the swing off `timer` made the
   * mace teleport the instant the pod was hit, and teleport again when the
   * stun ended. A weapon that jumps position is unreadable and unfair, so its
   * arc runs on its own clock and never resets.
   */
  private animT = 0;
  private diveFromX = 0;
  private diveTargetX = 0;
  private swayDir: 1 | -1 = 1;

  /** Finale fury: second encounters must not replay the first script. */
  readonly rage: boolean;
  private divesLeft = 0;

  constructor(x: number, groundY: number, arenaLeft: number, arenaRight: number, rage = false) {
    this.rage = rage;
    this.x = x;
    this.homeY = groundY - 104;
    this.y = this.homeY - 120; // flies in from above
    this.minX = arenaLeft + 48;
    this.maxX = arenaRight - 48;
  }

  get defeated(): boolean {
    return this.phase === 'defeated';
  }

  get bodyBox(): Rect {
    return { x: this.x - 20, y: this.y - 14, w: 40, h: 28 };
  }

  get maceBox(): Rect | null {
    if (this.phase === 'intro' || this.phase === 'defeated') return null;
    const m = this.macePos();
    return { x: m.x - 9, y: m.y - 9, w: 18, h: 18 };
  }

  macePos(): { x: number; y: number } {
    const len = 34;
    return {
      x: this.x + Math.sin(this.maceAngle) * len,
      y: this.y + 16 + Math.cos(this.maceAngle) * len,
    };
  }

  update(player: Player): string[] {
    const events: string[] = [];
    this.timer++;
    this.animT++;
    if (this.invuln > 0) this.invuln--;
    // Enraged, the mace swings wider and faster — the safe gaps shrink.
    this.maceAngle = Math.sin(this.animT / (this.rage ? 22 : 30)) * (this.rage ? 1.25 : 0.9);

    switch (this.phase) {
      case 'intro':
        this.y += (this.homeY - this.y) * 0.06;
        if (Math.abs(this.y - this.homeY) < 2) {
          this.phase = 'sway';
          this.timer = 0;
        }
        break;
      case 'sway':
        // Safety net: whatever interrupted the pattern, settle back to hover
        // height rather than drifting at the wrong altitude.
        if (Math.abs(this.y - this.homeY) > 0.5) this.y += (this.homeY - this.y) * 0.12;
        this.x += 1.1 * this.swayDir;
        if (this.x > this.maxX) this.swayDir = -1;
        else if (this.x < this.minX) this.swayDir = 1;
        if (this.timer > (this.rage ? 110 : 150)) {
          this.phase = 'telegraph';
          this.timer = 0;
          // The rematch dives TWICE per telegraph: dodge one, here comes two.
          this.divesLeft = this.rage ? 2 : 1;
        }
        break;
      case 'telegraph':
        if (this.timer === 1) events.push('boss-telegraph');
        if (this.timer > 30) {
          this.phase = 'dive';
          this.timer = 0;
          this.diveFromX = this.x;
          this.diveTargetX = Math.max(this.minX, Math.min(this.maxX, player.x));
        }
        break;
      case 'dive': {
        const t = Math.min(1, this.timer / 26);
        this.x = this.diveFromX + (this.diveTargetX - this.diveFromX) * t;
        this.y = this.homeY + t * 56;
        if (t >= 1) {
          this.divesLeft--;
          if (this.divesLeft > 0) {
            // Straight back up and around for the second pass.
            this.phase = 'dive';
            this.timer = 0;
            this.diveFromX = this.x;
            this.diveTargetX = Math.max(this.minX, Math.min(this.maxX, player.x));
            this.y = this.homeY;
            events.push('boss-telegraph');
          } else {
            this.phase = 'retreat';
            this.timer = 0;
          }
        }
        break;
      }
      case 'retreat': {
        const t = Math.min(1, this.timer / 34);
        this.y = this.homeY + 56 - t * 56;
        if (t >= 1) {
          this.phase = 'sway';
          this.timer = 0;
        }
        break;
      }
      case 'stunned':
        // Reel back to the hover height. Being hit mid-dive used to strand
        // the pod at whatever height it had reached, because only 'retreat'
        // ever restored it.
        this.y += (this.homeY - this.y) * 0.12;
        if (this.timer > 50) {
          this.phase = 'sway';
          this.timer = 0;
        }
        break;
      case 'defeated':
        // Handled by the scene (explosion, then exit).
        break;
    }
    return events;
  }

  /**
   * Player interaction: stomp damages the pod, the mace/pod body hurts the
   * player. Damage is NOT applied here — the caller (Level) applies it so
   * ring scatter and damage tracking happen in exactly one place.
   */
  interact(p: Player): 'hit' | 'hurt' | null {
    if (this.phase === 'intro' || this.phase === 'defeated') return null;
    const mace = this.maceBox;
    if (mace && overlaps(playerBox(p), mace)) return 'hurt';
    if (p.attacking && this.invuln === 0 && overlaps(playerBox(p), this.bodyBox)) {
      this.hp--;
      this.invuln = 60;
      if (this.hp <= 0) {
        this.phase = 'defeated';
        this.timer = 0;
        return 'hit';
      }
      this.phase = 'stunned';
      this.timer = 0;
      p.bounce();
      return 'hit';
    }
    // Touching the pod while not attacking hurts.
    if (!p.attacking && overlaps(playerBox(p), this.bodyBox)) return 'hurt';
    return null;
  }
}
