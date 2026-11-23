import type { MissionReason } from "./objectives";
import type { Outcome } from "./engine";
export const CONVOY_ROUTE = [120, 220, 350, 490, 650, 810] as const;
export const CONVOY_GATES = [0, 1, 1, 2, 3] as const;
export const WAVES = [
  { name: "선발 정찰 전차", hp: 36, armor: 0, x: 1060, drone: 0, missile: 0 },
  {
    name: "호송로 차단 전차",
    hp: 46,
    armor: 0.08,
    x: 1080,
    drone: 0,
    missile: 0,
  },
  { name: "증원 지휘차량", hp: 60, armor: 0.18, x: 1100, drone: 1, missile: 1 },
] as const;
export interface ConvoyState {
  checkpoint: number;
  wave: number;
  kills: number;
  moving: boolean;
  fromX: number;
  targetX: number;
  travel: number;
  driveTime: number;
  newWave: boolean;
  cleared: boolean;
  shield: boolean;
  shieldRaw: number;
  protectedDamage: number;
  warning: string;
}
export const createConvoy = (): ConvoyState => ({
  checkpoint: 0,
  wave: 0,
  kills: 0,
  moving: false,
  fromX: CONVOY_ROUTE[0],
  targetX: CONVOY_ROUTE[0],
  travel: 0,
  driveTime: 0,
  newWave: false,
  cleared: false,
  shield: false,
  shieldRaw: 0,
  protectedDamage: 0,
  warning: "1구간 주행 준비 · 정찰 전차는 차량을 우선 공격합니다",
});
export interface BossState {
  phase: 1 | 2 | 3;
  plates: number;
  hits: number;
  weakness: number;
  transitions: number[];
  finalAttackUsed: boolean;
  deathShown: boolean;
  warning: string;
  announced: string;
}
export const createBoss = (): BossState => ({
  phase: 1,
  plates: 3,
  hits: 0,
  weakness: 0,
  transitions: [1],
  finalAttackUsed: false,
  deathShown: false,
  warning: "장갑 3회 유효 피격 / 기초 지형 15 파괴 / x≥550 전진 중 하나로 해제",
  announced: "일반 포격",
});
export interface OperationScene {
  kind: "wave" | "boss-intro" | "boss-phase" | "boss-end";
  title: string;
  remaining: number;
  duration: number;
}
export interface OperationRecord {
  type: "escort" | "boss";
  checkpoint: number;
  kills: number;
  wave: number;
  phase: number;
  weakness: number;
  protectedDamage: number;
  defenses: number;
}
export function escortVerdict(
  playerHp: number,
  truckHp: number,
  checkpoint: number,
  rounds: number,
  limit: number,
): { outcome: Outcome; reason: MissionReason } | null {
  if (playerHp <= 0) return { outcome: "defeat", reason: "player-lost" };
  if (truckHp <= 0) return { outcome: "defeat", reason: "convoy-lost" };
  if (checkpoint >= 5) return { outcome: "victory", reason: "escorted" };
  if (rounds >= limit) return { outcome: "defeat", reason: "time-limit" };
  return null;
}
export function nextBossPhase(
  b: BossState,
  hp: number,
  foundationDrop: number,
  playerX: number,
): 1 | 2 | 3 {
  if (b.phase === 3 || hp <= 35) return 3;
  if (
    b.phase === 2 ||
    b.plates <= 0 ||
    hp <= 60 ||
    foundationDrop >= 15 ||
    playerX >= 550
  )
    return 2;
  return 1;
}
