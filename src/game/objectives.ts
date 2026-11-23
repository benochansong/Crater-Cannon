import type { BattleConfig } from "./eras";
import type { BattleResult, Outcome, Side, Vec } from "./engine";
export type TargetId = Side | "objective";
export interface CollisionTarget extends Vec {
  side: TargetId;
  hp: number;
  width?: number;
  height?: number;
}
export interface ObjectiveConfig {
  type: "defend" | "destroy-objective" | "escort";
  kind: "comms" | "radar" | "truck";
  name: string;
  x: number;
  hp: number;
  rounds: number;
}
export interface Facility extends CollisionTarget {
  side: "objective";
  owner: Side;
  kind: "comms" | "radar" | "truck";
  name: string;
  maxHp: number;
  width: number;
  height: number;
  hurt: number;
  destroyedAge: number;
}
export interface ObjectiveRecord {
  type: ObjectiveConfig["type"];
  hp: number;
  maxHp: number;
  completedRounds: number;
  reinforcement: number;
  restored: number;
}
export type MissionReason =
  | "player-lost"
  | "facility-lost"
  | "defended"
  | "target-destroyed"
  | "time-limit"
  | "no-ammo"
  | "convoy-lost"
  | "escorted"
  | "boss-destroyed";
export function facilityY(
  terrain: Float64Array,
  x: number,
  width = 96,
  height = 100,
) {
  let floor = Infinity;
  for (let dx = -width / 2; dx <= width / 2; dx += 2)
    floor = Math.min(
      floor,
      terrain[Math.max(0, Math.min(terrain.length - 1, Math.round(x + dx)))],
    );
  return floor - height / 2 + 8;
}
export function createFacility(
  c: ObjectiveConfig,
  terrain: Float64Array,
): Facility {
  return {
    side: "objective",
    owner: c.type === "destroy-objective" ? "ai" : "player",
    kind: c.kind,
    name: c.name,
    x: c.x,
    y: facilityY(
      terrain,
      c.x,
      c.kind === "truck" ? 90 : 96,
      c.kind === "truck" ? 46 : 100,
    ),
    hp: c.hp,
    maxHp: c.hp,
    width: c.kind === "truck" ? 90 : 96,
    height: c.kind === "truck" ? 46 : 100,
    hurt: 0,
    destroyedAge: 0,
  };
}
export function objectiveVerdict(
  c: ObjectiveConfig,
  playerHp: number,
  enemyHp: number,
  f: Facility | null,
  rounds: number,
  hasAmmo = true,
): { outcome: Outcome; reason: MissionReason } | null {
  if (playerHp <= 0) return { outcome: "defeat", reason: "player-lost" };
  if (!f) return { outcome: "defeat", reason: "facility-lost" };
  if (c.type === "escort") return null; // Checkpoint evidence is evaluated by escortVerdict.
  if (c.type === "defend") {
    if (f.hp <= 0) return { outcome: "defeat", reason: "facility-lost" };
    if (enemyHp <= 0 || rounds >= c.rounds)
      return { outcome: "victory", reason: "defended" };
  } else {
    if (f.hp <= 0) return { outcome: "victory", reason: "target-destroyed" };
    if (rounds >= c.rounds) return { outcome: "defeat", reason: "time-limit" };
    if (!hasAmmo) return { outcome: "defeat", reason: "no-ammo" };
  }
  return null;
}
/** The engine's objective evidence, not the enemy tank's HP alone, authorizes campaign credit. */
export function missionSucceeded(config: BattleConfig, r: BattleResult) {
  if (
    r.outcome !== "victory" ||
    !Number.isFinite(r.hp) ||
    r.hp <= 0 ||
    (r.missionId && r.missionId !== config.missionId)
  )
    return false;
  const c = config.objective,
    o = r.objective;
  if (config.boss)
    return (
      r.missionId === config.missionId &&
      r.enemyHp <= 0 &&
      r.operation?.type === "boss" &&
      r.operation.phase === 3 &&
      (r.round ?? Infinity) <= config.boss.rounds
    );
  if (!c) return r.enemyHp <= 0;
  if (
    !o ||
    r.missionId !== config.missionId ||
    o.type !== c.type ||
    o.maxHp !== c.hp ||
    !Number.isFinite(o.hp) ||
    !Number.isInteger(o.completedRounds) ||
    o.completedRounds < 0 ||
    o.completedRounds > c.rounds ||
    o.hp < 0 ||
    o.hp > c.hp
  )
    return false;
  if (c.type === "escort")
    return (
      o.hp > 0 &&
      r.operation?.type === "escort" &&
      r.operation.checkpoint === 5 &&
      r.operation.kills === 3
    );
  return c.type === "defend"
    ? o.hp > 0 && (r.enemyHp <= 0 || o.completedRounds >= c.rounds)
    : o.hp <= 0 && o.completedRounds <= c.rounds;
}
export const REASON_TEXT: Record<MissionReason, string> = {
  "player-lost": "플레이어 차량이 파괴되었습니다.",
  "facility-lost": "통신시설이 파괴되어 작전에 실패했습니다.",
  defended: "지원부대 도착 · 통신망 유지 성공",
  "target-destroyed": "레이더망 무력화 · 작전 목표 달성",
  "time-limit": "제한 라운드를 넘겼습니다.",
  "no-ammo": "목표를 공격할 수 있는 탄약이 없습니다.",
  "convoy-lost": "보급 차량이 파괴되어 호송 작전에 실패했습니다.",
  escorted: "보급 차량 목적지 도착 · 호송 작전 성공",
  "boss-destroyed": "특수 지휘전차 격파 · 북부 방어선 돌파",
};
