export const WIDTH = 1280;
export const HEIGHT = 640;
export const STEP = 1 / 120;
export const GRAVITY = 220;
export type Side = "player" | "ai";
export type WeaponId = "shell" | "crater" | "shock" | "drone" | "missile";
export const WEAPON_IDS: WeaponId[] = [
  "shell",
  "crater",
  "shock",
  "drone",
  "missile",
];
export const EMP_WINDOW = 2.4;
export const DRONE_TIME = 5;
export type Difficulty = "easy" | "normal" | "hard";
export type Phase =
  "aim" | "flight" | "deploy" | "drone" | "resolve" | "ai-aim" | "over";
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
  directDamage: number;
  control: string;
  counter: string;
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
    damage: 20,
    directDamage: 28,
    control: "각도·세기 조준 / Space 발사",
    counter: "EMP 영향 없음",
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
    damage: 12,
    directDamage: 18,
    control: "각도·세기 조준 / Space 발사",
    counter: "EMP 영향 없음",
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
    damage: 10,
    directDamage: 16,
    control: "각도·세기 조준 / Space 발사",
    counter: "EMP 영향 없음",
    radius: 120,
    crater: 25,
    depth: 0.45,
    push: 150,
  },
  drone: {
    name: "공격 드론",
    short: "드론",
    description: "5초 직접 비행 · 우회 공격",
    color: "#90e09e",
    damage: 16,
    directDamage: 22,
    radius: 64,
    crater: 28,
    depth: 0.6,
    push: 0,
    control: "WASD / 방향키 이동 · Space 공격",
    counter: "EMP: 공격 기능 정지",
  },
  missile: {
    name: "유도탄",
    short: "유도탄",
    description: "목표 지정 · 제한된 방향 전환",
    color: "#ff976a",
    damage: 14,
    directDamage: 20,
    radius: 60,
    crater: 32,
    depth: 0.65,
    push: 0,
    control: "상대 차량 클릭 · 각도/세기 · 발사",
    counter: "EMP: 추적 해제, 탄도 비행",
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
  emp: number;
}
export interface Projectile extends Vec {
  vx: number;
  vy: number;
  age: number;
  owner: Side;
  weapon: WeaponId;
  trail: Vec[];
  target?: Side;
  guided?: boolean;
  flightAge?: number;
}
export interface Drone extends Vec {
  vx: number;
  vy: number;
  age: number;
  owner: Side;
  trail: Vec[];
  destination: Vec;
}
export interface Defense {
  remaining: number;
  owner: Side;
  used: boolean;
  reactionAt: number | null;
}
export interface AimMemory {
  bias: number;
  shots: number;
  lastMiss: number | null;
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
  type:
    | "shot"
    | "explosion"
    | "damage"
    | "wind"
    | "end"
    | "emp"
    | "disabled"
    | "threat";
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
  gravity = GRAVITY,
): Impact | null {
  const start = { x: p.x, y: p.y },
    ax = wind * 11;
  const end = {
    x: p.x + p.vx * dt + (ax * dt * dt) / 2,
    y: p.y + p.vy * dt + (gravity * dt * dt) / 2,
  };
  p.vx += ax * dt;
  p.vy += gravity * dt;
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
    ? w.directDamage
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
export const AI_PROFILE = {
  easy: {
    initialBias: 19,
    angleNoise: 12,
    powerNoise: 16,
    correction: 0.028,
    emp: 0.12,
  },
  normal: {
    initialBias: 11,
    angleNoise: 7,
    powerNoise: 10,
    correction: 0.035,
    emp: 0.46,
  },
  hard: {
    initialBias: 6,
    angleNoise: 4.5,
    powerNoise: 6,
    correction: 0.042,
    emp: 0.72,
  },
};
export function planAI(
  tank: Tank,
  target: Tank,
  terrain: Float64Array,
  wind: number,
  difficulty: Difficulty,
  memory: AimMemory,
  random: () => number,
): ShotPlan {
  const p = AI_PROFILE[difficulty];
  const plan = solveShot(tank, target, terrain, wind);
  // The estimate improves from observed landing error; the next wind is never sampled here.
  if (memory.lastMiss !== null)
    memory.bias = clamp(memory.bias + memory.lastMiss * p.correction, -24, 24);
  memory.lastMiss = null;
  plan.angle = clamp(plan.angle + (random() - 0.5) * p.angleNoise, 10, 80);
  plan.power = clamp(
    plan.power + memory.bias + (random() - 0.5) * p.powerNoise,
    20,
    100,
  );
  memory.shots++;
  return plan;
}
export function chooseArsenal(
  tank: Tank,
  target: Tank,
  terrain: Float64Array,
  difficulty: Difficulty,
  random: () => number,
): WeaponId {
  if (target.hp <= 20 || tank.hp < 18) return "shell";
  const electronicChance =
    difficulty === "easy" ? 0.1 : difficulty === "normal" ? 0.42 : 0.65;
  const chance = target.emp === 0 ? electronicChance + 0.18 : electronicChance;
  if (random() < chance) {
    if (tank.ammo.missile > 0 && (tank.ammo.drone === 0 || random() < 0.55))
      return "missile";
    if (tank.ammo.drone > 0) return "drone";
  }
  return chooseWeapon(tank, target, terrain, difficulty, random);
}
export function advanceMissile(
  p: Projectile,
  terrain: Float64Array,
  tanks: Tank[],
  wind: number,
  dt = STEP,
): Impact | null {
  p.flightAge = (p.flightAge ?? 0) + dt;
  if (!p.guided) return advance(p, terrain, tanks, wind, dt);
  const target = tanks.find((t) => t.side === p.target);
  if (target && p.flightAge <= 3.2) {
    const heading = Math.atan2(p.vy, p.vx),
      wanted = Math.atan2(target.y - 8 - p.y, target.x - p.x);
    const delta = Math.atan2(
      Math.sin(wanted - heading),
      Math.cos(wanted - heading),
    );
    const angle = heading + clamp(delta, -0.85 * dt, 0.85 * dt);
    const speed = Math.hypot(p.vx, p.vy);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
  }
  return advance(p, terrain, tanks, 0, dt, 0);
}
const newStats = (): Stats => ({ shots: 0, hits: 0, direct: 0, damage: 0 });
const weaponStats = () =>
  Object.fromEntries(WEAPON_IDS.map((id) => [id, newStats()])) as Record<
    WeaponId,
    Stats
  >;
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
  combat = { player: newStats(), ai: newStats() };
  stats = this.combat.player;
  telemetry = { player: weaponStats(), ai: weaponStats() };
  defenses = { player: 0, ai: 0 };
  drone: Drone | null = null;
  defense: Defense | null = null;
  target: Side | null = null;
  droneInput: Vec = { x: 0, y: 0 };
  autoEmp = false;
  aiMemory: AimMemory;
  lastImpact: { player: Impact | null; ai: Impact | null } = {
    player: null,
    ai: null,
  };
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
    this.aiMemory = {
      bias: (this.random() < 0.5 ? -1 : 1) * AI_PROFILE[difficulty].initialBias,
      shots: 0,
      lastMiss: null,
    };
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
      ammo: { shell: Infinity, crater: 2, shock: 2, drone: 2, missile: 2 },
      emp: 2,
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
    if (this.phase === "aim" && this.player.ammo[weapon] > 0) {
      if (weapon !== this.weapon) this.target = null;
      this.weapon = weapon;
    }
  }
  lockTarget(side: Side): boolean {
    if (this.phase !== "aim" || this.weapon !== "missile" || side !== "ai")
      return false;
    this.target = side;
    return true;
  }
  steerDrone(x: number, y: number) {
    if (this.phase !== "drone" || this.turn !== "player") return;
    const length = Math.max(1, Math.hypot(x, y));
    this.droneInput = { x: x / length, y: y / length };
  }
  attackDrone(): boolean {
    if (this.phase !== "drone" || this.turn !== "player" || !this.drone)
      return false;
    const d = this.drone;
    const direct =
      this.tanks.find(
        (t) => t.side !== d.owner && Math.hypot(t.x - d.x, t.y - 8 - d.y) <= 28,
      )?.side ?? null;
    this.finishAttack(
      { x: d.x, y: d.y, direct, escaped: false },
      "drone",
      d.owner,
    );
    return true;
  }
  canEmp(side: Side): boolean {
    return (
      this.phase === "deploy" &&
      !!this.defense &&
      this.defense.owner !== side &&
      !this.defense.used &&
      this.defense.remaining > 0 &&
      (side === "player" ? this.player : this.ai).emp > 0
    );
  }
  useEmp(side: Side): boolean {
    if (!this.canEmp(side)) return false;
    const tank = side === "player" ? this.player : this.ai;
    tank.emp--;
    this.defenses[side]++;
    this.defense!.used = true;
    this.events.push({ type: "emp", x: tank.x, y: tank.y - 15, side });
    if (this.drone) {
      this.events.push({
        type: "disabled",
        x: this.drone.x,
        y: this.drone.y,
        weapon: "drone",
      });
      this.finishAttack(null, "drone", this.drone.owner);
    } else if (this.projectile?.weapon === "missile") {
      this.projectile.guided = false;
      this.events.push({
        type: "disabled",
        x: this.projectile.x,
        y: this.projectile.y,
        weapon: "missile",
      });
    }
    return true;
  }
  fire(): boolean {
    return (
      this.phase === "aim" &&
      (this.weapon !== "missile" || this.target === "ai") &&
      this.shoot(this.player, this.weapon)
    );
  }
  private shoot(tank: Tank, weapon: WeaponId): boolean {
    if (this.projectile || this.drone || tank.ammo[weapon] <= 0 || this.result)
      return false;
    tank.ammo[weapon]--;
    this.turn = tank.side;
    this.combat[tank.side].shots++;
    this.telemetry[tank.side][weapon].shots++;
    this.droneInput = { x: 0, y: 0 };
    if (weapon === "drone" || weapon === "missile") {
      this.phase = "deploy";
      const willDefend =
        tank.side === "player" &&
        this.ai.emp > 0 &&
        this.random() < AI_PROFILE[this.difficulty].emp;
      this.defense = {
        owner: tank.side,
        remaining: EMP_WINDOW,
        used: false,
        reactionAt: willDefend ? 0.65 + this.random() * 1.05 : null,
      };
      if (weapon === "drone") {
        const target = tank.side === "player" ? this.ai : this.player;
        const error =
          this.difficulty === "easy"
            ? 120
            : this.difficulty === "normal"
              ? 70
              : 40;
        this.drone = {
          x: tank.x,
          y: tank.y - 40,
          vx: 0,
          vy: 0,
          age: 0,
          owner: tank.side,
          trail: [],
          destination: {
            x: clamp(target.x + (this.random() - 0.5) * error, 40, WIDTH - 40),
            y: target.y - 14,
          },
        };
      } else {
        this.projectile = launch(tank, weapon);
        this.projectile.guided = true;
        this.projectile.target =
          tank.side === "player" ? this.target! : "player";
      }
      this.events.push({
        type: "threat",
        x: tank.x,
        y: tank.y - 40,
        weapon,
        side: tank.side,
      });
    } else {
      this.phase = "flight";
      this.projectile = launch(tank, weapon);
    }
    tank.recoil = 1;
    this.events.push({
      type: "shot",
      ...muzzle(tank),
      weapon,
      side: tank.side,
      angle: tank.angle,
    });
    return true;
  }
  private finishAttack(hit: Impact | null, weapon: WeaponId, owner: Side) {
    this.lastImpact[owner] = hit;
    if (owner === "ai" && weapon !== "drone" && weapon !== "missile" && hit)
      this.aiMemory.lastMiss = hit.x - this.player.x;
    this.projectile = null;
    this.drone = null;
    this.defense = null;
    this.droneInput = { x: 0, y: 0 };
    if (hit && !hit.escaped) this.explode(hit, weapon, owner);
    this.phase = "resolve";
    this.timer = hit && !hit.escaped ? 0.85 : 0.4;
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
      if (this.drone && (this.phase === "deploy" || this.phase === "drone"))
        continue;
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
    if (this.phase === "deploy" && this.defense) {
      const defense = this.defense;
      defense.remaining = Math.max(0, defense.remaining - STEP);
      if (this.drone) {
        const tank = this.turn === "player" ? this.player : this.ai;
        const t = 1 - defense.remaining / EMP_WINDOW;
        this.drone.y =
          tank.y -
          40 +
          (Math.min(210, tank.y - 120) - (tank.y - 40)) * Math.min(1, t * 2);
      }
      if (
        this.canEmp("ai") &&
        defense.reactionAt !== null &&
        EMP_WINDOW - defense.remaining >= defense.reactionAt
      )
        this.useEmp("ai");
      else if (
        this.autoEmp &&
        this.canEmp("player") &&
        EMP_WINDOW - defense.remaining >= 0.9
      )
        this.useEmp("player");
      if (this.phase === "deploy" && defense.remaining <= 0)
        this.phase = this.drone ? "drone" : "flight";
    } else if (this.phase === "drone" && this.drone) {
      const d = this.drone;
      d.age += STEP;
      let input = this.droneInput;
      if (d.owner === "ai") {
        const dx = d.destination.x - d.x;
        const desiredY =
          Math.abs(dx) > 65
            ? Math.min(210, d.destination.y - 130)
            : d.destination.y;
        const dy = desiredY - d.y,
          length = Math.max(1, Math.hypot(dx, dy));
        input = { x: dx / length, y: dy / length };
      }
      const smoothing = 1 - Math.exp(-12 * STEP);
      d.vx += (input.x * 285 - d.vx) * smoothing;
      d.vy += (input.y * 285 - d.vy) * smoothing;
      const probe: Projectile = {
        x: d.x,
        y: d.y,
        vx: d.vx,
        vy: d.vy,
        age: 1,
        owner: d.owner,
        weapon: "drone",
        trail: [],
      };
      const hit = advance(
        probe,
        this.terrain,
        this.tanks.filter((t) => t.side !== d.owner),
        0,
        STEP,
        0,
      );
      d.x = clamp(probe.x, 10, WIDTH - 10);
      d.y = clamp(probe.y, 30, HEIGHT);
      d.trail.push({ x: d.x, y: d.y });
      if (d.trail.length > 35) d.trail.shift();
      if (hit) this.finishAttack(hit, "drone", d.owner);
      else if (
        d.owner === "ai" &&
        Math.hypot(d.x - d.destination.x, d.y - d.destination.y) < 12
      ) {
        const direct =
          Math.hypot(d.x - this.player.x, d.y - this.player.y + 8) < 28
            ? "player"
            : null;
        this.finishAttack(
          { x: d.x, y: d.y, direct, escaped: false },
          "drone",
          d.owner,
        );
      } else if (d.age >= DRONE_TIME) {
        this.events.push({ type: "disabled", x: d.x, y: d.y, weapon: "drone" });
        this.finishAttack(null, "drone", d.owner);
      }
    } else if (this.phase === "flight" && this.projectile) {
      const p = this.projectile,
        hit =
          p.weapon === "missile"
            ? advanceMissile(p, this.terrain, this.tanks, this.wind)
            : advance(p, this.terrain, this.tanks, this.wind);
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 55) p.trail.shift();
      if (hit) {
        this.finishAttack(hit, p.weapon, p.owner);
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
        if (t.side !== owner) {
          this.combat[owner].damage += amount;
          this.telemetry[owner][weapon].damage += amount;
          enemyHit = true;
          if (direct) {
            this.combat[owner].direct++;
            this.telemetry[owner][weapon].direct++;
          }
        }
      }
      const force =
        WEAPONS[weapon].push *
        Math.max(0, 1 - distance / (WEAPONS[weapon].radius + 25));
      t.vx +=
        Math.sign(t.x - hit.x || (owner === "player" ? 1 : -1)) * force * 5;
    }
    if (enemyHit) {
      this.combat[owner].hits++;
      this.telemetry[owner][weapon].hits++;
    }
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
      const tacticalWeapon = chooseArsenal(
        this.ai,
        this.player,
        this.terrain,
        this.difficulty,
        this.random,
      );
      const plan = planAI(
        this.ai,
        this.player,
        this.terrain,
        this.wind,
        this.difficulty,
        this.aiMemory,
        this.random,
      );
      plan.weapon = tacticalWeapon;
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
