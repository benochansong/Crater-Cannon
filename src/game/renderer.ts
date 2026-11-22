import { Battle, WIDTH, HEIGHT, WEAPONS, launch, STEP, advance } from './engine';
import type { GameEvent, Tank, WeaponId } from './engine';
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; smoke: boolean }
interface Burst { x: number; y: number; age: number; weapon: WeaponId; direct: boolean }
interface Label { x: number; y: number; age: number; text: string; direct: boolean; color: string }
export class Renderer {
  particles: Particle[] = [];
  bursts: Burst[] = [];
  labels: Label[] = [];
  time = 0;
  shake = 0;
  private terrainLayer: HTMLCanvasElement;
  private cachedRevision = -1;
  private cachedSeed = -1;
  constructor() { this.terrainLayer = document.createElement('canvas'); this.terrainLayer.width = WIDTH; this.terrainLayer.height = HEIGHT; }
  event(e: GameEvent) {
    if (e.type === 'shot') {
      this.shake = Math.max(this.shake, 3);
      for (let i = 0; i < 20; i++) this.particle(e.x, e.y, (Math.random() - 0.5) * 110, (Math.random() - 0.7) * 100, i < 8 ? '#fff4ad' : '#e7e9cf', 3 + Math.random() * 7, 0.25 + Math.random() * 0.35, i > 7);
    }
    if (e.type === 'explosion') {
      const w = e.weapon!; this.bursts.push({ x: e.x, y: e.y, age: 0, weapon: w, direct: !!e.direct }); this.shake = e.direct ? 13 : 8;
      for (let i = 0; i < 65; i++) {
        const a = Math.random() * Math.PI * 2, speed = 35 + Math.random() * 230;
        this.particle(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed - 65, i < 24 ? WEAPONS[w].color : i < 42 ? '#8a653f' : '#ddc9a6', 2 + Math.random() * 9, 0.45 + Math.random() * 1.4, i > 41);
      }
    }
    if (e.type === 'damage') this.labels.push({ x: e.x, y: e.y, age: 0, text: `−${e.amount}`, direct: !!e.direct, color: e.side === 'ai' ? '#fff8b5' : '#ffddce' });
  }
  private particle(x: number, y: number, vx: number, vy: number, color: string, size: number, life: number, smoke: boolean) {
    if (this.particles.length >= 240) this.particles.shift();
    this.particles.push({ x, y, vx, vy, color, size, life, max: life, smoke });
  }
  draw(ctx: CanvasRenderingContext2D, game: Battle, dt: number, options: { shake: boolean; menu: boolean }) {
    this.time += dt;
    const scaleX = ctx.canvas.width / WIDTH, scaleY = ctx.canvas.height / HEIGHT;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0); ctx.clearRect(0, 0, WIDTH, HEIGHT);
    this.sky(ctx);
    ctx.save();
    this.shake *= Math.exp(-8 * dt);
    if (options.shake && this.shake > 0.1) ctx.translate(Math.sin(this.time * 110) * this.shake, Math.cos(this.time * 93) * this.shake * 0.6);
    this.terrain(ctx, game);
    if (game.phase === 'aim' && !options.menu) this.guide(ctx, game);
    for (const t of game.tanks) this.tank(ctx, t);
    if (game.projectile) {
      const p = game.projectile;
      for (let i = 0; i < p.trail.length; i += 2) {
        const t = p.trail[i]; ctx.globalAlpha = i / p.trail.length * 0.5; ctx.fillStyle = WEAPONS[p.weapon].color;
        ctx.beginPath(); ctx.arc(t.x, t.y, 2 + i / p.trail.length * 2.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowColor = WEAPONS[p.weapon].color; ctx.shadowBlur = 15;
      ctx.fillStyle = '#fff8d3'; ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (p.y < 15) { ctx.fillStyle = '#173d45'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`▲ 포탄 · ${Math.round(-p.y)}m`, Math.max(90, Math.min(WIDTH - 90, p.x)), 35); }
    }
    this.effects(ctx, dt);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  private sky(ctx: CanvasRenderingContext2D) {
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT); grad.addColorStop(0, '#79c4cb'); grad.addColorStop(0.7, '#d8e7c8'); grad.addColorStop(1, '#e8e9b9'); ctx.fillStyle = grad; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fff3b5'; ctx.beginPath(); ctx.arc(1000, 98, 53, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff7cc55'; ctx.beginPath(); ctx.arc(1000, 98, 77, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const x = ((i * 237 + this.time * (4 + i % 3)) % 1570) - 140, y = 62 + (i % 3) * 44;
      ctx.fillStyle = '#f4f5dd'; ctx.globalAlpha = 0.65; ctx.beginPath(); ctx.ellipse(x, y, 64, 14, 0, 0, 7); ctx.ellipse(x + 26, y - 11, 38, 20, 0, 0, 7); ctx.ellipse(x - 14, y - 15, 30, 23, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.mountain(ctx, '#93bcb2', [[-70, 345], [130, 151], [267, 296], [415, 126], [610, 340], [820, 184], [1020, 328], [1190, 143], [1390, 352]]);
    this.mountain(ctx, '#6c9e91', [[-60, 380], [150, 268], [290, 370], [475, 244], [690, 403], [960, 238], [1160, 349], [1370, 243]]);
    ctx.fillStyle = '#d8e5ce88'; ctx.beginPath(); ctx.moveTo(350, 198); ctx.lineTo(415, 126); ctx.lineTo(485, 205); ctx.lineTo(438, 183); ctx.lineTo(409, 200); ctx.lineTo(398, 176); ctx.closePath(); ctx.fill();
    this.mountain(ctx, '#477f73', [[-80, 420], [120, 347], [330, 417], [530, 346], [750, 452], [940, 365], [1110, 424], [1370, 335]]);
    for (let i = 0; i < 33; i++) {
      const x = i * 43 + 17, y = 382 + Math.sin(i * 0.7) * 30;
      ctx.fillStyle = '#3c7569'; ctx.beginPath(); ctx.moveTo(x, y - 23 - i % 5 * 4); ctx.lineTo(x - 12, y + 10); ctx.lineTo(x + 12, y + 10); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#cee1ba55'; ctx.fillRect(0, 408, WIDTH, 232);
  }
  private mountain(ctx: CanvasRenderingContext2D, color: string, points: number[][]) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, HEIGHT); for (const [x, y] of points) ctx.lineTo(x, y); ctx.lineTo(WIDTH, HEIGHT); ctx.closePath(); ctx.fill();
  }
  private terrain(ctx: CanvasRenderingContext2D, game: Battle) {
    if (game.terrainRevision !== this.cachedRevision || game.seed !== this.cachedSeed) {
      this.cachedRevision = game.terrainRevision; this.cachedSeed = game.seed;
      const c = this.terrainLayer.getContext('2d')!; c.clearRect(0, 0, WIDTH, HEIGHT);
      c.beginPath(); c.moveTo(0, HEIGHT); for (let x = 0; x <= WIDTH; x += 2) c.lineTo(x, game.terrain[x]); c.lineTo(WIDTH, HEIGHT); c.closePath();
      const soil = c.createLinearGradient(0, 400, 0, HEIGHT); soil.addColorStop(0, '#987346'); soil.addColorStop(0.5, '#795c3c'); soil.addColorStop(1, '#493e31'); c.fillStyle = soil; c.fill();
      c.save(); c.clip();
      c.strokeStyle = '#b28c5266'; c.lineWidth = 16;
      for (let y = 470; y < HEIGHT; y += 57) { c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= WIDTH; x += 15) c.lineTo(x, y + Math.sin(x / 110) * 16); c.stroke(); }
      for (let i = 0; i < 450; i++) { const x = (i * 157.31) % WIDTH, y = 400 + (i * 83.73) % 240; c.fillStyle = i % 3 ? '#d2ac6966' : '#352c2a55'; c.beginPath(); c.ellipse(x, y, 1 + i % 4, 1 + i % 2, i, 0, 7); c.fill(); }
      c.restore();
      for (const [width, color, offset] of [[15, '#365b37', 4], [10, '#6c9340', 0], [4, '#b8cf65', -4]] as const) {
        c.lineWidth = width; c.strokeStyle = color; c.beginPath(); for (let x = 0; x <= WIDTH; x += 2) { const y = game.terrain[x] + offset; if (!x) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
      }
      for (let x = 10; x < WIDTH; x += 17) {
        const y = game.terrain[x]; c.strokeStyle = x % 3 ? '#c2d476' : '#719342'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 5, y - 7); c.moveTo(x, y); c.lineTo(x + 2, y - 10); c.stroke();
        if (x % 7 === 0) { c.fillStyle = '#f7dd85'; c.beginPath(); c.arc(x + 2, y - 10, 2, 0, 7); c.fill(); }
      }
    }
    ctx.drawImage(this.terrainLayer, 0, 0);
  }
  private tank(ctx: CanvasRenderingContext2D, t: Tank) {
    const blue = t.side === 'player', base = blue ? '#2b91b6' : '#cf624c', light = blue ? '#75d0dc' : '#ef9b6f', dark = blue ? '#1c526e' : '#803e37';
    ctx.save(); ctx.translate(t.x, t.y);
    ctx.fillStyle = '#263b2d44'; ctx.beginPath(); ctx.ellipse(0, 20, 38, 8, 0, 0, 7); ctx.fill();
    ctx.translate(t.hurt > 0 ? Math.sin(this.time * 80) * t.hurt * 3 : 0, -Math.sin(t.recoil * Math.PI) * 2);
    ctx.save(); ctx.rotate(t.tilt);
    ctx.fillStyle = '#243c3c'; ctx.strokeStyle = '#152e36'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-33, 1, 66, 20, 10); ctx.fill(); ctx.stroke();
    for (let i = -22; i <= 22; i += 14.7) { ctx.fillStyle = '#9eae94'; ctx.beginPath(); ctx.arc(i, 11, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#43594f'; ctx.beginPath(); ctx.arc(i, 11, 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(-34, -9, 68, 17, 5); ctx.fill();
    ctx.fillStyle = base; ctx.beginPath(); ctx.moveTo(-31, -5); ctx.lineTo(-23, -20); ctx.lineTo(22, -20); ctx.lineTo(33, -5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = light; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-23, -18); ctx.lineTo(22, -18); ctx.stroke();
    ctx.fillStyle = '#fff3c4'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(blue ? '01' : '02', -16, -6);
    ctx.fillStyle = '#1f3843'; ctx.fillRect(12, -15, 10, 7); ctx.fillStyle = '#fff6bf'; ctx.fillRect(26, -7, 5, 4);
    ctx.restore();
    ctx.save(); ctx.translate(0, -15); ctx.rotate((blue ? -t.angle : 180 + t.angle) * Math.PI / 180);
    ctx.translate(-t.recoil * 9, 0); ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(0, -6, 45, 12, 3); ctx.fill(); ctx.fillStyle = light; ctx.fillRect(10, -5, 29, 3); ctx.fillStyle = '#243841'; ctx.fillRect(40, -7, 7, 14); ctx.restore();
    ctx.fillStyle = base; ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -16, 17, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = light; ctx.beginPath(); ctx.roundRect(-9, -28, 18, 5, 2); ctx.fill();
    ctx.strokeStyle = '#293d41'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -15); ctx.lineTo(-23, -41); ctx.stroke(); ctx.fillStyle = '#ffe5a0'; ctx.beginPath(); ctx.arc(-23, -42, 2, 0, 7); ctx.fill();
    if (t.hp < 35) { ctx.fillStyle = '#56615b66'; for (let i = 0; i < 3; i++) { const a = (this.time * 0.8 + i / 3) % 1; ctx.beginPath(); ctx.arc(13 + Math.sin(a * 4) * 8, -25 - a * 45, 3 + a * 10, 0, 7); ctx.fill(); } }
    ctx.restore();
  }
  private guide(ctx: CanvasRenderingContext2D, game: Battle) {
    const p = launch(game.player, game.weapon); ctx.fillStyle = '#fffadd';
    for (let i = 0; i < 75; i++) { if (advance(p, game.terrain, game.tanks, game.wind, STEP)) break; if (i % 10 === 0) { ctx.globalAlpha = 0.9 - i / 100; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill(); } }
    ctx.globalAlpha = 1;
  }
  private effects(ctx: CanvasRenderingContext2D, dt: number) {
    for (const b of this.bursts) {
      b.age += dt; const progress = b.age / 0.65, r = WEAPONS[b.weapon].radius * Math.min(1, progress * 3);
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = b.age < 0.08 ? '#fffce2' : WEAPONS[b.weapon].color; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = '#fff7bf'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.2, 0, 7); ctx.stroke();
    }
    this.bursts = this.bursts.filter(b => b.age < 0.65);
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.smoke ? -20 : 330) * dt; p.vx *= Math.exp(-dt * 0.6);
      ctx.globalAlpha = Math.max(0, p.life / p.max) * (p.smoke ? 0.5 : 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.smoke ? 2 - p.life / p.max : 1), 0, 7); ctx.fill();
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const l of this.labels) {
      l.age += dt; ctx.globalAlpha = Math.min(1, (1.6 - l.age) * 2); ctx.textAlign = 'center'; ctx.font = `900 ${l.direct ? 39 : 28}px sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = '#263b38'; ctx.fillStyle = l.color;
      ctx.strokeText(l.text, l.x, l.y - l.age * 28); ctx.fillText(l.text, l.x, l.y - l.age * 28);
      if (l.direct) { ctx.font = '900 20px sans-serif'; ctx.strokeText('DIRECT HIT!', l.x, l.y - 42 - l.age * 28); ctx.fillText('DIRECT HIT!', l.x, l.y - 42 - l.age * 28); }
    }
    this.labels = this.labels.filter(l => l.age < 1.6); ctx.globalAlpha = 1;
  }
}
