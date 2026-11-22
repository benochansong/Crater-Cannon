import type { Battle } from "./engine";
import { ground } from "./engine";
import { AIR, airPosition } from "./airSupport";
export function drawTactics(
  ctx: CanvasRenderingContext2D,
  b: Battle,
  time: number,
) {
  const reservation = b.pendingAir ?? b.air;
  const selected =
    b.airSelection && b.airTarget !== null
      ? { kind: b.airSelection, targetX: b.airTarget, owner: "player" }
      : null;
  const zone = reservation ?? selected;
  if (zone) {
    const radius = AIR[zone.kind].radius,
      x = zone.targetX,
      y = ground(b.terrain, x);
    ctx.save();
    ctx.strokeStyle = zone.owner === "player" ? "#e8b954" : "#f08460";
    ctx.fillStyle = zone.owner === "player" ? "#fff0a52b" : "#f477522c";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.fillRect(x - radius, 190, radius * 2, y - 190);
    ctx.strokeRect(x - radius, 190, radius * 2, y - 190);
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffe6a7";
    ctx.strokeStyle = "#715239";
    ctx.beginPath();
    ctx.ellipse(x, y, radius, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#bf6546";
    ctx.beginPath();
    ctx.moveTo(x - 17, y - 10);
    ctx.lineTo(x + 17, y + 10);
    ctx.moveTo(x + 17, y - 10);
    ctx.lineTo(x - 17, y + 10);
    ctx.stroke();
    ctx.fillStyle = "#5d4c38";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      AIR[zone.kind].callSign,
      Math.max(110, Math.min(1170, x)),
      185,
    );
    ctx.restore();
  }
  for (const t of b.tanks) {
    if (t.shield) {
      ctx.save();
      ctx.translate(t.x, t.y - 15);
      const glow = ctx.createRadialGradient(0, 0, 12, 0, 0, 62);
      glow.addColorStop(0, "#79dbef08");
      glow.addColorStop(0.85, "#93e7ff35");
      glow.addColorStop(1, "#92e7ff9a");
      ctx.fillStyle = glow;
      ctx.strokeStyle = "#a9eff5";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#91def063";
      ctx.lineWidth = 1;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, 7);
      ctx.clip();
      for (let y = -55; y <= 55; y += 23)
        for (let x = -55; x <= 55; x += 27) {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const xx = x + Math.cos(a) * 15,
              yy = y + Math.sin(a) * 15;
            if (i === 0) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      ctx.restore();
      ctx.fillStyle = "#d4f9ff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SHIELD · 50%", 0, -70);
      ctx.restore();
    }
    if (b.action?.owner === t.side && b.action.kind === "repair") {
      const a = b.action;
      ctx.save();
      ctx.translate(t.x - 50, t.y - 30 + Math.sin(time * 9) * 3);
      ctx.strokeStyle = "#355a4a";
      ctx.lineWidth = 3;
      ctx.fillStyle = "#cce6ab";
      ctx.beginPath();
      ctx.roundRect(-13, -12, 26, 25, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#46796c";
      ctx.fillRect(-8, -6, 16, 7);
      ctx.fillStyle = "#d9fcaf";
      ctx.fillRect(-5, -4, 3, 3);
      ctx.fillRect(3, -4, 3, 3);
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.lineTo(24, 8);
      ctx.lineTo(35, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, 14);
      ctx.lineTo(-11, 20);
      ctx.moveTo(7, 14);
      ctx.lineTo(11, 20);
      ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const phase = (time * 4 + i * 0.13) % 1;
        ctx.fillStyle = i % 2 ? "#f9eb85" : "#b1ff91";
        ctx.fillRect(
          35 + Math.cos(i * 2) * phase * 25,
          Math.sin(i * 2) * phase * 22,
          3,
          3,
        );
      }
      ctx.fillStyle = "#dbffbb";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FIELD REPAIR", 45, -43);
      ctx.fillStyle = "#50795b";
      ctx.fillRect(15, -33, 60, 5);
      ctx.fillStyle = "#c9f29b";
      ctx.fillRect(15, -33, 60 * Math.min(1, a.age / a.duration), 5);
      ctx.restore();
    }
    if (b.action?.owner === t.side && b.action.kind === "move") {
      ctx.save();
      ctx.fillStyle = "#ccb38e99";
      for (let i = 0; i < 8; i++) {
        const phase = (time * 3 + i * 0.12) % 1;
        ctx.beginPath();
        ctx.arc(
          t.x - b.action.direction * (25 + phase * 40),
          t.y + 9 - phase * 15,
          3 + phase * 7,
          0,
          7,
        );
        ctx.fill();
      }
      ctx.restore();
    }
  }
  const a = b.air;
  if (!a) return;
  const pose = airPosition(a);
  // Dropping payloads are visual only; deterministic operation ticks own every impact.
  for (const p of a.impacts)
    if (!p.done && a.age >= p.time - 0.45) {
      const f = (a.age - (p.time - 0.45)) / 0.45;
      const y = pose.y + (ground(b.terrain, p.x) - pose.y) * f * f;
      ctx.save();
      ctx.translate(p.x, y);
      ctx.fillStyle = a.kind === "bomber" ? "#3a5158" : "#ffe0a0";
      ctx.strokeStyle = "#d0d7bb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-5, -12, 10, 22, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffa445";
      ctx.fillRect(-3, -20, 6, 8);
      ctx.restore();
    }
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#24443e";
  ctx.beginPath();
  ctx.ellipse(
    pose.x,
    ground(b.terrain, Math.max(0, Math.min(1280, pose.x))),
    a.kind === "bomber" ? 125 : 75,
    12,
    0,
    0,
    7,
  );
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.scale(pose.dir, 1);
  if (a.kind === "helicopter") {
    ctx.rotate(Math.sin(a.age * 3) * 0.025);
    ctx.strokeStyle = "#284a46";
    ctx.lineWidth = 3;
    ctx.fillStyle = "#759c83";
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-112, -17);
    ctx.lineTo(-119, -39);
    ctx.lineTo(-100, -37);
    ctx.lineTo(-87, -12);
    ctx.lineTo(-25, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = a.owner === "player" ? "#468e89" : "#b66b55";
    ctx.beginPath();
    ctx.ellipse(0, 0, 52, 24, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b6e1d6";
    ctx.beginPath();
    ctx.moveTo(7, -19);
    ctx.lineTo(31, -16);
    ctx.quadraticCurveTo(50, -7, 50, 3);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-20, 20);
    ctx.lineTo(-25, 34);
    ctx.moveTo(22, 20);
    ctx.lineTo(28, 34);
    ctx.moveTo(-40, 34);
    ctx.lineTo(42, 34);
    ctx.stroke();
    ctx.strokeStyle = "#2b4d49";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-10, -22);
    ctx.lineTo(-10, -39);
    ctx.stroke();
    ctx.save();
    ctx.translate(-10, -40);
    ctx.strokeStyle = "#d4e6c1";
    ctx.lineWidth = 5;
    const length = 104 * Math.cos(time * 65);
    ctx.beginPath();
    ctx.moveTo(-length, -2);
    ctx.lineTo(length, 2);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#cde6d3";
    ctx.beginPath();
    ctx.ellipse(0, 0, 110, 7, 0, 0, 7);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(-110, -24);
    ctx.rotate(time * 75);
    ctx.strokeStyle = "#dde9bd";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#d8edbc";
    ctx.font = "bold 9px sans-serif";
    ctx.save();
    ctx.scale(pose.dir, 1);
    ctx.textAlign = "center";
    ctx.fillText("SKY HUNTER", 0, 12);
    ctx.restore();
  } else {
    ctx.strokeStyle = "#253e45";
    ctx.lineWidth = 3;
    ctx.fillStyle = a.owner === "player" ? "#567e83" : "#9a7770";
    ctx.beginPath();
    ctx.moveTo(115, 0);
    ctx.lineTo(36, -15);
    ctx.lineTo(-25, -74);
    ctx.lineTo(-62, -72);
    ctx.lineTo(-30, -13);
    ctx.lineTo(-93, -11);
    ctx.lineTo(-117, -37);
    ctx.lineTo(-131, -35);
    ctx.lineTo(-114, 0);
    ctx.lineTo(-131, 35);
    ctx.lineTo(-117, 37);
    ctx.lineTo(-93, 11);
    ctx.lineTo(-30, 13);
    ctx.lineTo(-62, 72);
    ctx.lineTo(-25, 74);
    ctx.lineTo(36, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c4e4d8";
    ctx.beginPath();
    ctx.moveTo(78, -6);
    ctx.lineTo(96, 0);
    ctx.lineTo(78, 6);
    ctx.lineTo(55, 6);
    ctx.lineTo(55, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#304c53";
    for (const y of [-31, 31]) ctx.fillRect(-50, y - 6, 40, 12);
    ctx.strokeStyle = "#e7ecd888";
    ctx.lineWidth = 5;
    for (const y of [-31, 31]) {
      ctx.beginPath();
      ctx.moveTo(-50, y);
      ctx.lineTo(-100 - Math.sin(time * 30) * 12, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#ced8c3";
    ctx.font = "bold 10px sans-serif";
    ctx.save();
    ctx.scale(pose.dir, 1);
    ctx.textAlign = "center";
    ctx.fillText("THUNDER WING", 0, 4);
    ctx.restore();
  }
  ctx.restore();
}
