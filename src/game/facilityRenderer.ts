import type { Battle } from "./engine";
export function drawFacility(
  c: CanvasRenderingContext2D,
  b: Battle,
  time: number,
) {
  const f = b.facility;
  if (!f) return;
  const ratio = f.hp / f.maxHp,
    alive = f.hp > 0,
    base = f.y - 8 + f.height / 2;
  c.save();
  c.translate(f.x, base);
  c.fillStyle = "#263b3688";
  c.beginPath();
  c.ellipse(0, 1, 57, 9, 0, 0, 7);
  c.fill();
  c.fillStyle = alive ? "#687c72" : "#424c48";
  c.strokeStyle = "#233e3a";
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(-44, -42, 88, 42, 5);
  c.fill();
  c.stroke();
  c.fillStyle = ratio < 0.4 ? "#4b5751" : "#bbc3a0";
  c.fillRect(-35, -34, 70, 9);
  c.fillStyle = "#243f3f";
  c.fillRect(-9, -24, 18, 24);
  for (const x of [-28, 20]) {
    c.fillStyle = alive ? "#b7f0cc" : "#394443";
    c.fillRect(x, -19, 10, 9);
  }
  c.strokeStyle = alive ? "#d4d8b6" : "#505c56";
  c.lineWidth = 5;
  if (alive) {
    c.beginPath();
    c.moveTo(-15, -42);
    c.lineTo(0, -88);
    c.lineTo(15, -42);
    c.stroke();
    if (f.kind === "comms") {
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-26, -75);
      c.lineTo(26, -75);
      c.moveTo(-20, -87);
      c.lineTo(20, -87);
      c.stroke();
      c.fillStyle = ratio < 0.4 ? "#f2ac68" : "#b7f6c7";
      c.beginPath();
      c.arc(0, -97, 4 + Math.sin(time * 4), 0, 7);
      c.fill();
    } else {
      const spin = Math.cos(time * 1.5);
      c.save();
      c.translate(0, -84);
      c.scale(0.3 + Math.abs(spin) * 0.7, 1);
      c.fillStyle = ratio < 0.4 ? "#86978a" : "#bad7c0";
      c.beginPath();
      c.ellipse(0, 0, 38, 17, -0.12, 0, Math.PI);
      c.fill();
      c.stroke();
      c.lineWidth = 2;
      for (const x of [-24, -12, 0, 12, 24]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(0, 17);
        c.stroke();
      }
      c.restore();
    }
  } else {
    for (let i = 0; i < 9; i++) {
      c.fillStyle = i % 2 ? "#7a8174" : "#3c4f46";
      c.fillRect(-49 + i * 11, -7 - (i % 3) * 6, 12, 8);
    }
    c.save();
    c.translate(0, -15);
    c.rotate(0.7);
    c.fillStyle = "#6b7a70";
    c.fillRect(-33, -5, 66, 9);
    c.restore();
  }
  if (ratio < 0.7) {
    c.strokeStyle = "#343b34";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-28, -38);
    c.lineTo(-20, -22);
    c.lineTo(-30, -10);
    c.moveTo(30, -35);
    c.lineTo(19, -15);
    c.stroke();
    for (let i = 0; i < (ratio < 0.4 ? 7 : 3); i++) {
      const a = (time * 0.5 + i / 7) % 1;
      c.globalAlpha = (1 - a) * (alive ? 0.4 : 0.65);
      c.fillStyle = ratio < 0.4 ? "#3c4743" : "#82918a";
      c.beginPath();
      c.arc(
        -28 + i * 9 + Math.sin(time + i) * 6,
        -33 - a * 70,
        5 + a * 17,
        0,
        7,
      );
      c.fill();
    }
    c.globalAlpha = 1;
  }
  if (f.hurt > 0) {
    c.globalAlpha = f.hurt * 0.3;
    c.fillStyle = "#ffe3a4";
    c.fillRect(-45, -42, 90, 42);
    c.globalAlpha = 1;
  }
  if (b.selectedTarget === "objective" && b.phase === "aim") {
    c.strokeStyle = f.owner === "player" ? "#a6f1cd" : "#ffd08a";
    c.setLineDash([6, 5]);
    c.lineWidth = 2;
    c.strokeRect(-54, -106, 108, 111);
    c.setLineDash([]);
  }
  c.fillStyle = "#193d35dd";
  c.beginPath();
  c.roundRect(-74, -144, 148, 29, 6);
  c.fill();
  c.fillStyle = "#f6f1cf";
  c.textAlign = "center";
  c.font = "bold 12px sans-serif";
  c.fillText(f.name + (alive ? "" : " · 파괴"), 0, -125);
  c.fillStyle = "#314e45";
  c.fillRect(-48, -111, 96, 5);
  c.fillStyle = ratio < 0.4 ? "#f08f65" : "#b6dda1";
  c.fillRect(-48, -111, 96 * Math.max(0, ratio), 5);
  c.restore();
}
