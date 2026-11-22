import type { Battle } from "./engine";
import { AIR } from "./airSupport";
import type { AirKind } from "./airSupport";
export type TacticalAction =
  | { kind: "repair" }
  | { kind: "shield" }
  | { kind: "smoke" }
  | { kind: "cover" }
  | { kind: "move"; direction: number }
  | { kind: AirKind; targetX: number };
export function chooseTactic(b: Battle): TacticalAction | null {
  const t = b.ai,
    enemy = b.player,
    pending = b.pendingAir;
  // Keep the opening readable, then consider only resources and the visible announced zone.
  if (b.round === 1 && !pending) return null;
  const skill =
    b.difficulty === "easy" ? 0.3 : b.difficulty === "normal" ? 0.65 : 0.85;
  if (
    pending &&
    pending.owner !== "ai" &&
    Math.abs(t.x - pending.targetX) < AIR[pending.kind].radius + 25 &&
    b.random() < skill
  ) {
    const direction =
      t.x === pending.targetX
        ? t.x > 640
          ? -1
          : 1
        : Math.sign(t.x - pending.targetX);
    if (b.canMove(direction, "ai") && b.random() < 0.58)
      return { kind: "move", direction };
    if (b.canShield("ai")) return { kind: "shield" };
  }
  if (b.config.era === "ww2" && b.round > 1) {
    if (pending && b.canFieldDefense("cover", "ai")) return { kind: "cover" };
    if (b.canRequestAir("artillery", "ai") && b.round >= 3)
      return { kind: "artillery", targetX: enemy.x + (b.random() - 0.5) * 60 };
    if (t.hp < 70 && b.round % 4 === 0 && b.canFieldDefense("smoke", "ai"))
      return { kind: "smoke" };
  }
  if (
    t.hp <= (b.difficulty === "easy" ? 35 : 55) &&
    b.lastAction.ai !== "repair" &&
    b.canRepair("ai") &&
    b.random() < skill
  )
    return { kind: "repair" };
  if (
    !pending &&
    t.hp > 20 &&
    b.random() <
      (b.difficulty === "easy" ? 0.12 : b.difficulty === "normal" ? 0.28 : 0.4)
  ) {
    const terrainY = b.terrain[Math.round(enemy.x)];
    const kind =
      t.support.bomber && terrainY < 540 && b.random() < 0.55
        ? "bomber"
        : "helicopter";
    if (b.canRequestAir(kind, "ai")) {
      const error =
        b.difficulty === "easy" ? 120 : b.difficulty === "normal" ? 70 : 40;
      return { kind, targetX: enemy.x + (b.random() - 0.5) * error };
    }
  }
  if (
    !pending &&
    t.hp < 40 &&
    b.lastAction.ai !== "shield" &&
    b.canShield("ai") &&
    b.random() < skill * 0.18
  )
    return { kind: "shield" };
  return null;
}
