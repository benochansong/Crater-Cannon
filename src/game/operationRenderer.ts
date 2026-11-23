import type { Battle, Tank } from "./engine";
import { CONVOY_ROUTE } from "./operations";
export function drawOperationField(
  c: CanvasRenderingContext2D,
  b: Battle,
  time: number,
) {
  if (b.convoy) {
    c.save();
    c.strokeStyle = "#dbc9a0";
    c.lineWidth = 5;
    c.beginPath();
    for (let x = 80; x <= 860; x += 4) {
      const y = b.originalTerrain[Math.round(x)] - 2;
      x === 80 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
    c.strokeStyle = "#8b8c75";
    c.lineWidth = 6;
    for (let x = 100; x <= 850; x += 35) {
      const top = b.originalTerrain[x],
        bottom = b.terrain[x];
      if (bottom - top > 6) {
        c.beginPath();
        c.moveTo(x, top);
        c.lineTo(x, bottom);
        c.stroke();
      }
    }
    c.setLineDash([15, 12]);
    c.beginPath();
    for (let x = 80; x <= 860; x += 4) {
      const y = b.originalTerrain[x] - 2;
      x === 80 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.strokeStyle = "#fff5c3";
    c.lineWidth = 2;
    c.stroke();
    c.setLineDash([]);
    for (let i = 1; i < CONVOY_ROUTE.length; i++) {
      const x = CONVOY_ROUTE[i],
        y = b.originalTerrain[x];
      c.strokeStyle = "#e8dfbc";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y - 42);
      c.stroke();
      c.fillStyle =
        i <= b.convoy.checkpoint ? "#a9dc9f" : i === 5 ? "#f7ce5f" : "#638d86";
      c.fillRect(x, y - 42, 26, 17);
      c.fillStyle = "#263e3e";
      c.font = "bold 12px sans-serif";
      c.fillText(i === 5 ? "HQ" : String(i), x + 4, y - 29);
    }
    c.font = "bold 14px sans-serif";
    c.fillStyle = "#e5e5c6";
    c.fillText("NORTH PASS / 호송 전용 차선", 490, 590);
    c.restore();
  } else if (b.boss) {
    c.save();
    c.fillStyle = "#253943";
    c.fillRect(860, 220, 360, 240);
    for (let x = 880; x < 1200; x += 60) {
      c.fillStyle = "#556366";
      c.fillRect(x, 235, 37, 80);
      c.fillStyle = b.boss.phase === 3 ? "#e98155" : "#d8b064";
      c.fillRect(x + 9, 258, 18, 5 + Math.sin(time * 4) * 2);
    }
    c.fillStyle = "#839185";
    c.font = "bold 21px sans-serif";
    c.fillText("IRON CITADEL", 927, 210);
    c.fillStyle = "#1c2f39";
    c.fillRect(968, 330, 170, 130);
    c.strokeStyle = "#75827a";
    c.lineWidth = 5;
    c.strokeRect(968, 330, 170, 130);
    c.restore();
  }
}
export function drawConvoy(
  c: CanvasRenderingContext2D,
  b: Battle,
  time: number,
) {
  const f = b.facility!,
    v = b.convoy!;
  const base = f.y - 8 + f.height / 2;
  c.save();
  c.translate(f.x, base);
  const bob = v.moving ? Math.sin(v.travel * 0.35) * 1.5 : 0;
  c.translate(0, bob);
  if (f.hp <= 0) c.filter = "grayscale(1) brightness(.5)";
  c.fillStyle = "#263d3c";
  c.beginPath();
  c.roundRect(-47, -16, 94, 12, 4);
  c.fill();
  for (const x of [-31, 27]) {
    c.save();
    c.translate(x, -5);
    c.rotate(v.travel / 10);
    c.fillStyle = "#243638";
    c.beginPath();
    c.arc(0, 0, 11, 0, 7);
    c.fill();
    c.strokeStyle = "#b4b798";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, 7, 0, 7);
    c.moveTo(-7, 0);
    c.lineTo(7, 0);
    c.moveTo(0, -7);
    c.lineTo(0, 7);
    c.stroke();
    c.restore();
  }
  c.fillStyle = f.hp < 32 ? "#6e7260" : "#76977b";
  c.strokeStyle = "#304b42";
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(-44, -45, 57, 29, 3);
  c.fill();
  c.stroke();
  c.fillStyle = "#a6b68b";
  c.fillRect(-42, -43, 53, 5);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = "#bca572";
    c.fillRect(-39 + i * 16, -57, 14, 17);
    c.strokeStyle = "#665b43";
    c.strokeRect(-39 + i * 16, -57, 14, 17);
    c.beginPath();
    c.moveTo(-32 + i * 16, -56);
    c.lineTo(-32 + i * 16, -41);
    c.stroke();
  }
  c.fillStyle = "#8daa85";
  c.beginPath();
  c.moveTo(14, -46);
  c.lineTo(34, -46);
  c.lineTo(45, -29);
  c.lineTo(45, -16);
  c.lineTo(14, -16);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#bde0cf";
  c.beginPath();
  c.moveTo(20, -41);
  c.lineTo(32, -41);
  c.lineTo(39, -29);
  c.lineTo(20, -29);
  c.fill();
  c.fillStyle = "#fff2a4";
  c.fillRect(40, -24, 7, 5);
  if (f.hp < 56) {
    c.fillStyle = "#303c3b99";
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(
        -15 + Math.sin(time + i) * 8,
        -62 - ((time * 15 + i * 17) % 48),
        5 + i * 2,
        0,
        7,
      );
      c.fill();
    }
  }
  if (v.moving) {
    c.fillStyle = "#c8b48c66";
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.arc(
        -50 - i * 8,
        -5 - Math.abs(Math.sin(time * 6 + i)) * 10,
        5 + i,
        0,
        7,
      );
      c.fill();
    }
  }
  if (v.shield) {
    c.strokeStyle = "#89e4e3";
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, -26, 60, 43, 0, 0, 7);
    c.stroke();
  }
  if (f.hurt > 0) {
    c.fillStyle = `rgba(255,221,151,${f.hurt * 0.35})`;
    c.fillRect(-45, -47, 90, 36);
  }
  c.filter = "none";
  c.fillStyle = "#183e36";
  c.fillRect(-58, -92, 116, 25);
  c.fillStyle = "#e7efc9";
  c.font = "bold 12px sans-serif";
  c.textAlign = "center";
  c.fillText("SUPPLY · " + f.hp + "/80", 0, -75);
  c.fillStyle = "#3e5f4d";
  c.fillRect(-50, -64, 100, 5);
  c.fillStyle = f.hp < 25 ? "#e8865e" : "#9bd2ad";
  c.fillRect(-50, -64, (100 * f.hp) / 80, 5);
  c.restore();
}
export function drawBoss(
  c: CanvasRenderingContext2D,
  t: Tank,
  b: Battle,
  time: number,
) {
  const boss = b.boss!;
  c.save();
  c.translate(t.x, t.y);
  if (t.hp <= 0) c.filter = "grayscale(1) brightness(.45)";
  c.save();
  c.rotate(t.tilt);
  c.fillStyle = "#202d35";
  c.strokeStyle = "#142731";
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(-58, -3, 116, 26, 11);
  c.fill();
  c.stroke();
  for (let x = -46; x <= 46; x += 18) {
    c.save();
    c.translate(x, 10);
    c.rotate(t.mobility.travel / 9);
    c.fillStyle = "#899083";
    c.beginPath();
    c.arc(0, 0, 8, 0, 7);
    c.fill();
    c.strokeStyle = "#354842";
    c.beginPath();
    c.moveTo(-7, 0);
    c.lineTo(7, 0);
    c.moveTo(0, -7);
    c.lineTo(0, 7);
    c.stroke();
    c.restore();
  }
  c.fillStyle = "#706d67";
  c.beginPath();
  c.moveTo(-58, -2);
  c.lineTo(-45, -28);
  c.lineTo(43, -28);
  c.lineTo(58, -2);
  c.closePath();
  c.fill();
  c.stroke();
  for (let i = 0; i < 5; i++) {
    c.fillStyle = boss.phase === 1 ? "#a7a58c" : "#5b605b";
    c.beginPath();
    c.moveTo(-50 + i * 20, -22);
    c.lineTo(-34 + i * 20, -22);
    c.lineTo(-30 + i * 20, -7);
    c.lineTo(-51 + i * 20, -7);
    c.closePath();
    c.fill();
    c.stroke();
  }
  if (boss.phase > 1) {
    c.strokeStyle = "#e3ad68";
    c.lineWidth = 2;
    for (const x of [-35, 10, 35]) {
      c.beginPath();
      c.moveTo(x, -25);
      c.lineTo(x - 8, -14);
      c.lineTo(x + 3, -2);
      c.stroke();
    }
  }
  c.restore();
  c.save();
  c.translate(0, -15);
  c.rotate(((180 + t.angle) * Math.PI) / 180);
  c.translate(-t.recoil * 7, 0);
  c.fillStyle = "#999684";
  c.fillRect(0, -6, 43, 12);
  c.fillStyle = "#3a4547";
  c.fillRect(34, -9, 12, 18);
  c.restore();
  c.fillStyle = "#777d73";
  c.strokeStyle = "#293b3d";
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(-28, -45, 56, 29, 6);
  c.fill();
  c.stroke();
  c.fillStyle = "#b7b195";
  c.fillRect(-19, -49, 38, 5);
  c.fillStyle = boss.phase === 3 ? "#f1a056" : "#b4d9c4";
  c.fillRect(-23, -38, 12, 7);
  // Distinct paired electronic launch pods and reactive armor blocks.
  for (const x of [-43, 33]) {
    c.fillStyle = "#3a4b4c";
    c.fillRect(x, -43, 12, 26);
    c.strokeStyle = "#c1ad7a";
    c.strokeRect(x, -43, 12, 26);
    for (let y = -38; y < -19; y += 7) {
      c.fillStyle = "#d7bf7e";
      c.fillRect(x + 3, y, 6, 3);
    }
  }
  if (boss.phase > 1 || t.hp <= 0) {
    c.fillStyle = "#323c4299";
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.arc(
        25 + Math.sin(time * 2 + i) * 10,
        -50 - ((time * 19 + i * 13) % 55),
        7 + i,
        0,
        7,
      );
      c.fill();
    }
  }
  if (t.hurt > 0) {
    c.fillStyle = `rgba(255,220,150,${t.hurt * 0.4})`;
    c.fillRect(-55, -27, 110, 25);
  }
  c.filter = "none";
  c.font = "bold 13px sans-serif";
  c.textAlign = "center";
  c.fillStyle = "#f2d29a";
  c.fillText("ARMORED COMMANDER · P" + boss.phase, 0, -85);
  c.restore();
}
