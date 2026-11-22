import { drawCampaignBackground, drawEraTank } from "./campaignRenderer";
import { drawTactics } from "./tacticalRenderer";
import { Camera } from "./camera";
import {
  Battle,
  WIDTH,
  HEIGHT,
  WEAPONS,
  launch,
  STEP,
  advance,
  advanceMissile,
} from "./engine";
import type { Drone, GameEvent, Tank, WeaponId } from "./engine";
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  smoke: boolean;
}
interface Burst {
  x: number;
  y: number;
  age: number;
  weapon: WeaponId;
  direct: boolean;
}
interface Label {
  blockSide?: string;
  blocked?: number;
  x: number;
  y: number;
  age: number;
  text: string;
  direct: boolean;
  color: string;
}
export class Renderer {
  particles: Particle[] = [];
  bursts: Burst[] = [];
  labels: Label[] = [];
  camera = new Camera();
  pulses: { x: number; y: number; age: number }[] = [];
  flashes: { x: number; y: number; angle: number; age: number }[] = [];
  private hitStop = 0;
  time = 0;
  shake = 0;
  private terrainLayer: HTMLCanvasElement;
  private cachedRevision = -1;
  private cachedSeed = -1;
  constructor() {
    this.terrainLayer = document.createElement("canvas");
    this.terrainLayer.width = WIDTH;
    this.terrainLayer.height = HEIGHT;
  }
  simulationDelta(dt: number) {
    const held = Math.min(dt, this.hitStop);
    this.hitStop -= held;
    return dt - held;
  }
  event(e: GameEvent) {
    if (
      ["repair", "shield", "block", "shield-end", "air-call"].includes(e.type)
    ) {
      const previous =
        e.type === "block"
          ? this.labels.find((l) => l.blockSide === e.side && l.age < 1.5)
          : undefined;
      if (previous) {
        previous.blocked = (previous.blocked ?? 0) + (e.amount ?? 0);
        previous.text = "SHIELD BLOCK · " + previous.blocked + " 흡수";
        previous.age = 0;
        previous.y = e.y - 20;
      }
      if (!previous)
        this.labels.push({
          blockSide: e.type === "block" ? e.side : undefined,
          blocked: e.type === "block" ? e.amount : undefined,
          x: e.x,
          y: e.y - 15,
          age: 0,
          text:
            e.type === "repair"
              ? "+" + e.amount + " HP"
              : e.type === "block"
                ? "SHIELD BLOCK · " + e.amount + " 흡수"
                : e.type === "shield"
                  ? "SHIELD ON"
                  : e.type === "shield-end"
                    ? "방어막 종료"
                    : "AIR SUPPORT",
          direct: false,
          color: e.type === "repair" ? "#c6ffad" : "#c6f4ff",
        });
      if (e.type === "block" || e.type === "shield-end")
        this.pulses.push({ x: e.x, y: e.y + 35, age: 0 });
      if (e.type === "repair")
        for (let i = 0; i < 25; i++)
          this.particle(
            e.x,
            e.y,
            (Math.random() - 0.5) * 80,
            -Math.random() * 80,
            "#bbf192",
            3,
            1.5,
            false,
          );
    }
    if (e.type === "emp") {
      this.pulses.push({ x: e.x, y: e.y, age: 0 });
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        this.particle(
          e.x,
          e.y,
          Math.cos(a) * 240,
          Math.sin(a) * 240,
          "#a0f5ff",
          3,
          0.7,
          false,
        );
      }
    }
    if (e.type === "disabled") {
      this.labels.push({
        x: e.x,
        y: e.y - 30,
        age: 0,
        text:
          e.weapon === "drone"
            ? "전자전 성공 · DRONE OFF"
            : "전자전 성공 · 추적 해제",
        direct: false,
        color: "#b6f4f4",
      });
      for (let i = 0; i < 15; i++)
        this.particle(
          e.x,
          e.y,
          (Math.random() - 0.5) * 90,
          -Math.random() * 100,
          "#88cbd1",
          3,
          0.7,
          false,
        );
    }
    if (e.type === "shot") {
      this.flashes.push({
        x: e.x,
        y: e.y,
        angle:
          ((e.side === "player" ? -(e.angle ?? 45) : 180 + (e.angle ?? 45)) *
            Math.PI) /
          180,
        age: 0,
      });
      this.shake = Math.max(this.shake, 3);
      for (let i = 0; i < 20; i++)
        this.particle(
          e.x,
          e.y,
          (Math.random() - 0.5) * 110,
          (Math.random() - 0.7) * 100,
          i < 8 ? "#fff4ad" : "#e7e9cf",
          3 + Math.random() * 7,
          0.25 + Math.random() * 0.35,
          i > 7,
        );
    }
    if (e.type === "explosion") {
      const w = e.weapon!;
      this.bursts.push({
        x: e.x,
        y: e.y,
        age: 0,
        weapon: w,
        direct: !!e.direct,
      });
      this.shake = e.direct ? 12 : w === "crater" ? 9 : 6;
      this.hitStop = e.direct ? 0.055 : 0.022;
      const count = w === "crater" ? 88 : w === "shock" ? 48 : 70;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2,
          speed = 35 + Math.random() * (w === "shock" ? 320 : 230);
        const smoke = i > count * 0.62;
        const color =
          w === "crater"
            ? smoke
              ? "#b59872"
              : i % 2
                ? "#876144"
                : "#e1bf81"
            : w === "shock"
              ? smoke
                ? "#badbd9"
                : "#b5f6ff"
              : smoke
                ? "#747a6a"
                : i % 3
                  ? "#ffaf32"
                  : "#fff1a5";
        this.particle(
          e.x,
          e.y,
          Math.cos(a) * speed,
          Math.sin(a) * speed - 90,
          color,
          2 + Math.random() * (smoke ? 12 : w === "crater" ? 8 : 5),
          (smoke ? 1.2 : 0.3) + Math.random() * 1.2,
          smoke,
        );
      }
    }
    if (e.type === "end" && e.outcome === "victory") {
      for (let i = 0; i < 85; i++)
        this.particle(
          WIDTH * 0.5,
          80,
          (Math.random() - 0.5) * 800,
          -100 - Math.random() * 180,
          ["#f6cf52", "#69c9c3", "#fff1ba"][i % 3],
          3 + Math.random() * 3,
          2 + Math.random(),
          false,
        );
    }
    if (e.type === "damage")
      this.labels.push({
        x: e.x,
        y: e.y,
        age: 0,
        text: `−${e.amount}`,
        direct: !!e.direct,
        color: e.side === "ai" ? "#fff8b5" : "#ffddce",
      });
  }
  private particle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    size: number,
    life: number,
    smoke: boolean,
  ) {
    if (this.particles.length >= 240) this.particles.shift();
    this.particles.push({ x, y, vx, vy, color, size, life, max: life, smoke });
  }
  draw(
    ctx: CanvasRenderingContext2D,
    game: Battle,
    dt: number,
    options: { shake: boolean; menu: boolean },
  ) {
    this.time += dt;
    const scaleX = ctx.canvas.width / WIDTH,
      scaleY = ctx.canvas.height / HEIGHT;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    this.sky(ctx);
    drawCampaignBackground(ctx, game);
    ctx.save();
    this.shake *= Math.exp(-8 * dt);
    if (options.shake && this.shake > 0.1)
      ctx.translate(
        Math.sin(this.time * 110) * this.shake,
        Math.cos(this.time * 93) * this.shake * 0.6,
      );
    this.camera.update(game.projectile ?? game.drone, dt, options.menu);
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.scale, this.camera.scale);
    this.terrain(ctx, game);
    if (
      game.phase === "aim" &&
      !options.menu &&
      game.weapon !== "drone" &&
      !game.airSelection
    )
      this.guide(ctx, game);
    if (game.drone) this.drawDrone(ctx, game.drone);
    if (!options.menu && game.weapon === "missile" && game.phase === "aim") {
      const t = game.ai;
      ctx.strokeStyle = game.target ? "#ee7246" : "#fff1ba";
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 5]);
      ctx.beginPath();
      ctx.arc(t.x, t.y - 8, 43, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#24433d";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        game.target ? "TARGET LOCK" : "클릭하여 목표 지정",
        t.x,
        t.y - 62,
      );
    }
    for (const t of game.tanks)
      if (game.config.field !== "valley") drawEraTank(ctx, t, game, this.time);
      else
        this.tank(
          ctx,
          t,
          game.result?.outcome === (t.side === "player" ? "victory" : "defeat"),
        );
    if (game.projectile) {
      const p = game.projectile;
      for (let i = 0; i < p.trail.length; i += 2) {
        const t = p.trail[i];
        ctx.globalAlpha = (i / p.trail.length) * 0.5;
        ctx.fillStyle = WEAPONS[p.weapon].color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 2 + (i / p.trail.length) * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 5;
      ctx.strokeStyle = WEAPONS[p.weapon].color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowColor = WEAPONS[p.weapon].color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#fff8d3";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (p.weapon === "missile") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = p.guided ? "#ffad43" : "#8b9e9a";
        ctx.beginPath();
        ctx.moveTo(-15, -5);
        ctx.lineTo(-34 - Math.sin(this.time * 80) * 7, 0);
        ctx.lineTo(-15, 5);
        ctx.fill();
        ctx.fillStyle = "#f3f3d8";
        ctx.strokeStyle = "#35504a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(19, 0);
        ctx.lineTo(5, -6);
        ctx.lineTo(-16, -6);
        ctx.lineTo(-16, 6);
        ctx.lineTo(5, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = p.guided ? "#ed7a50" : "#7a9a9a";
        ctx.fillRect(1, -6, 5, 12);
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-18, -14);
        ctx.lineTo(-18, 14);
        ctx.lineTo(-8, 5);
        ctx.fill();
        ctx.restore();
      }
      if (this.camera.toScreen(p).y < 15) {
        ctx.fillStyle = "#173d45";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `▲ 포탄 · ${Math.round(-p.y)}m`,
          Math.max(90, Math.min(WIDTH - 90, p.x)),
          35,
        );
      }
    }
    if (!options.menu) drawTactics(ctx, game, this.time);
    this.effects(ctx, dt);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  private drawDrone(ctx: CanvasRenderingContext2D, d: Drone) {
    for (let i = 0; i < d.trail.length; i += 4) {
      const t = d.trail[i];
      ctx.globalAlpha = (i / d.trail.length) * 0.3;
      ctx.fillStyle = "#a2e8ba";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(Math.max(-0.28, Math.min(0.28, d.vx / 800)));
    ctx.strokeStyle = "#28483f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-28, -7);
    ctx.lineTo(28, 7);
    ctx.moveTo(-28, 7);
    ctx.lineTo(28, -7);
    ctx.stroke();
    for (const x of [-27, 27]) {
      ctx.fillStyle = "#e0f2c7";
      ctx.beginPath();
      ctx.ellipse(x, -7, 14, 3 + Math.sin(this.time * 100) * 1.5, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#335e4e";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = d.owner === "player" ? "#51a69a" : "#c46b5f";
    ctx.strokeStyle = "#28483f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-15, -13, 30, 23, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d9ffb8";
    ctx.fillRect(-7, -10, 14, 4);
    ctx.fillStyle = "#193d3d";
    ctx.beginPath();
    ctx.arc(0, 9, 7, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#fff1a2";
    ctx.beginPath();
    ctx.arc(0, 9, 3, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  private sky(ctx: CanvasRenderingContext2D) {
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, "#79c4cb");
    grad.addColorStop(0.7, "#d8e7c8");
    grad.addColorStop(1, "#e8e9b9");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#fff3b5";
    ctx.beginPath();
    ctx.arc(1000, 98, 53, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7cc55";
    ctx.beginPath();
    ctx.arc(1000, 98, 77, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const x = ((i * 237 + this.time * (4 + (i % 3))) % 1570) - 140,
        y = 62 + (i % 3) * 44;
      ctx.fillStyle = "#f4f5dd";
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.ellipse(x, y, 64, 14, 0, 0, 7);
      ctx.moveTo(x + 64, y - 11);
      ctx.ellipse(x + 26, y - 11, 38, 20, 0, 0, 7);
      ctx.moveTo(x + 16, y - 15);
      ctx.ellipse(x - 14, y - 15, 30, 23, 0, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.mountain(ctx, "#93bcb2", [
      [-70, 345],
      [130, 151],
      [267, 296],
      [415, 126],
      [610, 340],
      [820, 184],
      [1020, 328],
      [1190, 143],
      [1390, 352],
    ]);
    this.mountain(ctx, "#6c9e91", [
      [-60, 380],
      [150, 268],
      [290, 370],
      [475, 244],
      [690, 403],
      [960, 238],
      [1160, 349],
      [1370, 243],
    ]);
    ctx.fillStyle = "#d8e5ce88";
    ctx.beginPath();
    ctx.moveTo(350, 198);
    ctx.lineTo(415, 126);
    ctx.lineTo(485, 205);
    ctx.lineTo(438, 183);
    ctx.lineTo(409, 200);
    ctx.lineTo(398, 176);
    ctx.closePath();
    ctx.fill();
    this.mountain(ctx, "#477f73", [
      [-80, 420],
      [120, 347],
      [330, 417],
      [530, 346],
      [750, 452],
      [940, 365],
      [1110, 424],
      [1370, 335],
    ]);
    for (let i = 0; i < 33; i++) {
      const x = i * 43 + 17,
        y = 382 + Math.sin(i * 0.7) * 30;
      ctx.fillStyle = "#3c7569";
      ctx.beginPath();
      ctx.moveTo(x, y - 23 - (i % 5) * 4);
      ctx.lineTo(x - 12, y + 10);
      ctx.lineTo(x + 12, y + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#cee1ba55";
    ctx.fillRect(0, 408, WIDTH, 232);
  }
  private mountain(
    ctx: CanvasRenderingContext2D,
    color: string,
    points: number[][],
  ) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
  private terrain(ctx: CanvasRenderingContext2D, game: Battle) {
    if (
      game.terrainRevision !== this.cachedRevision ||
      game.seed !== this.cachedSeed
    ) {
      this.cachedRevision = game.terrainRevision;
      this.cachedSeed = game.seed;
      const c = this.terrainLayer.getContext("2d")!;
      c.clearRect(0, 0, WIDTH, HEIGHT);
      c.beginPath();
      c.moveTo(0, HEIGHT);
      for (let x = 0; x <= WIDTH; x += 2) c.lineTo(x, game.terrain[x]);
      c.lineTo(WIDTH, HEIGHT);
      c.closePath();
      const soil = c.createLinearGradient(0, 400, 0, HEIGHT);
      soil.addColorStop(0, "#987346");
      soil.addColorStop(0.5, "#795c3c");
      soil.addColorStop(1, "#493e31");
      c.fillStyle = soil;
      c.fill();
      c.save();
      c.clip();
      c.strokeStyle = "#b28c5266";
      c.lineWidth = 16;
      for (let y = 470; y < HEIGHT; y += 57) {
        c.beginPath();
        c.moveTo(0, y);
        for (let x = 0; x <= WIDTH; x += 15)
          c.lineTo(x, y + Math.sin(x / 110) * 16);
        c.stroke();
      }
      for (let i = 0; i < 450; i++) {
        const x = (i * 157.31) % WIDTH,
          y = 400 + ((i * 83.73) % 240);
        c.fillStyle = i % 3 ? "#d2ac6966" : "#352c2a55";
        c.beginPath();
        c.ellipse(x, y, 1 + (i % 4), 1 + (i % 2), i, 0, 7);
        c.fill();
      }
      c.restore();
      c.lineJoin = "round";
      c.lineCap = "round";
      for (const exposed of [false, true]) {
        const layers: [number, string, number][] = exposed
          ? [
              [12, "#513f30", 4],
              [6, "#bd8f58", 0],
              [2, "#e0b77a", -2],
            ]
          : [
              [15, "#365b37", 4],
              [10, "#6c9340", 0],
              [4, "#b8cf65", -4],
            ];
        for (const [width, color, offset] of layers) {
          c.lineWidth = width;
          c.strokeStyle = color;
          c.beginPath();
          let active = false;
          for (let x = 0; x <= WIDTH; x += 2) {
            if (game.terrain[x] > game.originalTerrain[x] + 3 !== exposed) {
              active = false;
              continue;
            }
            if (!active)
              c.moveTo(
                Math.max(0, x - 2),
                game.terrain[Math.max(0, x - 2)] + offset,
              );
            c.lineTo(x, game.terrain[x] + offset);
            active = true;
          }
          c.stroke();
        }
      }
      for (let x = 10; x < WIDTH; x += 17) {
        if (game.terrain[x] > game.originalTerrain[x] + 3) continue;
        const y = game.terrain[x];
        c.strokeStyle = x % 3 ? "#c2d476" : "#719342";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - 3, y);
        c.lineTo(x - 5, y - 7);
        c.moveTo(x, y);
        c.lineTo(x + 2, y - 10);
        c.stroke();
        if (x % 7 === 0) {
          c.fillStyle = "#f7dd85";
          c.beginPath();
          c.arc(x + 2, y - 10, 2, 0, 7);
          c.fill();
        }
      }
    }
    // Continue the ground beyond world bounds when the camera reveals the margins.
    const edgeSoil = ctx.createLinearGradient(0, 400, 0, HEIGHT);
    edgeSoil.addColorStop(0, "#987346");
    edgeSoil.addColorStop(0.5, "#795c3c");
    edgeSoil.addColorStop(1, "#493e31");
    ctx.fillStyle = edgeSoil;
    ctx.fillRect(-WIDTH * 2, game.terrain[0], WIDTH * 2, HEIGHT + 500);
    ctx.fillRect(WIDTH, game.terrain[WIDTH], WIDTH * 2, HEIGHT + 500);
    ctx.strokeStyle = "#87a64d";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-WIDTH * 2, game.terrain[0]);
    ctx.lineTo(0, game.terrain[0]);
    ctx.moveTo(WIDTH, game.terrain[WIDTH]);
    ctx.lineTo(WIDTH * 3, game.terrain[WIDTH]);
    ctx.stroke();
    ctx.drawImage(this.terrainLayer, 0, 0);
  }
  private tank(ctx: CanvasRenderingContext2D, t: Tank, winner = false) {
    const blue = t.side === "player",
      base = blue ? "#2b91b6" : "#cf624c",
      light = blue ? "#75d0dc" : "#ef9b6f",
      dark = blue ? "#1c526e" : "#803e37";
    ctx.save();
    ctx.translate(
      t.x,
      t.y - (winner ? Math.abs(Math.sin(this.time * 5)) * 5 : 0),
    );
    if (t.hp <= 0) ctx.filter = "grayscale(0.85) brightness(0.62)";
    ctx.fillStyle = "#263b2d44";
    ctx.beginPath();
    ctx.ellipse(0, 20, 38, 8, 0, 0, 7);
    ctx.fill();
    ctx.translate(
      t.hurt > 0 ? Math.sin(this.time * 80) * t.hurt * 3 : 0,
      -Math.sin(t.recoil * Math.PI) * 2,
    );
    ctx.save();
    ctx.rotate(t.tilt);
    ctx.fillStyle = "#243c3c";
    ctx.strokeStyle = "#152e36";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-33, 1, 66, 20, 10);
    ctx.fill();
    ctx.stroke();
    for (let i = -22; i <= 22; i += 14.7) {
      ctx.fillStyle = "#9eae94";
      ctx.beginPath();
      ctx.arc(i, 11, 6, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#43594f";
      ctx.beginPath();
      ctx.arc(i, 11, 3, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(-34, -9, 68, 17, 5);
    ctx.fill();
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(-31, -5);
    ctx.lineTo(-23, -20);
    ctx.lineTo(22, -20);
    ctx.lineTo(33, -5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = light;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-23, -18);
    ctx.lineTo(22, -18);
    ctx.stroke();
    ctx.fillStyle = "#fff3c4";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(blue ? "01" : "02", -16, -6);
    ctx.fillStyle = "#1f3843";
    ctx.fillRect(12, -15, 10, 7);
    ctx.fillStyle = "#fff6bf";
    ctx.fillRect(26, -7, 5, 4);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -15);
    ctx.rotate(((blue ? -t.angle : 180 + t.angle) * Math.PI) / 180);
    ctx.translate(-t.recoil * 9, 0);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(0, -6, 45, 12, 3);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.fillRect(10, -5, 29, 3);
    ctx.fillStyle = "#243841";
    ctx.fillRect(40, -7, 7, 14);
    ctx.restore();
    ctx.fillStyle = base;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -16, 17, 12, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.roundRect(-9, -28, 18, 5, 2);
    ctx.fill();
    ctx.strokeStyle = "#293d41";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -15);
    ctx.lineTo(-23, -41);
    ctx.stroke();
    ctx.fillStyle = "#ffe5a0";
    ctx.beginPath();
    ctx.arc(-23, -42, 2, 0, 7);
    ctx.fill();
    if (t.hp < 35) {
      ctx.fillStyle = "#56615b66";
      for (let i = 0; i < 3; i++) {
        const a = (this.time * 0.8 + i / 3) % 1;
        ctx.beginPath();
        ctx.arc(13 + Math.sin(a * 4) * 8, -25 - a * 45, 3 + a * 10, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  private guide(ctx: CanvasRenderingContext2D, game: Battle) {
    const p = launch(game.player, game.weapon);
    if (p.weapon === "missile") {
      p.guided = true;
      p.target = "ai";
    }
    ctx.fillStyle = "#fffadd";
    for (let i = 0; i < 75; i++) {
      if (
        p.weapon === "missile"
          ? advanceMissile(p, game.terrain, game.tanks, game.wind, STEP)
          : advance(p, game.terrain, game.tanks, game.wind, STEP)
      )
        break;
      if (i % 10 === 0) {
        ctx.globalAlpha = 0.9 - i / 100;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, 7);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  private effects(ctx: CanvasRenderingContext2D, dt: number) {
    for (const pulse of this.pulses) {
      pulse.age += dt;
      const t = pulse.age / 0.85;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = "#81efff";
      ctx.lineWidth = 6 * (1 - t);
      ctx.fillStyle = "#9af5ff22";
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 25 + t * 280, 0, 7);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 15 + t * 220, 0, 7);
      ctx.stroke();
    }
    this.pulses = this.pulses.filter((p) => p.age < 0.85);
    ctx.globalAlpha = 1;
    for (const flash of this.flashes) {
      flash.age += dt;
      const k = Math.max(0, 1 - flash.age / 0.15);
      ctx.save();
      ctx.translate(flash.x, flash.y);
      ctx.rotate(flash.angle);
      ctx.globalAlpha = k;
      ctx.fillStyle = "#ffb633";
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(20 * k, -17 * k);
      ctx.lineTo(13 * k, -6);
      ctx.lineTo(64 * k, 0);
      ctx.lineTo(13 * k, 7);
      ctx.lineTo(20 * k, 17 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fffad2";
      ctx.beginPath();
      ctx.ellipse(12 * k, 0, 23 * k, 7 * k, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    this.flashes = this.flashes.filter((f) => f.age < 0.15);
    for (const b of this.bursts) {
      b.age += dt;
      const progress = b.age / 0.85,
        radius = WEAPONS[b.weapon].radius,
        expand = 1 - Math.exp(-b.age * 12);
      const r = radius * expand;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      if (b.weapon === "shock") {
        for (let i = 0; i < 3; i++) {
          const wave = Math.max(0, b.age - i * 0.065);
          ctx.strokeStyle = i % 2 ? "#f2ffff" : "#69deff";
          ctx.lineWidth = (b.direct ? 7 : 5) * (1 - progress);
          ctx.beginPath();
          ctx.arc(
            b.x,
            b.y,
            radius * (1 - Math.exp(-wave * 7)) * (1 + i * 0.12),
            0,
            7,
          );
          ctx.stroke();
        }
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.strokeStyle = "#ccfaff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(
            b.x + Math.cos(a) * r * 0.45,
            b.y + Math.sin(a) * r * 0.45,
          );
          ctx.lineTo(
            b.x + Math.cos(a + 0.1) * r * 0.8,
            b.y + Math.sin(a + 0.1) * r * 0.8,
          );
          ctx.lineTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
          ctx.stroke();
        }
      } else if (b.weapon === "crater") {
        ctx.fillStyle = "#b49772";
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          ctx.beginPath();
          ctx.ellipse(
            b.x + Math.cos(a) * r * 0.68,
            b.y + Math.sin(a) * r * 0.65 - b.age * 25,
            r * 0.42,
            r * 0.32,
            a,
            0,
            7,
          );
          ctx.fill();
        }
        ctx.strokeStyle = "#e0c693";
        ctx.lineWidth = 6 * (1 - progress);
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, r * 1.12, r * 0.25, 0, 0, 7);
        ctx.stroke();
      } else {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + b.age;
          ctx.fillStyle = i % 2 ? "#ed6c24" : "#ffa62d";
          ctx.beginPath();
          ctx.arc(
            b.x + Math.cos(a) * r * 0.48,
            b.y + Math.sin(a) * r * 0.4,
            r * (0.42 + Math.sin(i) * 0.06),
            0,
            7,
          );
          ctx.fill();
        }
        ctx.fillStyle = "#ffe176";
        ctx.beginPath();
        ctx.arc(
          b.x,
          b.y - b.age * 12,
          r * 0.46 * Math.max(0, 1 - progress),
          0,
          7,
        );
        ctx.fill();
      }
      if (b.age < 0.095) {
        ctx.globalAlpha = 1 - b.age / 0.095;
        ctx.fillStyle = "#ffffe9";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 18 + b.age * 400, 0, 7);
        ctx.fill();
      }
    }
    this.bursts = this.bursts.filter((b) => b.age < 0.85);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.smoke ? -20 : 330) * dt;
      p.vx *= Math.exp(-dt * 0.6);
      ctx.globalAlpha = Math.max(0, p.life / p.max) * (p.smoke ? 0.5 : 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.smoke ? 2 - p.life / p.max : 1), 0, 7);
      ctx.fill();
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const l of this.labels) {
      l.age += dt;
      ctx.globalAlpha = Math.min(1, (1.6 - l.age) * 2);
      ctx.textAlign = "center";
      ctx.font = `900 ${l.blockSide ? 21 : l.direct ? 39 : 28}px sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#263b38";
      ctx.fillStyle = l.color;
      ctx.strokeText(l.text, l.x, l.y - l.age * 28);
      ctx.fillText(l.text, l.x, l.y - l.age * 28);
      if (l.direct) {
        ctx.font = "900 20px sans-serif";
        ctx.strokeText("DIRECT HIT!", l.x, l.y - 42 - l.age * 28);
        ctx.fillText("DIRECT HIT!", l.x, l.y - 42 - l.age * 28);
      }
    }
    this.labels = this.labels.filter((l) => l.age < 1.6);
    ctx.globalAlpha = 1;
  }
}
