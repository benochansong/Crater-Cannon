export type Facing = 1 | -1;
export type PlayerPlacement = "left" | "right";
// Independent integer hash: choosing a side never advances terrain/combat RNG.
export function choosePlayerSide(seed: number): PlayerPlacement {
  let n = (seed ^ 4) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0 < 0x80000000 ? "left" : "right";
}
export function facingTarget(x: number, targetX: number): Facing {
  return targetX < x ? -1 : 1;
}
export function mirrorTerrain(terrain: Float64Array) {
  return terrain.slice().reverse();
}
export function gunRotation(angle: number, facing: Facing) {
  return ((facing === 1 ? -angle : 180 + angle) * Math.PI) / 180;
}
