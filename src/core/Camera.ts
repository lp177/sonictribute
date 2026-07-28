/**
 * Classic follow camera: horizontal lookahead based on speed, vertical
 * deadzone so small jumps don't move the view, clamped to level bounds,
 * max pan speed so it always feels like it's chasing the player.
 */
export class Camera {
  x = 0;
  y = 0;
  readonly w: number;
  readonly h: number;
  /** Horizontal lookahead distance at top speed. */
  lookahead = 48;
  deadzoneH = 32;
  maxPan = 16;
  /**
   * Where the player sits vertically in the view, as a fraction of height.
   * Below centre, so the frame favours the sky and the route ahead instead
   * of the bedrock underfoot — the world is deep, but you rarely care what
   * is directly below you.
   */
  focus = 0.6;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private get anchor(): number {
    return this.h * this.focus;
  }

  snapTo(px: number, py: number, levelW: number, levelH: number): void {
    this.x = this.clampX(px - this.w / 2, levelW);
    this.y = this.clampY(py - this.anchor, levelH);
  }

  update(px: number, py: number, speed: number, facing: number, levelW: number, levelH: number): void {
    const ahead = (speed / 6) * this.lookahead * facing;
    const targetX = this.clampX(px + ahead - this.w / 2, levelW);
    const dx = targetX - this.x;
    this.x += Math.max(-this.maxPan, Math.min(this.maxPan, dx));

    const centreY = this.y + this.anchor;
    let targetY = this.y;
    if (py < centreY - this.deadzoneH) targetY = this.clampY(py + this.deadzoneH - this.anchor, levelH);
    else if (py > centreY + this.deadzoneH) targetY = this.clampY(py - this.deadzoneH - this.anchor, levelH);
    const dy = targetY - this.y;
    this.y += Math.max(-this.maxPan, Math.min(this.maxPan, dy));
  }

  private clampX(x: number, levelW: number): number {
    return Math.max(0, Math.min(Math.max(0, levelW - this.w), x));
  }

  private clampY(y: number, levelH: number): number {
    return Math.max(0, Math.min(Math.max(0, levelH - this.h), y));
  }
}
