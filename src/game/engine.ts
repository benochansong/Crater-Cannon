import {
  CONVOY_ROUTE,
  CONVOY_GATES,
  WAVES,
  createConvoy,
  createBoss,
  escortVerdict,
  nextBossPhase,
} from "./operations";
import type {
  ConvoyState,
  BossState,
  OperationScene,
  OperationRecord,
} from "./operations";
import { createFacility, facilityY, objectiveVerdict } from "./objectives";
import type {
  CollisionTarget,
  TargetId,
  Facility,
  ObjectiveRecord,
  MissionReason,
} from "./objectives";
import { FREE_BATTLE, ERA_WEAPONS, ERA_SUPPORTS } from "./eras";
import { choosePlayerSide, facingTarget, mirrorTerrain } from "./sides";
import type { Facing, PlayerPlacement } from "./sides";
import { analyzeImpact } from "./shotHistory";
import type { ShotSetup, ShotRecord } from "./shotHistory";
import { newTrainingStats, countTraining } from "./training";
import type { TrainingStats } from "./training";
import type { BattleConfig, Era } from "./eras";
import { chooseTactic } from "./tactics";
import type { TacticalAction } from "./tactics";
import { AIR, airDamage, makeOperation } from "./airSupport";
import type { AirKind, AirReservation, AirOperation } from "./airSupport";
import {
  traverseBlock,
  reachable,
  SHORT_DISTANCE,
  MOVE_DISTANCE,
  MOVE_SPEED,
} from "./movement";
import { repairAmount, REPAIR_TIME, shieldDamage } from "./defense";
export const WIDTH = 1280;
export const HEIGHT = 640;
export const STEP = 1 / 120;
export const GRAVITY = 220;
export type Side = "player" | "ai";
export type WeaponId =
  "shell" | "crater" | "shock" | "drone" | "missile" | "ap";
export const WEAPON_IDS: WeaponId[] = [
  "shell",
  "crater",
  "shock",
  "drone",
  "missile",
  "ap",
];
export const EMP_WINDOW = 4;
export const DRONE_TIME = 5;
export type Difficulty = "easy" | "normal" | "hard";
export type Phase =
  | "aim"
  | "flight"
  | "deploy"
  | "drone"
  | "resolve"
  | "ai-aim"
  | "action"
  | "air"
  | "over";
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
  ap: {
    name: "철갑탄",
    short: "철갑탄",
    description: "장갑 관통 · 직격 중심",
    color: "#e4d8ad",
    damage: 3,
    directDamage: 26,
    control: "각도·세기 조준 / Space 발사",
    counter: "장갑 관통 · 엄폐 감소 효과 15%",
    radius: 28,
    crater: 16,
    depth: 0.5,
    push: 0,
  },
  shell: {
    name: "기본 폭발탄",
    short: "폭발탄",
    description: "균형 잡힌 화력 · 무제한",
    color: "#ffbc43",
    damage: 17,
    directDamage: 24,
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
    damage: 10,
    directDamage: 16,
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
    damage: 13,
    directDamage: 18,
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
    damage: 12,
    directDamage: 18,
    radius: 60,
    crater: 32,
    depth: 0.65,
    push: 0,
    control: "상대 차량 클릭 · 각도/세기 · 발사",
    counter: "EMP: 추적 해제, 탄도 비행",
  },
};
export function weaponInfo(id: WeaponId, era: Era): Weapon {
  const w = WEAPONS[id];
  if (era !== "ww2") return w;
  if (id === "shell")
    return {
      ...w,
      name: "고폭탄 (HE)",
      short: "고폭탄",
      description: "파편 범위 피해 · 무제한",
      counter: "중장갑에는 철갑탄 권장",
    };
  if (id === "crater")
    return {
      ...w,
      name: "중포탄",
      short: "중포탄",
      description: "깊은 지형 파괴 · 진지 기초 공략",
      counter: "장갑 피해보다 지형 파괴 중심",
    };
  return w;
}
export interface Tank extends Vec {
  facing: Facing;
  width?: number;
  height?: number;
  side: Side;
  hp: number;
  angle: number;
  power: number;
  tilt: number;
  recoil: number;
  hurt: number;
  vy: number;
  vx: number;
  mobility: {
    remaining: number;
    used: boolean;
    input: number;
    speed: number;
    travel: number;
    reason: string;
    dust: number;
  };
  ammo: Record<WeaponId, number>;
  emp: number;
  repairs: number;
  shields: number;
  shield: boolean;
  shieldRaw: number;
  support: Record<AirKind, number>;
  airRemaining: number;
  smoke: boolean;
  cover: boolean;
  smokes: number;
  covers: number;
}
export interface Projectile extends Vec {
  vx: number;
  vy: number;
  age: number;
  owner: Side;
  weapon: WeaponId;
  trail: Vec[];
  target?: TargetId;
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
  direct: TargetId | null;
  escaped: boolean;
}
export interface Stats {
  shots: number;
  hits: number;
  direct: number;
  damage: number;
}
export interface BattleResult extends Stats {
  assisted?: boolean;
  operation?: OperationRecord;
  objective?: ObjectiveRecord;
  reason?: MissionReason;
  round?: number;
  missionId?: string;
  id: string;
  outcome: Outcome;
  hp: number;
  enemyHp: number;
  seconds: number;
  difficulty: Difficulty;
  date: string;
}
export interface GameEvent extends Vec {
  facing?: Facing;
  facility?: boolean;
  type:
    | "shot"
    | "explosion"
    | "damage"
    | "wind"
    | "end"
    | "emp"
    | "disabled"
    | "threat"
    | "repair"
    | "shield"
    | "block"
    | "shield-end"
    | "move"
    | "air-call"
    | "air-enter"
    | "operation";
  text?: string;
  angle?: number;
  weapon?: WeaponId;
  side?: Side;
  direct?: boolean;
  amount?: number;
  outcome?: Outcome;
  airKind?: AirKind;
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
    direction = tank.facing;
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
    vx: Math.cos(a) * speed * tank.facing,
    vy: -Math.sin(a) * speed,
    age: 0,
    owner: tank.side,
    weapon,
    trail: [],
  };
}
export function hitsTarget(p: Vec, t: CollisionTarget) {
  return (
    ((p.x - t.x) / (t.width ? t.width / 2 : 29)) ** 2 +
      ((p.y - (t.y - 8)) / (t.height ? t.height / 2 : 23)) ** 2 <=
    1
  );
}
// Sweep vehicle samples and every terrain-column boundary, including single-pixel ridges.
export function advance(
  p: Projectile,
  terrain: Float64Array,
  tanks: CollisionTarget[],
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
      if (hitsTarget(p, t))
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
  target: CollisionTarget,
  terrain: Float64Array,
  wind: number,
  obstacles: CollisionTarget[] = [],
): ShotPlan {
  let best = { angle: 45, power: 55, weapon: "shell" as WeaponId },
    score = Infinity;
  for (let angle = 22; angle <= 78; angle += 4)
    for (let power = 25; power <= 100; power += 3) {
      const p = launch(
        { ...tank, facing: facingTarget(tank.x, target.x), angle, power },
        "shell",
      );
      let hit: Impact | null = null;
      for (let n = 0; n < 1441 && !hit; n++)
        hit = advance(p, terrain, [tank, target, ...obstacles], wind);
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
  target: CollisionTarget,
  terrain: Float64Array,
  wind: number,
  difficulty: Difficulty,
  memory: AimMemory,
  random: () => number,
  obstacles: CollisionTarget[] = [],
): ShotPlan {
  const p = AI_PROFILE[difficulty];
  const plan = solveShot(tank, target, terrain, wind, obstacles);
  // The estimate improves from observed landing error; the next wind is never sampled here.
  if (memory.lastMiss !== null)
    memory.bias = clamp(
      memory.bias -
        memory.lastMiss * facingTarget(tank.x, target.x) * p.correction,
      -24,
      24,
    );
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
  tanks: CollisionTarget[],
  wind: number,
  dt = STEP,
): Impact | null {
  p.flightAge = (p.flightAge ?? 0) + dt;
  if (!p.guided) return advance(p, terrain, tanks, wind, dt);
  const target = tanks.find((t) => t.side === p.target && t.hp > 0);
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
  readonly placement: PlayerPlacement;
  private updateFacing() {
    this.player.facing = facingTarget(this.player.x, this.ai.x);
    this.ai.facing = facingTarget(this.ai.x, this.player.x);
  }
  assisted = false;
  shotHistory: ShotRecord[] = [];
  specialHistory: ShotRecord[] = [];
  private pendingShot: ShotSetup | null = null;
  trainingStats: TrainingStats | null = null;
  trainingLesson = 0;
  trainingLock = 45;
  setTrainingLesson(lesson: number) {
    if (!this.config.training || this.phase !== "aim") return;
    this.trainingLesson = lesson;
    this.trainingLock = lesson === 1 ? this.player.angle : this.player.power;
    if (lesson === 3) this.wind = 3;
  }
  setTrainingWind(wind: number) {
    if (this.config.training && this.phase === "aim")
      this.wind = Math.round(clamp(wind, -5, 5));
  }
  convoy: ConvoyState | null = null;
  boss: BossState | null = null;
  scene: OperationScene | null = null;
  private resumeOperationTurn = false;
  facility: Facility | null = null;
  completedRounds = 0;
  reinforcement = 1;
  restoredFacilityHp = 0;
  aiAttackTarget: TargetId = "player";
  facilityAimMemory: AimMemory = { bias: 0, shots: 0, lastMiss: null };
  selectedTarget: TargetId = "ai";
  get collisionTargets(): CollisionTarget[] {
    return this.facility ? [...this.tanks, this.facility] : this.tanks;
  }
  get aiTargetBody(): CollisionTarget {
    return this.aiAttackTarget === "objective" && this.facility?.hp
      ? this.facility
      : this.player;
  }
  get targetBody(): CollisionTarget {
    return this.selectedTarget === "objective" && this.facility
      ? this.facility
      : this.selectedTarget === "player"
        ? this.player
        : this.ai;
  }
  get objectiveRecord(): ObjectiveRecord | undefined {
    const c = this.config.objective,
      f = this.facility;
    return c && f
      ? {
          type: c.type,
          hp: f.hp,
          maxHp: f.maxHp,
          completedRounds: this.completedRounds,
          reinforcement: 1 - this.reinforcement,
          restored: this.restoredFacilityHp,
        }
      : undefined;
  }
  chooseTarget(id: TargetId) {
    const target = this.collisionTargets.find((t) => t.side === id && t.hp > 0);
    if (!target || this.phase !== "aim") return false;
    this.selectedTarget = id;
    if (this.weapon === "missile") {
      this.target = null;
      this.lockTarget(id);
    }
    if (
      this.airSelection &&
      (id === "ai" || (id === "objective" && this.facility?.owner === "ai"))
    )
      this.setAirTarget(target.x);
    return true;
  }
  canReinforce() {
    return (
      this.config.objective?.type === "defend" &&
      !!this.facility &&
      this.facility.hp > 0 &&
      this.facility.hp < this.facility.maxHp &&
      this.reinforcement > 0 &&
      this.canAct("player") &&
      !this.player.mobility.input
    );
  }
  reinforce() {
    if (!this.canReinforce() || !this.facility) return false;
    const f = this.facility,
      amount = Math.min(15, f.maxHp - f.hp);
    f.hp += amount;
    this.restoredFacilityHp += amount;
    this.reinforcement--;
    this.lastAction.player = "reinforce";
    this.events.push({
      type: "repair",
      x: f.x,
      y: f.y - 40,
      amount,
      facility: true,
      side: "player",
    });
    this.phase = "resolve";
    this.timer = 1;
    return true;
  }
  private damageFacility(raw: number, owner: Side, weapon?: WeaponId) {
    const f = this.facility;
    if (!f || f.hp <= 0) return 0;
    if (this.convoy && owner === "ai") {
      const before = raw;
      if (this.convoyCovered) raw = Math.round(raw * 0.75);
      const shielded = shieldDamage(
        raw,
        this.convoy.shieldRaw,
        this.convoy.shield,
      );
      if (this.convoy.shield) this.convoy.shieldRaw = shielded.total;
      raw = shielded.amount;
      this.convoy.protectedDamage += before - raw;
    }
    const amount = Math.min(f.hp, Math.max(0, Math.round(raw)));
    if (!amount) return 0;
    f.hp -= amount;
    f.hurt = 1;
    if (this.convoy)
      this.convoy.warning =
        "⚠ 보급 차량 피격 −" + amount + " · 호송 보호 또는 EMP로 대응하세요";
    this.events.push({
      type: "damage",
      x: f.x,
      y: f.y - 55,
      amount,
      side: f.owner,
      weapon,
      facility: true,
    });
    if (f.owner !== owner) {
      this.combat[owner].damage += amount;
      if (weapon) this.telemetry[owner][weapon].damage += amount;
    }
    return amount;
  }

  guardTime = 0;
  breachHits = 0;
  get allowedWeapons() {
    return this.config.weapons.filter((w) =>
      ERA_WEAPONS[this.config.era].includes(w),
    );
  }
  get allowedSupports() {
    return this.config.supports.filter((w) =>
      ERA_SUPPORTS[this.config.era].includes(w),
    );
  }
  get breachProgress() {
    if (!this.config.fortified) return 1;
    let depth = 0;
    for (let x = 1035; x <= 1105; x++)
      depth += this.terrain[x] - this.originalTerrain[x];
    return Math.min(1, Math.max(this.breachHits / 3, depth / 71 / 18));
  }
  get fortified() {
    return !!this.config.fortified && this.breachProgress < 1;
  }
  terrain: Float64Array;
  originalTerrain: Float64Array;
  tanks: [Tank, Tank];
  phase: Phase = "aim";
  action: {
    kind: "repair" | "shield" | "move";
    owner: Side;
    age: number;
    duration: number;
    startHp: number;
    amount: number;
    direction: number;
    distance: number;
  } | null = null;
  actionCounts = {
    player: {
      repair: 0,
      shield: 0,
      move: 0,
      helicopter: 0,
      bomber: 0,
      artillery: 0,
      propeller: 0,
      smoke: 0,
      cover: 0,
    },
    ai: {
      repair: 0,
      shield: 0,
      move: 0,
      helicopter: 0,
      bomber: 0,
      artillery: 0,
      propeller: 0,
      smoke: 0,
      cover: 0,
    },
  };
  lastAction: Record<Side, string> = { player: "", ai: "" };
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
  target: TargetId | null = null;
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
  pendingAir: AirReservation | null = null;
  air: AirOperation | null = null;
  airSelection: AirKind | null = null;
  airTarget: number | null = null;
  supportStats = {
    player: {
      helicopter: newStats(),
      bomber: newStats(),
      artillery: newStats(),
      propeller: newStats(),
    },
    ai: {
      helicopter: newStats(),
      bomber: newStats(),
      artillery: newStats(),
      propeller: newStats(),
    },
  };
  private airSequence = 0;
  private resumeAfterAir: Side | null = null;
  private accumulator = 0;
  private aiPlan: ShotPlan | null = null;
  private aiAdjustment = 0;
  private aiWeapon: WeaponId = "shell";
  private mobilityRandom: () => number;
  private aiAction: TacticalAction | null = null;
  readonly random: () => number;
  constructor(
    public difficulty: Difficulty = "normal",
    public seed = Math.floor(Math.random() * 1e9),
    public readonly config: BattleConfig = FREE_BATTLE,
    placement?: PlayerPlacement,
  ) {
    const randomSides =
      config.randomSides &&
      !config.missionId &&
      !config.training &&
      !config.objective &&
      !config.boss;
    this.placement = randomSides
      ? (placement ?? choosePlayerSide(seed))
      : "left";
    this.random = seeded(seed);
    this.terrain = makeTerrain(this.random);
    if (config.field !== "valley") {
      const offset = {
        normandy: 0,
        france: 1,
        fortress: 2,
        frontier: 3,
        signal: 4,
        radar: 5,
        convoy: 6,
        citadel: 7,
      }[config.field];
      this.terrain = Float64Array.from(this.terrain, (y, x) =>
        clamp(y + (offset + 1) * 8 * Math.sin(x / 140 + offset), 350, 570),
      );
    }
    if (config.field === "convoy" || config.field === "citadel") {
      this.terrain = Float64Array.from(
        this.terrain,
        (_, x) => 450 + 22 * Math.sin(x / 230) + 8 * Math.sin(x / 95),
      );
    }
    if (config.training)
      this.terrain = Float64Array.from(this.terrain, (_, x) =>
        config.training === "C"
          ? 470 - 140 * Math.exp(-Math.pow((x - 1000) / 175, 4))
          : 470,
      );
    if (this.placement === "right") this.terrain = mirrorTerrain(this.terrain);
    this.originalTerrain = this.terrain.slice();
    this.mobilityRandom = seeded(this.seed ^ 0x763831);
    const place = (x: number) => (this.placement === "right" ? WIDTH - x : x);
    this.tanks = [
      this.makeTank("player", place(config.spawns?.player ?? 210)),
      this.makeTank("ai", place(config.spawns?.ai ?? 1070)),
    ];
    this.updateFacing();
    if (config.objective)
      this.facility = createFacility(config.objective, this.terrain);
    if (config.objective?.type === "destroy-objective")
      this.selectedTarget = "objective";
    this.wind = config.training ? 0 : this.rollWind();
    if (config.training) {
      this.trainingStats = newTrainingStats();
      for (const t of this.tanks) {
        t.emp = 0;
        t.shields = 0;
        t.repairs = 0;
      }
    }
    this.aiMemory = {
      bias: (this.random() < 0.5 ? -1 : 1) * AI_PROFILE[difficulty].initialBias,
      shots: 0,
      lastMiss: null,
    };
    this.facilityAimMemory = { ...this.aiMemory };
    if (config.objective?.type === "escort") {
      this.convoy = createConvoy();
      this.configureWave();
    }
    if (config.boss) {
      this.boss = createBoss();
      this.ai.width = 108;
      this.ai.height = 58;
      this.ai.repairs = 0;
      this.ai.shields = 1;
      this.ai.emp = 1;
      this.ai.ammo.drone = 1;
      this.ai.ammo.missile = 1;
      this.startScene("boss-intro", "IRON CITADEL — ARMORED COMMANDER", 2.5);
    }
  }

  get enemyName() {
    return this.convoy ? WAVES[this.convoy.wave].name : this.config.enemyName;
  }
  get convoyCovered() {
    return (
      !!this.convoy &&
      !!this.facility &&
      this.player.x > this.facility.x &&
      this.player.x - this.facility.x <= 180
    );
  }
  get operationRecord(): OperationRecord | undefined {
    if (!this.convoy && !this.boss) return undefined;
    return {
      type: this.convoy ? "escort" : "boss",
      checkpoint: this.convoy?.checkpoint ?? 0,
      kills: this.convoy?.kills ?? Number(this.ai.hp <= 0),
      wave: this.convoy ? this.convoy.wave + 1 : 0,
      phase: this.boss?.phase ?? 0,
      weakness: this.boss?.weakness ?? 0,
      protectedDamage: this.convoy?.protectedDamage ?? 0,
      defenses: this.defenses.player + this.actionCounts.player.shield,
    };
  }
  canProtectConvoy() {
    return (
      !!this.convoy &&
      this.facility!.hp > 0 &&
      this.canAct("player") &&
      this.convoyCovered &&
      !this.convoy.shield &&
      this.player.shields > 0 &&
      !this.player.mobility.input
    );
  }
  protectConvoy() {
    if (!this.canProtectConvoy()) return false;
    this.player.shields--;
    this.convoy!.shield = true;
    this.convoy!.shieldRaw = 0;
    this.actionCounts.player.shield++;
    this.lastAction.player = "convoy-shield";
    this.events.push({
      type: "shield",
      x: this.facility!.x,
      y: this.facility!.y,
      side: "player",
    });
    this.phase = "resolve";
    this.timer = 0.7;
    return true;
  }
  skipScene() {
    this.scene = null;
    if (this.resumeOperationTurn) {
      this.resumeOperationTurn = false;
      this.nextTurn(true);
    }
  }
  private startScene(
    kind: OperationScene["kind"],
    title: string,
    duration = 1.6,
  ) {
    this.adjust(0, "player");
    this.adjust(0, "ai");
    this.scene = { kind, title, remaining: duration, duration };
    this.events.push({
      type: "operation",
      x: this.ai.x,
      y: this.ai.y - 65,
      text: title,
    });
  }
  private configureWave() {
    const c = this.convoy!,
      w = WAVES[c.wave];
    this.ai.hp = w.hp;
    this.ai.ammo.drone = w.drone;
    this.ai.ammo.missile = w.missile;
    this.ai.repairs = 0;
    this.ai.shields = c.wave === 2 ? 1 : 0;
    this.ai.emp = c.wave === 2 ? 1 : 0;
    this.ai.airRemaining = 0;
    this.ai.ammo.crater = c.wave === 2 ? 1 : 0;
  }
  private tickOperation() {
    if (this.scene) {
      this.scene.remaining -= STEP;
      if (this.scene.remaining <= 0) this.skipScene();
      return true;
    }
    const c = this.convoy,
      f = this.facility;
    if (c?.moving && f) {
      c.driveTime += STEP;
      const q = Math.min(1, c.driveTime / 1.6),
        old = f.x;
      f.x = c.fromX + (c.targetX - c.fromX) * (q * q * (3 - 2 * q));
      c.travel += f.x - old;
      f.y = facilityY(this.originalTerrain, f.x, f.width, f.height);
      if (q >= 1) {
        c.moving = false;
        c.checkpoint++;
        c.warning =
          c.checkpoint === 5
            ? "보급 차량 도착"
            : "체크포인트 " + c.checkpoint + "/5 확보";
        this.nextTurn(true);
      }
      return true;
    }
    return false;
  }
  private advanceOperation(cycleEnded: boolean, skipCycle: boolean) {
    const c = this.convoy,
      b = this.boss,
      f = this.facility;
    if (
      c &&
      f &&
      this.player.hp > 0 &&
      f.hp > 0 &&
      !skipCycle &&
      !this.pendingAir
    ) {
      if (this.ai.hp <= 0 && !c.cleared) {
        c.kills++;
        c.cleared = true;
        if (c.wave < WAVES.length - 1) {
          c.wave++;
          c.cleared = false;
          c.newWave = true;
          this.tanks[1] = this.makeTank("ai", WAVES[c.wave].x);
          this.configureWave();
          this.aiMemory = {
            bias: AI_PROFILE[this.difficulty].initialBias,
            shots: 0,
            lastMiss: null,
          };
          this.facilityAimMemory = { ...this.aiMemory };
          this.aiPlan = null;
          this.aiAction = null;
          this.aiAdjustment = 0;
          this.lastAction.ai = "";
          this.lastImpact.ai = null;
          this.target = null;
          this.selectedTarget = "ai";
          this.startScene(
            "wave",
            "WAVE " + (c.wave + 1) + " · " + WAVES[c.wave].name,
            1.5,
          );
        }
      }
      if (
        cycleEnded &&
        c.checkpoint < 5 &&
        c.kills >= CONVOY_GATES[c.checkpoint]
      ) {
        c.fromX = f.x;
        c.targetX = CONVOY_ROUTE[c.checkpoint + 1];
        c.driveTime = 0;
        c.moving = true;
        c.warning = "호송 전용 차선 주행 · " + (c.checkpoint + 1) + "/5";
        this.phase = "resolve";
        return true;
      }
      if (cycleEnded && c.checkpoint < 5)
        c.warning = "통로 차단 · 현재 적 전차를 격파하세요";
    }
    if (b && this.player.hp > 0) {
      const drop =
        this.originalTerrain[Math.round(this.ai.x)] !== undefined
          ? this.terrain[Math.round(this.ai.x)] -
            this.originalTerrain[Math.round(this.ai.x)]
          : 0;
      const next = nextBossPhase(b, this.ai.hp, drop, this.player.x);
      if (next > b.phase) {
        if (b.phase === 1) {
          b.weakness++;
          b.plates = 0;
          if (!b.transitions.includes(2)) b.transitions.push(2);
        }
        b.phase = next;
        if (!b.transitions.includes(next)) b.transitions.push(next);
        this.startScene(
          "boss-phase",
          next === 2 ? "PHASE 2 · 방어선 붕괴" : "PHASE 3 · 최후의 반격",
        );
      }
      if (this.ai.hp <= 0 && !b.deathShown) {
        b.deathShown = true;
        carve(this.terrain, this.ai.x, this.ai.y, "crater");
        this.terrainRevision++;
        this.events.push({
          type: "explosion",
          x: this.ai.x,
          y: this.ai.y,
          weapon: "crater",
          direct: true,
        });
        this.startScene("boss-end", "지휘전차 격파 · 북부 방어선 돌파", 2);
        this.resumeOperationTurn = true;
        return true;
      }
    }
    return false;
  }

  private makeTank(side: Side, x: number): Tank {
    return {
      side,
      facing: side === "player" ? 1 : -1,
      x,
      y: support(this.terrain, x),
      hp: clamp(this.config.initialHp?.[side] ?? 100, 1, 100),
      angle: 45,
      power: 55,
      tilt: 0,
      recoil: 0,
      hurt: 0,
      vx: 0,
      vy: 0,
      mobility: {
        remaining: SHORT_DISTANCE,
        used: false,
        input: 0,
        speed: 0,
        travel: 0,
        reason: "",
        dust: 0,
      },
      ammo: Object.fromEntries(
        WEAPON_IDS.map((w) => [
          w,
          this.allowedWeapons.includes(w) ? (this.config.ammo[w] ?? 0) : 0,
        ]),
      ) as Record<WeaponId, number>,
      emp: this.config.era === "modern" ? 2 : 0,
      repairs: this.config.repairs,
      shields: this.config.era === "modern" ? 2 : 0,
      shield: false,
      shieldRaw: 0,
      support: Object.fromEntries(
        (["helicopter", "bomber", "artillery", "propeller"] as AirKind[]).map(
          (k) => [
            k,
            this.allowedSupports.includes(k) &&
            (side === "player" ||
              !this.config.enemySupports ||
              this.config.enemySupports.includes(k))
              ? 1
              : 0,
          ],
        ),
      ) as Record<AirKind, number>,
      airRemaining: this.config.airBudget,
      smoke: false,
      cover: false,
      smokes: this.config.smoke ? 2 : 0,
      covers: this.config.cover ? 2 : 0,
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
  private tankFor(side: Side) {
    return side === "player" ? this.player : this.ai;
  }
  private canAct(side: Side) {
    return (
      !this.result &&
      !this.scene &&
      !this.convoy?.moving &&
      this.tankFor(side).hp > 0 &&
      this.turn === side &&
      this.phase === (side === "player" ? "aim" : "ai-aim")
    );
  }
  canRepair(side: Side = "player") {
    const t = this.tankFor(side);
    return (
      this.canAct(side) &&
      this.config.repairs > 0 &&
      this.lastAction[side] !== "repair" &&
      t.repairs > 0 &&
      t.hp > 0 &&
      t.hp < 100
    );
  }
  repair(side: Side = "player"): boolean {
    if (!this.canRepair(side)) return false;
    const t = this.tankFor(side),
      amount = repairAmount(t.hp);
    t.repairs--;
    this.actionCounts[side].repair++;
    this.lastAction[side] = "repair";
    this.action = {
      kind: "repair",
      owner: side,
      age: 0,
      duration: REPAIR_TIME,
      startHp: t.hp,
      amount,
      direction: 0,
      distance: 0,
    };
    this.phase = "action";
    this.events.push({ type: "repair", x: t.x, y: t.y - 45, side, amount });
    return true;
  }
  canFieldDefense(kind: "smoke" | "cover", side: Side = "player") {
    const t = this.tankFor(side);
    return (
      this.config.era === "ww2" &&
      this.config[kind] &&
      this.canAct(side) &&
      !t[kind] &&
      t[kind === "smoke" ? "smokes" : "covers"] > 0
    );
  }
  fieldDefense(kind: "smoke" | "cover", side: Side = "player") {
    if (!this.canFieldDefense(kind, side)) return false;
    const t = this.tankFor(side);
    t[kind] = true;
    t[kind === "smoke" ? "smokes" : "covers"]--;
    this.actionCounts[side][kind]++;
    this.lastAction[side] = kind;
    this.phase = "resolve";
    this.timer = 0.8;
    return true;
  }
  isReaction(side: Side = "player") {
    return (
      this.turn !== side &&
      ["flight", "deploy", "drone", "air"].includes(this.phase)
    );
  }
  canShield(side: Side = "player") {
    const t = this.tankFor(side);
    return (
      t.hp > 0 &&
      this.config.era === "modern" &&
      !this.result &&
      (this.canAct(side) || this.isReaction(side)) &&
      t.shields > 0 &&
      !t.shield
    );
  }
  activateShield(side: Side = "player"): boolean {
    if (!this.canShield(side)) return false;
    const t = this.tankFor(side);
    t.shields--;
    t.shield = true;
    t.shieldRaw = 0;
    this.actionCounts[side].shield++;
    if (this.isReaction(side)) {
      this.events.push({ type: "shield", x: t.x, y: t.y - 20, side });
      return true;
    }
    this.lastAction[side] = "shield";
    this.action = {
      kind: "shield",
      owner: side,
      age: 0,
      duration: 0.75,
      startHp: t.hp,
      amount: 0,
      direction: 0,
      distance: 0,
    };
    this.phase = "action";
    this.events.push({ type: "shield", x: t.x, y: t.y - 20, side });
    return true;
  }

  adjustmentReason(side: Side = "player"): string {
    const t = this.tankFor(side);
    if (!this.config.movement || (side === "ai" && this.fortified))
      return "이 임무에서는 이동할 수 없습니다";
    if (!this.canAct(side)) return "정상 공격 턴에 이동할 수 있습니다";
    if (this.pendingAir?.responseStarted && this.pendingAir.owner !== side)
      return "항공 지원 대응: 한 행동만 선택하세요";
    if (t.mobility.remaining <= 0.001) return "이번 턴 이동 거리 소진";
    if (Math.abs(t.y - support(this.terrain, t.x)) > 2 || Math.abs(t.vx) > 3)
      return "지면에 안착하는 중";
    return "";
  }
  canAdjust(side: Side = "player") {
    return !this.adjustmentReason(side);
  }
  private get tankClearance() {
    return Math.max(
      68,
      (this.player.width ?? 58) / 2 + (this.ai.width ?? 58) / 2 + 10,
    );
  }
  adjustmentRange(side: Side = "player") {
    const t = this.tankFor(side),
      other = this.tankFor(side === "player" ? "ai" : "player");
    const range = reachable(
      this.terrain,
      t.x,
      this.canAdjust(side) ? t.mobility.remaining : 0,
      other.x,
      this.tankClearance,
    );
    const f = this.facility;
    if (f && f.hp > 0 && !this.convoy) {
      const gap = f.width / 2 + 34;
      if (f.x < t.x) range.left = Math.max(range.left, f.x + gap);
      else range.right = Math.min(range.right, f.x - gap);
    }
    return range;
  }
  private pathBlock(from: number, to: number, side: Side) {
    const f = this.facility;
    if (
      f &&
      !this.convoy &&
      f.hp > 0 &&
      Math.min(from, to) < f.x + f.width / 2 + 34 &&
      Math.max(from, to) > f.x - f.width / 2 - 34
    )
      return "시설이 경로를 막고 있습니다";
    return traverseBlock(
      this.terrain,
      from,
      to,
      this.tankFor(side === "player" ? "ai" : "player").x,
      this.tankClearance,
    );
  }
  adjust(direction: number, side: Side = "player"): boolean {
    const t = this.tankFor(side),
      m = t.mobility;
    if (direction === 0) {
      m.input = 0;
      m.speed = 0;
      return true;
    }
    if (![-1, 1].includes(direction)) return false;
    const reason =
      this.adjustmentReason(side) ||
      this.pathBlock(t.x, t.x + direction * 0.5, side);
    if (reason) {
      m.reason = reason;
      this.adjust(0, side);
      return false;
    }
    if (m.input !== direction) m.speed = 0;
    m.input = direction;
    t.vx = 0; // Residual knockback must not add uncharged distance to a controlled move.
    m.reason = "";
    return true;
  }
  private drive(t: Tank) {
    const m = t.mobility;
    if (!m.input) return;
    const reason = this.adjustmentReason(t.side);
    if (reason) {
      m.reason = reason;
      this.adjust(0, t.side);
      return;
    }
    const direction = m.input;
    const slope =
      (ground(this.terrain, t.x + direction * 22) - ground(this.terrain, t.x)) /
      22;
    const topSpeed = 64 / (1 + Math.max(0, -slope) * 1.5);
    m.speed = Math.min(
      topSpeed,
      m.speed + (this.config.era === "ww2" ? 160 : 230) * STEP,
    );
    const distance = Math.min(
      m.speed * STEP,
      m.remaining,
      t.side === "ai" ? this.aiAdjustment : Infinity,
    );
    const block = this.pathBlock(t.x, t.x + direction * distance, t.side);
    if (block) {
      m.reason = block;
      this.adjust(0, t.side);
      return;
    }
    t.x += direction * distance;
    t.y = support(this.terrain, t.x);
    t.vy = 0;
    m.used = true;
    m.travel += direction * distance;
    m.remaining = Math.max(0, m.remaining - distance);
    if (t.side === "ai")
      this.aiAdjustment = Math.max(0, this.aiAdjustment - distance);
    if (m.remaining < 0.001) {
      m.remaining = 0;
      m.reason = "이번 턴 이동 거리 소진";
      this.adjust(0, t.side);
    }
  }
  private planAdjustment(): boolean {
    if (this.round === 1 || !this.canAdjust("ai")) return false;
    const chance =
      this.difficulty === "easy"
        ? 0.12
        : this.difficulty === "normal"
          ? 0.32
          : 0.55;
    if (this.mobilityRandom() >= chance) return false;
    const range = this.adjustmentRange("ai");
    const distance =
      this.difficulty === "easy" ? 20 : this.difficulty === "normal" ? 36 : 55;
    const candidates = [-1, 1]
      .map((direction) => {
        const x =
          direction < 0
            ? Math.max(range.left, this.ai.x - distance)
            : Math.min(range.right, this.ai.x + distance);
        const height = support(this.terrain, x);
        // Prefer a clear elevated firing position and a useful artillery separation.
        let score = -Math.abs(Math.abs(x - this.player.x) - 700) * 0.025;
        if (this.difficulty !== "easy") score += (this.ai.y - height) * 0.35;
        if (this.difficulty === "hard") {
          const ahead = ground(this.terrain, x + this.ai.facing * 50);
          score -= Math.max(0, height - ahead - 25) * 0.5;
        }
        return { direction, distance: Math.abs(x - this.ai.x), score };
      })
      .filter((c) => c.distance > 8)
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) return false;
    this.aiAdjustment = best.distance;
    return this.adjust(best.direction, "ai");
  }
  private aimAI() {
    const plan = planAI(
      this.ai,
      this.aiTargetBody,
      this.terrain,
      this.wind,
      this.difficulty,
      this.aiAttackTarget === "objective"
        ? this.facilityAimMemory
        : this.aiMemory,
      this.random,
      this.config.objective ? this.collisionTargets : [],
    );
    plan.weapon = this.aiWeapon;
    this.aiPlan = plan;
  }

  canMove(direction: number, side: Side = "player") {
    if (
      (this.tankFor(side).mobility.used &&
        !(
          this.pendingAir?.responseStarted && this.pendingAir.owner !== side
        )) ||
      !this.config.movement ||
      (side === "ai" && this.fortified) ||
      !this.canAct(side) ||
      ![-1, 1].includes(direction)
    )
      return false;
    const t = this.tankFor(side);
    return !this.pathBlock(t.x, t.x + direction * 2, side);
  }
  move(direction: number, side: Side = "player"): boolean {
    if (!this.canMove(direction, side)) return false;
    const t = this.tankFor(side);
    this.actionCounts[side].move++;
    this.lastAction[side] = "move";
    this.action = {
      kind: "move",
      owner: side,
      age: 0,
      duration: MOVE_DISTANCE / MOVE_SPEED + 0.1,
      startHp: t.hp,
      amount: 0,
      direction,
      distance: 0,
    };
    this.phase = "action";
    this.events.push({ type: "move", x: t.x, y: t.y, side });
    return true;
  }
  canRequestAir(kind: AirKind, side: Side = "player") {
    return (
      this.canAct(side) &&
      !this.tankFor(side).mobility.input &&
      this.allowedSupports.includes(kind) &&
      (side === "player" ||
        !this.config.enemySupports ||
        this.config.enemySupports.includes(kind)) &&
      this.tankFor(side).airRemaining > 0 &&
      this.tankFor(side).support[kind] > 0 &&
      !this.pendingAir &&
      !this.air
    );
  }
  selectAir(kind: AirKind) {
    if (!this.canRequestAir(kind)) return false;
    this.airSelection = kind;
    this.airTarget = null;
    return true;
  }
  setAirTarget(x: number) {
    if (this.phase !== "aim" || !this.airSelection || !Number.isFinite(x))
      return false;
    this.airTarget = clamp(x, 35, WIDTH - 35);
    return true;
  }
  requestAir(kind: AirKind, x: number, side: Side = "player"): boolean {
    if (!this.canRequestAir(kind, side) || !Number.isFinite(x)) return false;
    const t = this.tankFor(side);
    t.support[kind]--;
    t.airRemaining--;
    this.actionCounts[side][kind]++;
    this.lastAction[side] = kind;
    this.pendingAir = {
      id: ++this.airSequence,
      kind,
      owner: side,
      facing: this.tankFor(side).facing,
      mirrored: this.placement === "right",
      targetX: clamp(x, 35, WIDTH - 35),
      responseStarted: false,
    };
    this.airSelection = null;
    this.airTarget = null;
    this.events.push({ type: "air-call", x, y: 100, side, airKind: kind });
    this.phase = "resolve";
    this.timer = 0.6;
    return true;
  }
  private beginAir() {
    const reserved = this.pendingAir!;
    this.pendingAir = null;
    this.air = makeOperation(reserved);
    this.guardTime = this.config.era === "modern" ? 2.5 : 0;
    this.turn = reserved.owner;
    this.phase = "air";
    this.combat[reserved.owner].shots++;
    this.supportStats[reserved.owner][reserved.kind].shots++;
    this.events.push({
      type: "air-enter",
      x: reserved.targetX,
      y: 120,
      side: reserved.owner,
      airKind: reserved.kind,
    });
  }
  private airImpact(index: number) {
    const a = this.air!,
      point = a.impacts[index];
    if (point.done) return;
    point.done = true;
    const y = ground(this.terrain, point.x),
      weapon = a.kind === "helicopter" ? "drone" : "crater";
    // Bomber damage is one area calculation; its three ground craters never triple the 30 HP cap.
    if (a.kind === "helicopter" || index === 1) {
      for (const t of this.tanks) {
        const distance = Math.abs(
          t.x - (a.kind === "helicopter" ? point.x : a.targetX),
        );
        const amount = this.receiveDamage(
          t,
          airDamage(a.kind, distance),
          a.owner,
        );
        if (!amount) continue;
        t.hp -= amount;
        t.hurt = 0.7;
        this.events.push({
          type: "damage",
          x: t.x,
          y: t.y - 45,
          amount,
          side: t.side,
          weapon,
        });
        if (t.side !== a.owner) {
          this.combat[a.owner].damage += amount;
          this.supportStats[a.owner][a.kind].damage += amount;
          if (!a.enemyHit) {
            a.enemyHit = true;
            this.combat[a.owner].hits++;
            this.supportStats[a.owner][a.kind].hits++;
          }
        }
      }
    }
    if (this.facility && (a.kind === "helicopter" || index === 1)) {
      const f = this.facility;
      const amount = this.damageFacility(
        airDamage(
          a.kind,
          Math.abs(f.x - (a.kind === "helicopter" ? point.x : a.targetX)),
        ),
        a.owner,
      );
      if (amount && f.owner !== a.owner) {
        this.supportStats[a.owner][a.kind].damage += amount;
        if (!a.enemyHit) {
          a.enemyHit = true;
          this.combat[a.owner].hits++;
          this.supportStats[a.owner][a.kind].hits++;
        }
      }
    }
    carve(this.terrain, point.x, y, weapon);
    if (this.facility)
      this.facility.y = facilityY(
        this.convoy ? this.originalTerrain : this.terrain,
        this.facility.x,
        this.facility.width,
        this.facility.height,
      );
    this.terrainRevision++;
    this.events.push({
      type: "explosion",
      x: point.x,
      y,
      weapon,
      airKind: a.kind,
    });
  }
  private expireShield(owner: Side) {
    if (owner === "ai" && this.convoy) {
      this.convoy.shield = false;
      this.convoy.shieldRaw = 0;
    }
    const t = owner === "player" ? this.ai : this.player;
    t.smoke = false;
    t.cover = false;
    if (t.shield) {
      t.shield = false;
      t.shieldRaw = 0;
      this.events.push({
        type: "shield-end",
        x: t.x,
        y: t.y - 20,
        side: t.side,
      });
    }
  }
  private receiveDamage(
    t: Tank,
    raw: number,
    owner: Side,
    weapon?: WeaponId,
  ): number {
    if (t.hp <= 0 || (this.config.training && t.side === "player")) return 0;
    if (t.side !== owner) {
      const armor =
        t.side === "ai"
          ? this.boss
            ? this.boss.phase === 1
              ? 0.45
              : 0
            : this.convoy
              ? WAVES[this.convoy.wave].armor
              : this.fortified
                ? 0.55
                : this.config.armor
          : 0;
      raw = Math.round(
        raw *
          (weapon === "ap" ? 1 : 1 - armor) *
          (t.cover ? (weapon === "ap" ? 0.85 : 0.65) : 1),
      );
    }
    const blocked = shieldDamage(
      raw,
      t.shieldRaw,
      t.shield && t.side !== owner,
    );
    if (t.shield && t.side !== owner) t.shieldRaw = blocked.total;
    if (blocked.absorbed > 0)
      this.events.push({
        type: "block",
        x: t.x,
        y: t.y - 70,
        side: t.side,
        amount: blocked.absorbed,
      });
    return Math.min(
      t.side === "ai" && this.fortified ? Math.max(0, t.hp - 40) : t.hp,
      blocked.amount,
    );
  }
  aim(angle: number, power: number) {
    if (this.phase !== "aim") return;
    this.player.angle = clamp(
      this.trainingLesson === 1 ? this.trainingLock : angle,
      10,
      80,
    );
    this.player.power = clamp(
      this.trainingLesson === 2 ? this.trainingLock : power,
      20,
      100,
    );
  }
  select(weapon: WeaponId) {
    if (
      this.phase === "aim" &&
      this.allowedWeapons.includes(weapon) &&
      this.player.ammo[weapon] > 0
    ) {
      if (weapon !== this.weapon) this.target = null;
      this.weapon = weapon;
      this.airSelection = null;
      this.airTarget = null;
    }
  }
  lockTarget(side: TargetId): boolean {
    if (
      this.phase !== "aim" ||
      this.weapon !== "missile" ||
      !(
        (side === "ai" && this.ai.hp > 0) ||
        (side === "objective" &&
          this.facility?.owner === "ai" &&
          this.facility.hp > 0)
      )
    )
      return false;
    this.target = side;
    this.selectedTarget = side;
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
      this.collisionTargets.find(
        (t) => t.hp > 0 && t.side !== d.owner && hitsTarget(d, t),
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
      this.tankFor(side).hp > 0 &&
      this.config.era === "modern" &&
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
      this.canAct("player") &&
      (this.weapon !== "missile" || this.target !== null) &&
      this.shoot(this.player, this.weapon)
    );
  }
  private shoot(tank: Tank, weapon: WeaponId): boolean {
    if (
      !!this.scene ||
      !!this.convoy?.moving ||
      tank.mobility.input !== 0 ||
      tank.mobility.speed > 0 ||
      !this.allowedWeapons.includes(weapon) ||
      this.projectile ||
      this.drone ||
      tank.ammo[weapon] <= 0 ||
      this.result
    )
      return false;
    this.updateFacing();
    const enemy = tank.side === "player" ? this.ai : this.player;
    if (enemy.smoke) {
      tank.angle = clamp(tank.angle + (this.random() - 0.5) * 8, 10, 80);
      tank.power = clamp(tank.power + (this.random() - 0.5) * 10, 20, 100);
    }
    if (tank.side === "player")
      this.pendingShot = {
        weapon,
        angle: tank.angle,
        power: tank.power,
        wind: this.wind,
        source: { x: tank.x, y: tank.y },
        muzzle: { ...muzzle(tank) },
        target: {
          x: this.targetBody.x,
          y: this.targetBody.y,
          side: this.targetBody.side,
        },
      };
    tank.ammo[weapon]--;
    this.turn = tank.side;
    this.lastAction[tank.side] = weapon;
    this.combat[tank.side].shots++;
    if (tank.side === "player" && this.trainingStats)
      this.trainingStats.shots++;
    this.telemetry[tank.side][weapon].shots++;
    this.droneInput = { x: 0, y: 0 };
    if (weapon === "drone" || weapon === "missile") {
      this.phase = "deploy";
      const willDefend =
        tank.side === "player" &&
        this.ai.hp > 0 &&
        this.ai.emp > 0 &&
        this.random() < AI_PROFILE[this.difficulty].emp;
      this.defense = {
        owner: tank.side,
        remaining: EMP_WINDOW,
        used: false,
        reactionAt: willDefend ? 0.65 + this.random() * 1.05 : null,
      };
      if (weapon === "drone") {
        const target =
          tank.side === "player" ? this.targetBody : this.aiTargetBody;
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
          tank.side === "player" ? this.target! : this.aiAttackTarget;
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
      this.guardTime =
        this.config.era === "modern" && !this.config.training ? 2.5 : 0;
    }
    tank.recoil = 1;
    this.events.push({
      type: "shot",
      ...muzzle(tank),
      weapon,
      side: tank.side,
      angle: tank.angle,
      facing: tank.facing,
    });
    return true;
  }
  private finishAttack(hit: Impact | null, weapon: WeaponId, owner: Side) {
    const impactVy = this.projectile?.vy ?? this.drone?.vy ?? 0;
    const previousHits = this.stats.hits;
    this.lastImpact[owner] = hit;
    if (owner === "ai" && weapon !== "drone" && weapon !== "missile" && hit)
      (this.aiAttackTarget === "objective"
        ? this.facilityAimMemory
        : this.aiMemory
      ).lastMiss = hit.x - this.aiTargetBody.x;
    this.projectile = null;
    this.drone = null;
    this.defense = null;
    this.droneInput = { x: 0, y: 0 };
    const bossHp = this.ai.hp;
    if (hit && !hit.escaped) this.explode(hit, weapon, owner);
    if (
      this.boss &&
      owner === "player" &&
      this.ai.hp < bossHp &&
      this.boss.phase === 1
    ) {
      this.boss.hits++;
      this.boss.plates = Math.max(0, 3 - this.boss.hits);
    }
    if (owner === "player" && this.pendingShot) {
      const s = this.pendingShot;
      const record: ShotRecord = {
        ...s,
        sequence: this.stats.shots,
        impact: hit ? { ...hit } : null,
        hit: this.stats.hits > previousHits,
        escaped: !!hit?.escaped,
        kind:
          weapon === "drone"
            ? "drone"
            : weapon === "missile"
              ? "missile"
              : "ballistic",
        reason: analyzeImpact(s, hit, impactVy),
        error:
          hit && !hit.escaped
            ? Math.hypot(hit.x - s.target.x, hit.y - (s.target.y - 8))
            : null,
      };
      const records =
        record.kind === "ballistic" ? this.shotHistory : this.specialHistory;
      records.unshift(record);
      records.splice(3);
      if (this.trainingStats) countTraining(this.trainingStats, record);
      this.pendingShot = null;
    }
    this.expireShield(owner);
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
    if (this.tickOperation()) return;
    if (this.facility) {
      this.facility.y = facilityY(
        this.convoy ? this.originalTerrain : this.terrain,
        this.facility.x,
        this.facility.width,
        this.facility.height,
      );
      this.facility.hurt = Math.max(0, this.facility.hurt - STEP * 2);
      if (this.facility.hp <= 0) this.facility.destroyedAge += STEP;
    }
    for (const tank of this.tanks)
      tank.mobility.dust = Math.max(0, tank.mobility.dust - STEP);
    if (
      this.canShield("ai") &&
      this.isReaction("ai") &&
      this.ai.hp <= 60 &&
      this.round % 2 === 0
    )
      this.activateShield("ai");
    if (
      this.guardTime > 0 &&
      (this.phase === "flight" || this.phase === "air")
    ) {
      this.guardTime = Math.max(0, this.guardTime - STEP);
      return;
    }
    for (const tank of this.tanks) {
      if (!this.canAct(tank.side)) this.adjust(0, tank.side);
      this.drive(tank);
      if (tank.mobility.speed > 0) tank.mobility.dust = 0.45;
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
    this.updateFacing();
    if (this.phase === "action" && this.action) {
      const a = this.action,
        t = this.tankFor(a.owner);
      a.age += STEP;
      if (a.kind === "repair")
        t.hp =
          a.startHp + Math.round(a.amount * Math.min(1, a.age / a.duration));
      if (a.kind === "move") {
        const step = Math.min(MOVE_SPEED * STEP, MOVE_DISTANCE - a.distance);
        if (
          step > 0 &&
          !this.pathBlock(t.x, t.x + a.direction * step, a.owner)
        ) {
          t.x += a.direction * step;
          t.mobility.travel += a.direction * step;
          t.mobility.dust = 0.45;
          a.distance += step;
          // The suspension follows existing ground support, never a teleport to a destination.
          t.y = Math.min(t.y, support(this.terrain, t.x));
        } else a.age = a.duration;
      }
      if (a.age >= a.duration) {
        this.action = null;
        this.phase = "resolve";
        this.timer = 0.25;
      }
    } else if (this.phase === "air" && this.air) {
      const a = this.air;
      a.age += STEP;
      a.impacts.forEach((p, i) => {
        if (!p.done && a.age >= p.time) this.airImpact(i);
      });
      if (a.age >= AIR[a.kind].duration) {
        if (this.boss?.phase === 1 && a.owner === "player" && a.enemyHit) {
          this.boss.hits++;
          this.boss.plates = Math.max(0, 3 - this.boss.hits);
        }
        this.expireShield(a.owner);
        this.air = null;
        this.resumeAfterAir = a.owner;
        this.phase = "resolve";
        this.timer = 0.6;
      }
    } else if (this.phase === "deploy" && this.defense) {
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
        this.collisionTargets.filter((t) => t.side !== d.owner),
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
        const direct = hitsTarget(d, this.aiTargetBody)
          ? this.aiAttackTarget
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
            ? advanceMissile(p, this.terrain, this.collisionTargets, this.wind)
            : advance(p, this.terrain, this.collisionTargets, this.wind);
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
      if (this.aiAdjustment > 0) {
        if (this.ai.mobility.input && this.aiAdjustment > 0.001) return;
        this.aiAdjustment = 0;
        this.adjust(0, "ai");
        this.aimAI();
        this.timer = 0.8;
      } else if (this.ai.mobility.input) {
        this.adjust(0, "ai");
        this.aimAI();
        this.timer = 0.8;
      }
      this.timer -= STEP;
      if (this.aiAction && this.timer <= 0) {
        const a = this.aiAction;
        this.aiAction = null;
        const ok =
          a.kind === "smoke" || a.kind === "cover"
            ? this.fieldDefense(a.kind, "ai")
            : a.kind === "repair"
              ? this.repair("ai")
              : a.kind === "shield"
                ? this.activateShield("ai")
                : a.kind === "move"
                  ? this.move(a.direction, "ai")
                  : this.requestAir(a.kind, a.targetX, "ai");
        if (!ok) this.shoot(this.ai, "shell");
      } else if (this.aiPlan) {
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
    if (
      this.config.fortified &&
      owner === "player" &&
      weapon === "ap" &&
      hit.direct === "ai"
    )
      this.breachHits++;
    let enemyHit = false;
    for (const t of this.tanks) {
      const distance = Math.hypot(t.x - hit.x, t.y - 8 - hit.y),
        direct = hit.direct === t.side;
      const amount = this.receiveDamage(
        t,
        blastDamage(distance, weapon, direct),
        owner,
        weapon,
      );
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
      if (!this.config.training)
        t.vx +=
          Math.sign(t.x - hit.x || this.tankFor(owner).facing) * force * 5;
    }
    if (this.facility && this.facility.hp > 0) {
      const f = this.facility,
        direct = hit.direct === "objective";
      const amount = this.damageFacility(
        blastDamage(Math.hypot(f.x - hit.x, f.y - 8 - hit.y), weapon, direct),
        owner,
        weapon,
      );
      if (amount && f.owner !== owner) {
        enemyHit = true;
        if (direct) {
          this.combat[owner].direct++;
          this.telemetry[owner][weapon].direct++;
        }
      }
    }
    if (enemyHit) {
      this.combat[owner].hits++;
      this.telemetry[owner][weapon].hits++;
    }
    carve(this.terrain, hit.x, hit.y, weapon);
    this.terrainRevision++;
    if (this.facility)
      this.facility.y = facilityY(
        this.convoy ? this.originalTerrain : this.terrain,
        this.facility.x,
        this.facility.width,
        this.facility.height,
      );
    this.events.push({
      type: "explosion",
      x: hit.x,
      y: hit.y,
      weapon,
      direct: hit.direct !== null,
    });
  }
  private nextTurn(skipCycle = false) {
    if (this.config.training) {
      for (const t of this.tanks) {
        t.hp = 100;
        t.vx = 0;
      }
      this.turn = "player";
      this.phase = "aim";
      this.round++;
      this.guardTime = 0;
      this.player.mobility.remaining = SHORT_DISTANCE;
      this.player.mobility.used = false;
      this.player.mobility.reason = "";
      return;
    }
    if (this.ai.hp <= 0 && this.pendingAir?.owner === "ai")
      this.pendingAir = null;
    const cycleEnded =
      (skipCycle && !!this.convoy) ||
      (!this.pendingAir &&
        ((this.turn === "ai" && this.resumeAfterAir !== "ai") ||
          this.resumeAfterAir === "player" ||
          (this.ai.hp <= 0 && this.turn === "player")));
    if (this.config.objective && cycleEnded && !skipCycle)
      this.completedRounds++;
    if (this.advanceOperation(cycleEnded, skipCycle)) return;
    const missionVerdict = this.convoy
      ? escortVerdict(
          this.player.hp,
          this.facility!.hp,
          this.convoy.checkpoint,
          this.completedRounds,
          this.config.objective!.rounds,
        )
      : this.boss
        ? this.player.hp <= 0
          ? {
              outcome: "defeat" as Outcome,
              reason: "player-lost" as MissionReason,
            }
          : this.ai.hp <= 0
            ? {
                outcome: "victory" as Outcome,
                reason: "boss-destroyed" as MissionReason,
              }
            : this.round >= this.config.boss!.rounds && cycleEnded
              ? {
                  outcome: "defeat" as Outcome,
                  reason: "time-limit" as MissionReason,
                }
              : null
        : this.config.objective
          ? objectiveVerdict(
              this.config.objective,
              this.player.hp,
              this.ai.hp,
              this.facility,
              this.completedRounds,
              this.allowedWeapons.some((w) => this.player.ammo[w] > 0) ||
                this.pendingAir?.owner === "player",
            )
          : null;
    const outcome =
      this.config.objective || this.boss
        ? (missionVerdict?.outcome ?? null)
        : (judge(this.player.hp, this.ai.hp) ??
          (this.round >= 40 &&
          (this.turn === "ai" || this.resumeAfterAir !== null) &&
          !this.pendingAir
            ? this.config.winCondition === "destroy"
              ? "defeat"
              : this.player.hp === this.ai.hp
                ? "draw"
                : this.player.hp > this.ai.hp
                  ? "victory"
                  : "defeat"
            : null));
    if (outcome) {
      this.phase = "over";
      this.pendingAir = null;
      this.air = null;
      this.action = null;
      this.defense = null;
      this.projectile = null;
      this.drone = null;
      this.airSelection = null;
      this.airTarget = null;
      this.resumeAfterAir = null;
      this.droneInput = { x: 0, y: 0 };
      this.result = {
        ...this.stats,
        assisted: this.assisted,
        missionId: this.config.missionId,
        objective: this.objectiveRecord,
        operation: this.operationRecord,
        reason: missionVerdict?.reason,
        round: this.config.objective
          ? Math.min(
              this.completedRounds + (cycleEnded ? 0 : 1),
              this.config.objective.rounds,
            )
          : this.round,
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
    if (
      this.pendingAir?.responseStarted &&
      this.turn !== this.pendingAir.owner
    ) {
      this.beginAir();
      return;
    }
    if (this.pendingAir?.owner === "player" && this.ai.hp <= 0) {
      this.beginAir();
      return;
    }
    if (this.pendingAir) this.pendingAir.responseStarted = true;
    const next =
      this.ai.hp <= 0 || this.convoy?.newWave
        ? "player"
        : (this.resumeAfterAir ?? (this.turn === "player" ? "ai" : "player"));
    this.resumeAfterAir = null;
    if (this.convoy) this.convoy.newWave = false;
    for (const t of this.tanks) this.adjust(0, t.side);
    this.aiAdjustment = 0;
    if (!(this.pendingAir?.responseStarted && this.pendingAir.owner !== next)) {
      const m = this.tankFor(next).mobility;
      m.remaining = SHORT_DISTANCE;
      m.used = false;
      m.reason = "";
    }
    if (next === "ai") {
      this.turn = "ai";
      this.phase = "ai-aim";
      this.timer = this.config.objective ? 1.3 : 0.8;
      this.aiPlan = null;
      if (this.config.objective?.type === "defend" && this.facility?.hp) {
        const probability =
          this.difficulty === "easy"
            ? 0.35
            : this.difficulty === "hard"
              ? 0.65
              : 0.5;
        this.aiAttackTarget =
          this.completedRounds === 0
            ? "objective"
            : this.completedRounds === 1
              ? "player"
              : this.mobilityRandom() <
                  probability +
                    (this.facility.hp < 30 ? 0.1 : 0) -
                    (this.player.hp < 30 ? 0.15 : 0)
                ? "objective"
                : "player";
      } else if (this.convoy && this.facility!.hp > 0) {
        this.aiAttackTarget =
          this.convoy.wave === 0
            ? "player"
            : this.convoy.wave === 1
              ? "objective"
              : this.mobilityRandom() <
                  (this.difficulty === "easy"
                    ? 0.35
                    : this.difficulty === "hard"
                      ? 0.65
                      : 0.5)
                ? "objective"
                : "player";
      } else this.aiAttackTarget = "player";
      this.aiAction = this.boss ? null : chooseTactic(this);
      if (
        this.boss?.phase === 3 &&
        !this.boss.finalAttackUsed &&
        !this.pendingAir &&
        this.ai.support.bomber > 0 &&
        this.ai.airRemaining > 0
      ) {
        this.boss.finalAttackUsed = true;
        this.boss.announced = "폭격 지원";
        this.boss.warning =
          "⚠ 폭격 1회 요청 · 표시된 구역에서 이동하거나 방어막으로 대응";
        this.aiAction = { kind: "bomber", targetX: this.player.x };
        this.timer = 1.8;
      }
      if (this.aiAction) return;
      let tacticalWeapon = chooseArsenal(
        this.ai,
        this.player,
        this.terrain,
        this.difficulty,
        this.random,
      );
      if (this.config.era === "ww2")
        tacticalWeapon =
          this.ai.ammo.ap > 0 && this.round % 3 !== 0
            ? "ap"
            : this.ai.ammo.crater > 0 && this.round % 4 === 0
              ? "crater"
              : "shell";
      if (this.config.openingDrone && this.round === 1)
        tacticalWeapon = "drone";
      if (!this.allowedWeapons.includes(tacticalWeapon))
        tacticalWeapon = this.allowedWeapons[0];
      if (this.boss) {
        tacticalWeapon =
          this.boss.phase === 1
            ? "shell"
            : this.ai.ammo.missile > 0
              ? "missile"
              : this.ai.ammo.drone > 0
                ? "drone"
                : this.boss.phase === 3 && this.ai.ammo.crater > 0
                  ? "crater"
                  : "shell";
        this.boss.announced = WEAPONS[tacticalWeapon].name;
        this.boss.warning =
          "다음 공격: " +
          this.boss.announced +
          (tacticalWeapon === "missile" || tacticalWeapon === "drone"
            ? " · 출격 중 EMP 대응"
            : " · 이동 또는 반응 방어막");
      }
      this.aiWeapon = tacticalWeapon;
      if (!this.planAdjustment()) this.aimAI();
    } else {
      this.turn = "player";
      this.phase = "aim";
      this.round = Math.min(40, this.round + 1);
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
