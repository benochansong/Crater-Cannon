export const MOVE_DISTANCE = 145;
export const MOVE_SPEED = 95;
export const SHORT_DISTANCE = 60;
/** Sweep the entire tread path; a large frame must never skip a wall or vehicle. */
export function traverseBlock(
  terrain: Float64Array,
  from: number,
  to: number,
  opponent: number,
  clearance = 68,
): string {
  const at = (x: number) =>
    terrain[Math.max(0, Math.min(terrain.length - 1, Math.round(x)))];
  const count = Math.max(1, Math.ceil(Math.abs(to - from) * 2));
  let previous = from;
  for (let i = 1; i <= count; i++) {
    const x = from + ((to - from) * i) / count;
    if (x < 35 || x > terrain.length - 36) return "전장 경계";
    if (Math.abs(x - opponent) < clearance)
      return "다른 전차가 경로를 막고 있습니다";
    for (const offset of [-22, 0, 22]) {
      const delta = at(x + offset) - at(previous + offset);
      if (delta < -1.8) return "급경사 또는 크레이터 벽";
      if (delta > 1.8) return "가파른 낭떠러지";
    }
    if (Math.abs(at(x + 22) - at(x - 22)) > 35) return "등판 한계를 넘는 경사";
    previous = x;
  }
  return "";
}
export function canTraverse(
  terrain: Float64Array,
  from: number,
  to: number,
  opponent: number,
  clearance = 68,
) {
  return !traverseBlock(terrain, from, to, opponent, clearance);
}
export function reachable(
  terrain: Float64Array,
  from: number,
  budget: number,
  opponent: number,
  clearance = 68,
) {
  const end = (direction: number) => {
    let x = from;
    for (let used = 0; used < budget - 1e-6;) {
      const step = Math.min(0.5, budget - used);
      const next = x + step * direction;
      if (!canTraverse(terrain, x, next, opponent, clearance)) break;
      x = next;
      used += step;
    }
    return x;
  };
  return { left: end(-1), right: end(1) };
}
