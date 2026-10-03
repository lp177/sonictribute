/**
 * Classic follow camera: horizontal lookahead based on speed, vertical
 * deadzone so small jumps don't move the view, clamped to level bounds,
 * max pan speed so it always feels like it's chasing the player.
 */
export class Camera {
  x = 0;
  y = 0;
  /** View size in world px. Not fixed: a boss fight pulls the camera back. */
  w: number;
  h: number;
  /** Horizontal lookahead distance at running top speed (6 px/frame). */
  lookahead = 56;
  /**
   * The lead keeps growing with speed up to this multiple of `lookahead`.
   * At full lead the hero rides a fifth of the way in from the trailing edge
   * of a 427-px view: three quarters of the frame is road ahead, and he is
   * never pressed against the side of it.
   */
  leadMax = 2.2;
  /**
   * How fast the lead may change, px/frame. The lead used to be a direct
   * function of speed and facing, so a skid, a wall or a turn snapped the
   * target a hundred pixels and the view lurched after it at full pan speed;
   * eased, a change of pace becomes a glide.
   */
  leadEase = 3;
  /** Current eased lead, px (positive = looking right). */
  lead = 0;
  deadzoneH = 32;
  maxPan = 24;
  /**
   * Where the player sits vertically in the view, as a fraction of height.
   * Below centre, so the frame favours the sky and the route ahead instead
   * of the bedrock underfoot — the world is deep, but you rarely care what
   * is directly below you.
   */
  focus = 0.6;
  /**
   * ...until you are dropping through it. Falling fast, the hero slides up
   * the frame so the landing comes into view before the feet reach it; sprung
   * upward, he slides down it to show what is overhead. Without this a long
   * drop is a blind one: at terminal velocity the old framing gave seven
   * frames of warning.
   */
  focusFalling = 0.34;
  focusRising = 0.72;
  /** Vertical speed (px/frame) past which the framing shifts. */
  fallLead = 7;
  riseLead = 8;
  /** How fast the framing shifts, as a fraction of view height per frame. */
  focusEase = 0.012;
  /**
   * The same lead on a slope: running downhill the hero rides higher in the
   * frame, uphill lower, by this much of the view height per px/frame of
   * vertical speed. The view is 240 world px tall; without it a descent
   * leaves the frame a hundred pixels ahead of the feet and the hill is run
   * blind. Only on the ground — a jump must not rock the camera.
   */
  slopeLead = 0.045;
  /**
   * On the ground the view tracks the hero closely (the classic rule): the
   * wide dead zone is for jumps. Left on for running, he sank to its lower
   * edge on every descent — the one place the room below him matters.
   */
  deadzoneGround = 6;
  /** How fast the view settles onto a grounded hero, px/frame over his own speed. */
  settle = 4;
  private focusNow = this.focus;
  /**
   * How far the view may scroll ABOVE the map top. Without it the camera
   * pins to y=0 on the sky route and the hero rides the top third of the
   * frame while the lower paths hog the screen — the view must stay anchored
   * on the hero, not on whatever happens to fill the clamped frame. The
   * overscrolled strip renders as sky, which is exactly what is up there.
   */
  overscrollTop = 48;
  /**
   * Look up / look down (classic "hold up or down while standing still").
   * `lookOff` eases toward `lookDist * dir` so the pan reads as a deliberate
   * glance rather than a snap, and `viewY` is what the renderer must use — it
   * is the follow position plus the glance, re-clamped to the level so looking
   * down at the floor never reveals the void under the map.
   */
  lookDist = 104;
  lookSpeed = 4;
  lookOff = 0;
  viewY = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private get anchor(): number {
    return this.h * this.focusNow;
  }

  /**
   * Changes the view size about the point the framing hangs on, so a zoom
   * opens around the hero instead of sliding away from the top-left corner.
   */
  resize(w: number, h: number): void {
    this.x -= (w - this.w) / 2;
    this.y -= (h - this.h) * this.focusNow;
    this.w = w;
    this.h = h;
  }

  snapTo(px: number, py: number, levelW: number, levelH: number): void {
    this.lead = 0;
    this.focusNow = this.focus;
    this.x = this.clampX(px - this.w / 2, levelW);
    this.y = this.clampY(py - this.anchor, levelH);
    this.lookOff = 0;
    this.viewY = this.y;
  }

  /**
   * `vx` / `vy` are the hero's actual velocity this frame, in px/frame.
   * `onGround`: he is running (or riding) a surface, not in the air.
   */
  update(
    px: number,
    py: number,
    vx: number,
    vy: number,
    levelW: number,
    levelH: number,
    look: -1 | 0 | 1 = 0,
    onGround = false,
  ): void {
    const wantLead = Math.max(-this.leadMax, Math.min(this.leadMax, vx / 6)) * this.lookahead;
    this.lead += Math.max(-this.leadEase, Math.min(this.leadEase, wantLead - this.lead));
    const targetX = this.clampX(px + this.lead - this.w / 2, levelW);
    const dx = targetX - this.x;
    this.x += Math.max(-this.maxPan, Math.min(this.maxPan, dx));

    // In the air below the fall/rise thresholds the framing HOLDS: easing
    // back to neutral for the length of a hop, and out again on landing, is
    // a camera that bobs with every jump on a hill.
    const wantFocus =
      vy > this.fallLead
        ? this.focusFalling
        : vy < -this.riseLead
          ? this.focusRising
          : onGround
            ? Math.max(this.focusFalling, Math.min(this.focusRising, this.focus - vy * this.slopeLead))
            : this.focusNow;
    this.focusNow += Math.max(-this.focusEase, Math.min(this.focusEase, wantFocus - this.focusNow));

    const zone = onGround ? this.deadzoneGround : this.deadzoneH;
    const centreY = this.y + this.anchor;
    let targetY = this.y;
    if (py < centreY - zone) targetY = this.clampY(py + zone - this.anchor, levelH);
    else if (py > centreY + zone) targetY = this.clampY(py - zone - this.anchor, levelH);
    const dy = targetY - this.y;
    const pan = onGround ? Math.min(this.maxPan, Math.abs(vy) + this.settle) : this.maxPan;
    this.y += Math.max(-pan, Math.min(pan, dy));

    const lookTarget = look * this.lookDist;
    const d = lookTarget - this.lookOff;
    this.lookOff += Math.max(-this.lookSpeed, Math.min(this.lookSpeed, d));
    this.viewY = this.clampY(this.y + this.lookOff, levelH);
  }

  private clampX(x: number, levelW: number): number {
    return Math.max(0, Math.min(Math.max(0, levelW - this.w), x));
  }

  private clampY(y: number, levelH: number): number {
    return Math.max(-this.overscrollTop, Math.min(Math.max(0, levelH - this.h), y));
  }
}
