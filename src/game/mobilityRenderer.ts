import type { Battle, Tank } from "./engine";
import { ground } from "./engine";
/** Signed odometer drives both wheels and track links, including reverse. */
export function drawTracks(
  c: CanvasRenderingContext2D,
  t: Tank,
  era: "ww2" | "modern" = "modern",
  wheels: number[] = [-22, -7.3, 7.4, 22.1],
  visualFacing = 1,
) {
  const phase = (t.mobility.travel * visualFacing) / 7;
  c.strokeStyle = "#d6d5b4";
  c.lineWidth = 1.5;
  for (const x of wheels) {
    c.beginPath();
    c.moveTo(x, 10);
    c.lineTo(x + Math.cos(phase) * 5, 10 + Math.sin(phase) * 5);
    c.stroke();
  }
  const offset = (((t.mobility.travel * visualFacing) % 9) + 9) % 9;
  c.strokeStyle = "#8e9d89";
  c.lineWidth = 2;
  for (let x = -29 + offset; x < 31; x += 9) {
    c.beginPath();
    c.moveTo(x, 18);
    c.lineTo(x - 2, 21);
    c.stroke();
  }
  // Suspension moves only the hull; world-space gun direction and muzzle stay exact.
  c.translate(
    0,
    Math.sin(phase * 1.5) *
      Math.min(1, t.mobility.speed / 30) *
      (era === "ww2" ? 1.7 : 0.8),
  );
}
export function drawMobility(c: CanvasRenderingContext2D, b: Battle) {
  if (b.phase === "aim" && b.canAdjust()) {
    const range = b.adjustmentRange();
    c.save();
    c.strokeStyle = "#e4f5b9";
    c.lineWidth = 3;
    c.setLineDash([5, 5]);
    c.beginPath();
    for (let x = range.left; x <= range.right; x += 2) {
      const y = ground(b.terrain, x) - 3;
      if (x === range.left) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    c.setLineDash([]);
    for (const x of [range.left, range.right]) {
      c.beginPath();
      c.moveTo(x, ground(b.terrain, x) - 14);
      c.lineTo(x, ground(b.terrain, x));
      c.stroke();
    }
    c.restore();
  }
  for (const t of b.tanks) {
    if (t.mobility.dust <= 0) continue;
    c.save();
    const rubble = b.config.field === "france" || b.config.field === "fortress";
    c.fillStyle = rubble
      ? "#b9b6a3"
      : b.config.field === "normandy"
        ? "#d4c195"
        : "#bba37f";
    const amplitude = b.config.era === "ww2" ? 1.2 : 1;
    for (let i = 0; i < 8; i++) {
      const phase =
        (((Math.abs(t.mobility.travel) / 45 + i / 8) % 1) +
          (0.45 - t.mobility.dust)) %
        1;
      c.globalAlpha = (1 - phase) * t.mobility.dust * 0.7;
      c.beginPath();
      const side = t.mobility.input || (t.mobility.travel < 0 ? -1 : 1);
      c.ellipse(
        t.x - side * (26 + phase * 35),
        t.y + 16 - phase * 16,
        (3 + phase * 11) * amplitude,
        (2 + phase * 6) * amplitude,
        0,
        0,
        7,
      );
      c.fill();
    }
    c.restore();
  }
}
