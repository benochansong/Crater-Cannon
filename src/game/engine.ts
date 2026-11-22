export const WIDTH = 1280;
export const HEIGHT = 640;
export const STEP = 1 / 120;
export const GRAVITY = 220;
export type Side = "player" | "ai";
export type WeaponId = "shell" | "crater" | "shock";
export type Difficulty = "easy" | "normal" | "hard";
export type Phase = "aim" | "flight" | "resolve" | "ai-aim" | "over";
export type Outcome = "victory" | "defeat" | "draw";
export interface Vec {
  x: number;
  y: number;
}
export interface Weapon {
  name: string;
  short: string;
  description: string;
  color: string;
  damage: number;
  radius: number;
  crater: number;
  depth: number;
  push: number;
}
export const WEAPONS: Record<WeaponId, Weapon> = {
  shell: {
    name: "기본 폭발탄",
    short: "폭발탄",
    description: "균형 잡힌 화력 · 무제한",
    color: "#ffbc43",
    damage: 34,
    radius: 68,
    crater: 48,
    depth: 0.85,
    push: 0,
  },
  crater: {
    name: "크레이터탄",
    short: "크레이터",
    description: "넓고 깊은 지형 파괴 · 2발",
    color: "#c491ff",
    damage: 19,
    radius: 90,
    crater: 92,
    depth: 1.2,
    push: 0,
  },
  shock: {
    name: "충격파탄",
    short: "충격파",
    description: "강한 파동으로 밀어내기 · 2발",
    color: "#72ecff",
    damage: 17,
    radius: 120,
    crater: 25,
    depth: 0.45,
    push: 150,
  },
};
export interface Tank extends Vec {
  side: Side;
  hp: number;
  angle: number;
  power: number;
  tilt: number;
  recoil: number;
  hurt: number;
  vy: number;
  vx: number;
  ammo: Record<WeaponId, number>;
}
export interface Projectile extends Vec {
  vx: number;
  vy: number;
  age: number;
  owner: Side;
  weapon: WeaponId;
  trail: Vec[];
}
export interface Impact extends Vec {
  direct: Side | null;
  escaped: boolean;
}
export interface Stats {
  shots: number;
  hits: number;
  direct: number;
  damage: number;
}
export interface BattleResult extends Stats {
  id: string;
  outcome: Outcome;
  hp: number;
  enemyHp: number;
  seconds: number;
  difficulty: Difficulty;
  date: string;
}
export interface GameEvent extends Vec {
  type: "shot" | "explosion" | "damage" | "wind" | "end";
  angle?: number;
  weapon?: WeaponId;
  side?: Side;
  direct?: boolean;
  amount?: number;
  outcome?: Outcome;
}
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makeTerrain(random: () => number): Float64Array {
  const phase = random() * 6.28;
  return Float64Array.from(
    { length: WIDTH + 1 },
    (_, x) =>
      412 +
      112 * Math.sin((x / WIDTH) * Math.PI) ** 2 +
      15 * Math.sin(x / 85 + phase) +
      9 * Math.sin(x / 39 + phase),
  );
}
export function ground(terrain: Float64Array, x: number): number {
  const p = clamp(x, 0, WIDTH),
    i = Math.floor(p);
  return (
    terrain[i] +
    ((terrain[Math.min(WIDTH, i + 1)] ?? terrain[i]) - terrain[i]) * (p - i)
  );
}
export function support(terrain: Float64Array, x: number): number {
  let y = HEIGHT;
  for (let dx = -21; dx <= 21; dx += 3)
    y = Math.min(y, ground(terrain, x + dx));
  return y - 17;
}
export function carve(
  terrain: Float64Array,
  x: number,
  y: number,
  weapon: WeaponId,
): number {
  const w = WEAPONS[weapon];
  let removed = 0;
  for (
    let i = Math.max(0, Math.floor(x - w.crater));
    i <= Math.min(WIDTH, Math.ceil(x + w.crater));
    i++
  ) {
    const depth =
      Math.sqrt(Math.max(0, w.crater ** 2 - (i - x) ** 2)) * w.depth;
    const next = Math.min(HEIGHT - 22, Math.max(terrain[i], y + depth));
    removed += next - terrain[i];
    terrain[i] = next;
  }
  return removed;
}
export function muzzle(tank: Tank): Vec {
  const a = (tank.angle * Math.PI) / 180,
    direction = tank.side === "player" ? 1 : -1;
  return {
    x: tank.x + Math.cos(a) * 43 * direction,
    y: tank.y - 15 - Math.sin(a) * 43,
  };
}
export function launch(tank: Tank, weapon: WeaponId): Projectile {
  const pos = muzzle(tank),
    a = (tank.angle * Math.PI) / 180,
    speed = 180 + tank.power * 5;
  return {
    ...pos,
    vx: Math.cos(a) * speed * (tank.side === "player" ? 1 : -1),
    vy: -Math.sin(a) * speed,
    age: 0,
    owner: tank.side,
    weapon,
    trail: [],
  };
}
// Sweep vehicle samples and every terrain-column boundary, including single-pixel ridges.
export function advance(
  p: Projectile,
  terrain: Float64Array,
  tanks: Tank[],
  wind: number,
  dt = STEP,
): Impact | null {
  const start = { x: p.x, y: p.y },
    ax = wind * 11;
  const end = {
    x: p.x + p.vx * dt + (ax * dt * dt) / 2,
    y: p.y + p.vy * dt + (GRAVITY * dt * dt) / 2,
  };
  p.vx += ax * dt;
  p.vy += GRAVITY * dt;
  p.age += dt;
  const steps =
    Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 2) || 1;
  const fractions = Array.from({ length: steps }, (_, i) => (i + 1) / steps);
  if (end.x !== start.x)
    for (
      let x = Math.ceil(Math.min(start.x, end.x));
      x <= Math.floor(Math.max(start.x, end.x));
      x++
    ) {
      const f = (x - start.x) / (end.x - start.x);
      if (f > 0 && f <= 1) fractions.push(f);
    }
  fractions.sort((a, b) => a - b);
  for (const fraction of fractions) {
    p.x = start.x + (end.x - start.x) * fraction;
    p.y = start.y + (end.y - start.y) * fraction;
    if (p.x < -50 || p.x > WIDTH + 50 || p.y > HEIGHT + 100 || p.age >= 12)
      return { x: p.x, y: p.y, direct: null, escaped: true };
    for (const t of tanks) {
      if (t.hp <= 0 || (t.side === p.owner && p.age < 0.15)) continue;
      if (((p.x - t.x) / 29) ** 2 + ((p.y - (t.y - 8)) / 23) ** 2 <= 1)
        return { x: p.x, y: p.y, direct: t.side, escaped: false };
    }
    if (p.x >= 0 && p.x <= WIDTH && p.y >= ground(terrain, p.x))
      return { x: p.x, y: p.y, direct: null, escaped: false };
  }
  return null;
}
export function blastDamage(
  distance: number,
  weapon: WeaponId,
  direct = false,
): number {
  const w = WEAPONS[weapon];
  return direct
    ? w.damage + 9
    : Math.round(
        w.damage * Math.max(0, 1 - Math.max(0, distance - 22) / w.radius),
      );
}
export function judge(playerHp: number, aiHp: number): Outcome | null {
  if (playerHp <= 0 && aiHp <= 0) return "draw";
  return aiHp <= 0 ? "victory" : playerHp <= 0 ? "defeat" : null;
}
export interface ShotPlan {
  angle: number;
  power: number;
  weapon: WeaponId;
}
export function solveShot(
  tank: Tank,
  target: Tank,
  terrain: Float64Array,
  wind: number,
): ShotPlan {
  let best = { angle: 45, power: 55, weapon: "shell" as WeaponId },
    score = Infinity;
  for (let angle = 22; angle <= 78; angle += 4)
    for (let power = 25; power <= 100; power += 3) {
      const p = launch({ ...tank, angle, power }, "shell");
      let hit: Impact | null = null;
      for (let n = 0; n < 1441 && !hit; n++)
        hit = advance(p, terrain, [tank, target], wind);
      if (!hit || hit.escaped) continue;
      const d =
        Math.hypot(hit.x - target.x, hit.y - target.y) -
        (hit.direct === target.side ? 45 : 0);
      if (d < score) {
        score = d;
        best = { angle, power, weapon: "shell" };
      }
    }
  return best;
}
export function chooseWeapon(
  tank: Tank,
  target: Tank,
  terrain: Float64Array,
  difficulty: Difficulty,
  random: () => number,
): WeaponId {
  if (difficulty === "easy" || target.hp <= 43 || tank.hp <= 22) return "shell";
  const slope = Math.abs(
    ground(terrain, target.x + 55) - ground(terrain, target.x - 55),
  );
  const roomToDig = HEIGHT - 22 - ground(terrain, target.x);
  if (
    tank.ammo.shock > 0 &&
    slope > 24 &&
    random() < (difficulty === "hard" ? 0.8 : 0.45)
  )
    return "shock";
  if (
    tank.ammo.crater > 0 &&
    roomToDig > 80 &&
    random() < (difficulty === "hard" ? 0.6 : 0.3)
  )
    return "crater";
  return "shell";
}
export class Battle {
  terrain: Float64Array;
  originalTerrain: Float64Array;
  tanks: [Tank, Tank];
  phase: Phase = "aim";
  turn: Side = "player";
  round = 1;
  wind = 0;
  weapon: WeaponId = "shell";
  projectile: Projectile | null = null;
  stats: Stats = { shots: 0, hits: 0, direct: 0, damage: 0 };
  elapsed = 0;
  result: BattleResult | null = null;
  events: GameEvent[] = [];
  terrainRevision = 0;
  timer = 0;
  private accumulator = 0;
  private aiPlan: ShotPlan | null = null;
  readonly random: () => number;
  constructor(
    public difficulty: Difficulty = "normal",
    public seed = Math.floor(Math.random() * 1e9),
  ) {
    this.random = seeded(seed);
    this.terrain = makeTerrain(this.random);
    this.originalTerrain = this.terrain.slice();
    this.tanks = [this.makeTank("player", 210), this.makeTank("ai", 1070)];
    this.wind = this.rollWind();
  }
  private makeTank(side: Side, x: number): Tank {
    return {
      side,
      x,
      y: support(this.terrain, x),
      hp: 100,
      angle: 45,
      power: 55,
      tilt: 0,
      recoil: 0,
      hurt: 0,
      vx: 0,
      vy: 0,
      ammo: { shell: Infinity, crater: 2, shock: 2 },
    };
  }
  private rollWind() {
    return Math.floor(this.random() * 11) - 5;
  }
  get player() {
    return this.tanks[0];
  }
  get ai() {
    return this.tanks[1];
  }
  aim(angle: number, power: number) {
    if (this.phase !== "aim") return;
    this.player.angle = clamp(angle, 10, 80);
    this.player.power = clamp(power, 20, 100);
  }
  select(weapon: WeaponId) {
    if (this.phase === "aim" && this.player.ammo[weapon] > 0)
      this.weapon = weapon;
  }
  fire(): boolean {
    return this.phase === "aim" && this.shoot(this.player, this.weapon);
  }
  private shoot(tank: Tank, weapon: WeaponId): boolean {
    if (this.projectile || tank.ammo[weapon] <= 0 || this.result) return false;
    tank.ammo[weapon]--;
    this.turn = tank.side;
    this.phase = "flight";
    this.projectile = launch(tank, weapon);
    tank.recoil = 1;
    if (tank.side === "player") this.stats.shots++;
    this.events.push({
      type: "shot",
      ...muzzle(tank),
      weapon,
      side: tank.side,
      angle: tank.angle,
    });
    return true;
  }
  update(dt: number) {
    if (this.phase === "over") return;
    this.accumulator += clamp(dt, 0, 0.1);
    while (this.accumulator + 1e-10 >= STEP) {
      this.tick();
      this.accumulator -= STEP;
    }
  }
  private tick() {
    if (this.phase === "over") return;
    this.elapsed += STEP;
    for (const tank of this.tanks) {
      tank.recoil = Math.max(0, tank.recoil - STEP * 3.8);
      tank.hurt = Math.max(0, tank.hurt - STEP * 2);
      tank.x = clamp(tank.x + tank.vx * STEP, 34, WIDTH - 34);
      tank.vx *= Math.exp(-5 * STEP);
      const floor = support(this.terrain, tank.x);
      if (tank.y < floor) {
        tank.vy += 550 * STEP;
        tank.y = Math.min(floor, tank.y + tank.vy * STEP);
      } else {
        tank.y = floor;
        tank.vy = 0;
      }
      tank.tilt = clamp(
        Math.atan2(
          ground(this.terrain, tank.x + 20) - ground(this.terrain, tank.x - 20),
          40,
        ),
        -0.3,
        0.3,
      );
    }
    if (this.phase === "flight" && this.projectile) {
      const p = this.projectile,
        hit = advance(p, this.terrain, this.tanks, this.wind);
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 55) p.trail.shift();
      if (hit) {
        this.projectile = null;
        if (!hit.escaped) this.explode(hit, p.weapon, p.owner);
        this.phase = "resolve";
        this.timer = hit.escaped ? 0.25 : 0.85;
      }
    } else if (this.phase === "resolve") {
      this.timer -= STEP;
      if (
        this.timer <= 0 &&
        this.tanks.every(
          (t) =>
            Math.abs(t.y - support(this.terrain, t.x)) < 0.5 &&
            Math.abs(t.vx) < 3,
        )
      )
        this.nextTurn();
    } else if (this.phase === "ai-aim") {
      this.timer -= STEP;
      if (this.aiPlan) {
        this.ai.angle += (this.aiPlan.angle - this.ai.angle) * 6 * STEP;
        if (this.timer <= 0) {
          this.ai.angle = this.aiPlan.angle;
          this.ai.power = this.aiPlan.power;
          this.shoot(this.ai, this.aiPlan.weapon);
        }
      }
    }
  }
  private explode(hit: Impact, weapon: WeaponId, owner: Side) {
    let enemyHit = false;
    for (const t of this.tanks) {
      const distance = Math.hypot(t.x - hit.x, t.y - 8 - hit.y),
        direct = hit.direct === t.side;
      const amount = Math.min(t.hp, blastDamage(distance, weapon, direct));
      if (amount > 0) {
        t.hp -= amount;
        t.hurt = direct ? 1.4 : 0.7;
        this.events.push({
          type: "damage",
          x: t.x,
          y: t.y - 45,
          amount,
          direct,
          side: t.side,
          weapon,
        });
        if (owner === "player" && t.side === "ai") {
          this.stats.damage += amount;
          enemyHit = true;
          if (direct) this.stats.direct++;
        }
      }
      const force =
        WEAPONS[weapon].push *
        Math.max(0, 1 - distance / (WEAPONS[weapon].radius + 25));
      t.vx +=
        Math.sign(t.x - hit.x || (owner === "player" ? 1 : -1)) * force * 5;
    }
    if (enemyHit) this.stats.hits++;
    carve(this.terrain, hit.x, hit.y, weapon);
    this.terrainRevision++;
    this.events.push({
      type: "explosion",
      x: hit.x,
      y: hit.y,
      weapon,
      direct: hit.direct !== null,
    });
  }
  private nextTurn() {
    const outcome = judge(this.player.hp, this.ai.hp);
    if (outcome) {
      this.phase = "over";
      this.result = {
        ...this.stats,
        id: `${this.seed}-${Date.now()}`,
        outcome,
        hp: this.player.hp,
        enemyHp: this.ai.hp,
        seconds: Math.round(this.elapsed),
        difficulty: this.difficulty,
        date: new Date().toISOString(),
      };
      this.events.push({ type: "end", x: WIDTH / 2, y: HEIGHT / 2, outcome });
      return;
    }
    if (this.turn === "player") {
      this.turn = "ai";
      this.phase = "ai-aim";
      this.timer = 0.8;
      const tacticalWeapon = chooseWeapon(
        this.ai,
        this.player,
        this.terrain,
        this.difficulty,
        this.random,
      );
      const plan = solveShot(this.ai, this.player, this.terrain, this.wind);
      plan.weapon = tacticalWeapon;
      const spread =
        this.difficulty === "easy"
          ? 11
          : this.difficulty === "normal"
            ? 5.5
            : 2.4;
      plan.angle = clamp(plan.angle + (this.random() - 0.5) * spread, 10, 80);
      plan.power = clamp(
        plan.power + (this.random() - 0.5) * spread * 1.5,
        20,
        100,
      );

      this.aiPlan = plan;
    } else {
      this.turn = "player";
      this.phase = "aim";
      this.round++;
      const oldWind = this.wind;
      this.wind = this.rollWind();
      if (this.wind !== oldWind)
        this.events.push({ type: "wind", x: WIDTH / 2, y: 80 });
      if (this.player.ammo[this.weapon] <= 0) this.weapon = "shell";
    }
  }
  drainEvents() {
    return this.events.splice(0);
  }
}
