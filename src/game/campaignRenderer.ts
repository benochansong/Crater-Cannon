import { drawTracks } from "./mobilityRenderer";
import type { Battle, Tank } from "./engine";
export function drawCampaignBackground(c: CanvasRenderingContext2D, b: Battle) {
  if (b.config.field === "valley") return;
  const modern = b.config.era === "modern",
    fort = b.config.field === "fortress",
    france = b.config.field === "france";
  const g = c.createLinearGradient(0, 0, 0, 640);
  g.addColorStop(0, modern ? "#233950" : fort ? "#69747d" : "#93aaa4");
  g.addColorStop(1, modern ? "#a1b9af" : "#e3cda5");
  c.fillStyle = g;
  c.fillRect(0, 0, 1280, 640);
  c.fillStyle = modern ? "#c9e9ce88" : "#ffe4b0aa";
  c.beginPath();
  c.arc(990, 175, 48, 0, 7);
  c.fill();
  for (let layer = 0; layer < 3; layer++) {
    c.fillStyle = ["#68847c", "#5b746b", "#496158"][layer];
    c.beginPath();
    c.moveTo(0, 640);
    for (let x = 0; x <= 1280; x += 20)
      c.lineTo(
        x,
        295 + layer * 45 + Math.sin(x / (150 - layer * 25) + layer) * 30,
      );
    c.lineTo(1280, 640);
    c.fill();
  }
  if (b.config.field === "signal" || b.config.field === "radar") {
    c.fillStyle = b.config.field === "radar" ? "#4b5b65" : "#3e6663";
    for (let i = 0; i < 9; i++) {
      const x = i * 160;
      c.beginPath();
      c.moveTo(x - 100, 410);
      c.lineTo(x + 30, 170 + (i % 3) * 30);
      c.lineTo(x + 190, 410);
      c.fill();
    }
    c.strokeStyle = "#79928a";
    c.lineWidth = 4;
    for (let x = 30; x < 1280; x += 85) {
      c.beginPath();
      c.moveTo(x, 375);
      c.lineTo(x + 45, 355);
      c.lineTo(x + 65, 382);
      c.stroke();
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = i * 103 - 20,
      y = 285 + Math.sin(i * 2.3) * 24;
    c.fillStyle = modern ? "#354d55" : "#697365";
    c.fillRect(x, y, modern ? 65 : 45, 110);
    c.beginPath();
    c.moveTo(x - 5, y);
    c.lineTo(x + 22, y - (modern ? 8 : 24));
    c.lineTo(x + 50, y);
    c.fill();
    c.fillStyle = modern ? "#9ac4bf" : "#304d45";
    for (let j = 0; j < 3; j++) c.fillRect(x + 10 + j * 16, y + 16, 6, 12);
    if (!modern) {
      c.fillStyle = "#3b5548";
      c.beginPath();
      c.ellipse(x + 62, y + 30, 16, 36, 0, 0, 7);
      c.fill();
    }
  }
  if (france) {
    c.fillStyle = "#384c46";
    c.fillRect(420, 320, 400, 18);
    for (let x = 430; x < 820; x += 65) {
      c.fillRect(x, 333, 16, 90);
      c.beginPath();
      c.moveTo(x, 320);
      c.lineTo(x + 40, 265);
      c.lineTo(x + 55, 320);
      c.fill();
    }
    c.fillStyle = "#9dafa4";
    c.fillRect(550, 305, 45, 35);
  }
  if (modern) {
    c.strokeStyle = "#b7c8bb";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(825, 370);
    c.lineTo(840, 190);
    c.lineTo(855, 370);
    c.moveTo(800, 230);
    c.lineTo(880, 230);
    c.stroke();
    c.strokeStyle = "#74c6c5";
    for (let r = 16; r < 45; r += 13) {
      c.beginPath();
      c.arc(840, 200, r, 3.5, 5.9);
      c.stroke();
    }
  }
  if (fort) {
    c.fillStyle = "#394944";
    c.beginPath();
    c.moveTo(880, 380);
    c.lineTo(920, 295);
    c.lineTo(1200, 295);
    c.lineTo(1250, 380);
    c.fill();
    c.fillStyle = "#1c302e";
    c.fillRect(960, 325, 210, 24);
    c.strokeStyle = "#aab4a0";
    c.lineWidth = 2;
    for (let x = 880; x < 1260; x += 38) {
      c.beginPath();
      c.moveTo(x, 375);
      c.lineTo(x + 17, 345);
      c.moveTo(x, 345);
      c.lineTo(x + 17, 375);
      c.stroke();
    }
  }
}
export function drawEraTank(
  c: CanvasRenderingContext2D,
  t: Tank,
  b: Battle,
  time: number,
) {
  const modern = b.config.era === "modern",
    blue = t.side === "player",
    heavy = !blue && b.config.field !== "normandy",
    base = blue
      ? modern
        ? "#729e93"
        : "#8c9869"
      : modern
        ? "#9a8580"
        : "#8d8b77",
    light = blue ? "#d6d8a9" : "#c6bda1";
  c.save();
  c.translate(t.x, t.y);
  if (t.hp <= 0) c.filter = "grayscale(1) brightness(.5)";
  c.save();
  c.rotate(t.tilt);
  c.fillStyle = "#1e3631";
  c.strokeStyle = "#1c302e";
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(-34, 0, 68, 21, 8);
  c.fill();
  for (let x = -25; x <= 25; x += 12) {
    c.fillStyle = "#819078";
    c.beginPath();
    c.arc(x, 10, 7, 0, 7);
    c.fill();
    c.fillStyle = "#344a3f";
    c.beginPath();
    c.arc(x, 10, 3, 0, 7);
    c.fill();
  }
  drawTracks(c, t, b.config.era, [-25, -13, -1, 11, 23]);
  c.fillStyle = base;
  c.beginPath();
  c.moveTo(-35, 2);
  c.lineTo(-27, -17);
  c.lineTo(25, -17);
  c.lineTo(35, 2);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = light;
  c.fillRect(-24, -15, 47, 3);
  if (modern) {
    c.fillStyle = "#425d55";
    for (let x = -25; x < 25; x += 13) c.fillRect(x, -9, 10, 7);
  } else {
    c.fillStyle = "#e3dec1";
    c.font = "bold 12px sans-serif";
    c.textAlign = "center";
    c.fillText(blue ? "★" : "27", -19, -3);
  }
  c.restore();
  c.save();
  c.translate(0, -15);
  c.rotate(((blue ? -t.angle : 180 + t.angle) * Math.PI) / 180);
  c.translate(-t.recoil * 7, 0);
  c.fillStyle = base;
  c.fillRect(0, -4, 43, 8);
  c.fillStyle = light;
  c.fillRect(5, -4, 32, 2);
  c.fillStyle = "#314a40";
  c.fillRect(38, -6, 7, 12);
  c.restore();
  c.fillStyle = base;
  c.strokeStyle = "#354b3e";
  c.beginPath();
  if (heavy || modern) c.roundRect(-20, -31, 40, 22, 4);
  else c.ellipse(0, -20, 20, 14, 0, 0, 7);
  c.fill();
  c.stroke();
  c.fillStyle = light;
  c.fillRect(-10, -34, 20, 4);
  if (modern) {
    c.fillStyle = "#8fe3d7";
    c.fillRect(8, -27, 10, 6);
    c.strokeStyle = "#b0c9b4";
    c.beginPath();
    c.moveTo(-16, -28);
    c.lineTo(-20, -51);
    c.stroke();
  }
  if (t.smoke) {
    c.fillStyle = "#c2c7b5aa";
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.arc(
        -45 + i * 15 + Math.sin(time + i) * 6,
        -30 - Math.sin(i) * 15,
        22,
        0,
        7,
      );
      c.fill();
    }
  }
  if (t.cover) {
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? "#aaa279" : "#c3b58a";
        c.strokeStyle = "#786d50";
        c.beginPath();
        c.roundRect(-46 + i * 19 + row * 5, 3 - row * 12, 20, 12, 5);
        c.fill();
        c.stroke();
      }
  }
  if (!blue && b.fortified) {
    c.strokeStyle = "#b1ac8c";
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(-50, 16);
    c.lineTo(-50, -46);
    c.lineTo(50, -46);
    c.lineTo(50, 16);
    c.stroke();
    c.fillStyle = "#f1db9c";
    c.font = "bold 11px sans-serif";
    c.textAlign = "center";
    c.fillText("FORTIFIED · HP ≥ 40", 0, -57);
  }
  c.restore();
}
