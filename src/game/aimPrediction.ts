import { launch, advance, advanceMissile, STEP } from "./engine";
import type { Battle, Impact, Vec } from "./engine";
import { analyzeImpact } from "./shotHistory";
import type { ShotReason, ShotSetup } from "./shotHistory";
export type AimGuideMode = "default" | "off" | "extended";
export type GuideLevel = "full" | "partial" | "short" | "off";
export function guideLevel(
  b: Pick<Battle, "difficulty">,
  mode: AimGuideMode,
): GuideLevel {
  return mode === "off"
    ? "off"
    : mode === "extended" || b.difficulty === "easy"
      ? "full"
      : b.difficulty === "normal"
        ? "partial"
        : "short";
}
export interface AimPrediction {
  points: Vec[];
  impact: Impact | null;
  apex: Vec;
  range: number | null;
  reason: ShotReason | null;
  uncertain: boolean;
  special: boolean;
  steps: number;
  setup: ShotSetup;
}
// Only the fresh projectile is mutated. These are the actual collision/integration functions.
export function predictAim(b: Battle, short = false): AimPrediction | null {
  if (b.weapon === "drone") return null;
  const p = launch(b.player, b.weapon),
    special = b.weapon === "missile";
  if (special) {
    p.guided = true;
    p.target = b.target ?? b.selectedTarget;
  }
  const setup: ShotSetup = {
    weapon: b.weapon,
    angle: b.player.angle,
    power: b.player.power,
    wind: b.wind,
    source: { x: b.player.x, y: b.player.y },
    muzzle: { x: p.x, y: p.y },
    target: { x: b.targetBody.x, y: b.targetBody.y, side: b.targetBody.side },
  };
  const points: Vec[] = [{ x: p.x, y: p.y }];
  let impact: Impact | null = null,
    apex = { ...points[0] },
    steps = 0;
  const targets = b.collisionTargets;
  const limit = short || special ? 75 : Math.ceil(12 / STEP) + 1;
  for (; steps < limit; steps++) {
    impact = special
      ? advanceMissile(p, b.terrain, targets, b.wind, STEP)
      : advance(p, b.terrain, targets, b.wind, STEP);
    if (p.y < apex.y) apex = { x: p.x, y: p.y };
    if (steps % 8 === 0 || impact || steps === limit - 1)
      points.push({ x: p.x, y: p.y });
    if (impact) {
      steps++;
      break;
    }
  }
  return {
    points,
    impact: special || short ? null : impact,
    apex,
    range:
      impact && !special && !short ? Math.abs(impact.x - setup.source.x) : null,
    reason:
      impact && !special && !short ? analyzeImpact(setup, impact, p.vy) : null,
    uncertain: !!b.ai.smoke,
    special,
    steps,
    setup,
  };
}
export class PredictionCache {
  private battle: Battle | null = null;
  private key = "";
  value: AimPrediction | null = null;
  calculations = 0;
  get(b: Battle, mode: AimGuideMode = "default") {
    const level = guideLevel(b, mode);
    if (level === "off" || b.weapon === "drone" || b.airSelection) {
      this.key = "";
      this.value = null;
      return null;
    }
    const key = [
      level,
      b.weapon,
      b.player.x,
      b.player.y,
      b.player.angle,
      b.player.power,
      b.wind,
      b.terrainRevision,
      b.target,
      b.selectedTarget,
      b.ai.smoke,
      ...b.collisionTargets.flatMap((t) => [
        t.side,
        t.x,
        t.y,
        t.hp,
        t.width,
        t.height,
      ]),
    ].join("|");
    if (this.battle !== b || this.key !== key) {
      this.battle = b;
      this.key = key;
      this.value = predictAim(b, level === "short");
      this.calculations++;
    }
    return this.value;
  }
}
