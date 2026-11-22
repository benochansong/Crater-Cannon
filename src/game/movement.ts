export const MOVE_DISTANCE = 145;
export const MOVE_SPEED = 95;
export function canTraverse(
  terrain: Float64Array,
  from: number,
  to: number,
  opponent: number,
): boolean {
  if (to < 35 || to > terrain.length - 36 || Math.abs(to - opponent) < 68)
    return false;
  const direction = Math.sign(to - from),
    leading = direction * 22;
  const at = (x: number) =>
    terrain[Math.max(0, Math.min(terrain.length - 1, Math.round(x)))];
  // Sample the forward tread and center: do not climb a wall or drop through a cliff.
  for (const offset of [0, leading]) {
    const delta = Math.abs(at(to + offset) - at(from + offset));
    if (delta > Math.max(1.8, Math.abs(to - from) * 1.1)) return false;
  }
  return true;
}
