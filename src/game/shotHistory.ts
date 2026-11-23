import type { CollisionTarget } from "./objectives";
import type { Impact, Vec, WeaponId } from "./engine";
export interface ShotSetup {
  weapon: WeaponId;
  angle: number;
  power: number;
  wind: number;
  source: Vec;
  muzzle: Vec;
  target: Pick<CollisionTarget, "x" | "y" | "side">;
}
export type ShotReason =
  | "direct"
  | "near"
  | "short"
  | "long"
  | "terrain"
  | "obstacle"
  | "escape"
  | "disabled";
export interface ShotRecord extends ShotSetup {
  sequence: number;
  impact: Impact | null;
  hit: boolean;
  escaped: boolean;
  kind: "ballistic" | "drone" | "missile";
  reason: ShotReason;
  error: number | null;
}
export function analyzeImpact(
  s: ShotSetup,
  hit: Impact | null,
  vy: number,
): ShotReason {
  if (!hit) return "disabled";
  if (hit.escaped) return "escape";
  if (hit.direct === s.target.side) return "direct";
  if (hit.direct) return "obstacle";
  if (Math.hypot(hit.x - s.target.x, hit.y - (s.target.y - 8)) < 65)
    return "near";
  const direction = Math.sign(s.target.x - s.source.x) || 1;
  if (
    (hit.x - s.target.x) * direction < 0 &&
    (vy < 0 || hit.y < s.target.y - 45)
  )
    return "terrain";
  return (hit.x - s.target.x) * direction < 0 ? "short" : "long";
}
export function shotMessage(reason: ShotReason, delta?: number) {
  const distance = delta === undefined ? "" : Math.round(Math.abs(delta)) + " ";
  return {
    direct: "DIRECT HIT! · 정확한 포격입니다.",
    near: "목표에 근접했습니다!",
    short: "목표보다 " + distance + "짧게 착탄 · 세기와 각도를 조절하세요.",
    long: "목표보다 " + distance + "멀리 착탄 · 세기와 각도를 조절하세요.",
    terrain: "⚠ 지형에 의해 차단 · 높이와 발사 방향을 확인하세요.",
    obstacle: "⚠ 다른 차량 또는 시설에 차단되었습니다.",
    escape: "전장 밖으로 이탈 · 각도와 세기를 조절하세요.",
    disabled: "비행 종료 · 착탄 없음",
  }[reason];
}
