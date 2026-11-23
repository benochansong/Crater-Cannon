import { describe, it, expect } from "vitest";
import { Battle, STEP, support, launch, planAI, seeded } from "./engine";
import { FREE_BATTLE } from "./eras";
import { MISSIONS } from "./campaign";
import { canTraverse, reachable } from "./movement";
const run = (b: Battle, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) b.update(STEP);
};
function flat(era: "modern" | "ww2" = "modern") {
  const b = new Battle("normal", 31, { ...FREE_BATTLE, era });
  b.terrain.fill(450);
  for (const t of b.tanks) t.y = support(b.terrain, t.x);
  return b;
}
describe("short tactical adjustment", () => {
  it("accelerates, stops immediately on release, and fires from the new muzzle", () => {
    const b = flat(),
      x = b.player.x;
    expect(b.adjust(1)).toBe(true);
    expect(b.fire()).toBe(false);
    run(b, 0.1);
    const first = b.player.x - x;
    run(b, 0.1);
    expect(b.player.x - x - first).toBeGreaterThan(first);
    b.adjust(0);
    const stopped = b.player.x;
    run(b, 0.2);
    expect(b.player.x).toBe(stopped);
    expect(b.player.mobility.speed).toBe(0);
    const muzzle = launch(b.player, "shell");
    expect(b.fire()).toBe(true);
    expect(b.projectile?.x).toBe(muzzle.x);
    expect(b.projectile?.y).toBe(muzzle.y);
  });
  it("charges total round-trip travel and never exceeds 60", () => {
    const b = flat(),
      x = b.player.x;
    b.adjust(1);
    run(b, 0.6);
    b.adjust(0);
    const right = b.player.x - x;
    b.adjust(-1);
    run(b, 2);
    expect(b.player.mobility.remaining).toBe(0);
    expect(right + Math.abs(b.player.x - x - right)).toBeCloseTo(60, 8);
    expect(b.phase).toBe("aim");
    expect(b.fire()).toBe(true);
  });
  it("locks long movement only after actual short movement and preserves attack/ammo", () => {
    const b = flat();
    b.adjust(1);
    b.adjust(0);
    expect(b.canMove(1)).toBe(true);
    b.adjust(1);
    run(b, 0.1);
    b.adjust(0);
    expect(b.canMove(-1)).toBe(false);
    expect(b.move(1)).toBe(false);
    expect(b.player.ammo.crater).toBe(2);
    expect(b.stats.shots).toBe(0);
  });
  it("long movement consumes the turn and rejects short movement and fire", () => {
    const b = flat(),
      x = b.player.x;
    expect(b.move(1)).toBe(true);
    expect(b.adjust(-1)).toBe(false);
    expect(b.fire()).toBe(false);
    run(b, 1.6);
    expect(b.player.x - x).toBeCloseTo(145, 8);
    expect(b.player.mobility.remaining).toBe(60);
  });
  it("resets only at the next normal own turn", () => {
    const b = flat();
    b.adjust(1);
    run(b, 0.3);
    b.adjust(0);
    const remaining = b.player.mobility.remaining;
    b.select("crater");
    b.aim(10, 20);
    expect(b.player.mobility.remaining).toBe(remaining);
    b.fire();
    expect(b.adjust(1)).toBe(false);
    for (let i = 0; i < 2000 && b.phase !== "aim"; i++) b.update(0.1);
    expect(b.phase).toBe("aim");
    expect(b.player.mobility.remaining).toBe(60);
    expect(b.player.mobility.used).toBe(false);
  });
  it("disables short movement during the air response but retains the long response", () => {
    const b = flat();
    b.player.mobility.used = true;
    b.player.mobility.remaining = 25;
    b.turn = "ai";
    b.phase = "ai-aim";
    b.requestAir("bomber", b.player.x, "ai");
    for (let i = 0; i < 50 && String(b.phase) !== "aim"; i++) b.update(0.1);
    expect(b.pendingAir?.responseStarted).toBe(true);
    expect(b.adjust(1)).toBe(false);
    expect(b.player.mobility.remaining).toBe(25);
    expect(b.move(-1)).toBe(true);
    expect(b.fire()).toBe(false);
  });
  it.each([
    "flight",
    "drone",
    "deploy",
    "action",
    "air",
    "resolve",
    "over",
    "ai-aim",
  ] as const)("rejects player movement in %s", (phase) => {
    const b = flat();
    b.phase = phase;
    expect(b.adjust(1)).toBe(false);
  });
  it("honors mission movement restrictions and the fortified enemy", () => {
    const b = new Battle("hard", 31, { ...FREE_BATTLE, movement: false });
    expect(b.adjust(1)).toBe(false);
    const boss = new Battle("hard", 31, MISSIONS[2].config);
    boss.turn = "ai";
    boss.phase = "ai-aim";
    expect(boss.adjust(-1, "ai")).toBe(false);
  });
});
describe("continuous terrain traversal", () => {
  it.each([0, -0.3, 0.3])(
    "follows slope %s without floating or clipping",
    (slope) => {
      const b = flat();
      b.terrain.forEach((_, i) => (b.terrain[i] = 450 + (i - 210) * slope));
      b.player.y = support(b.terrain, b.player.x);
      b.adjust(1);
      for (let i = 0; i < 100; i++) {
        b.update(STEP);
        expect(b.player.y).toBeCloseTo(support(b.terrain, b.player.x), 7);
      }
      expect(b.player.x).toBeGreaterThan(220);
      expect(Math.abs(b.player.tilt)).toBeLessThanOrEqual(0.3);
    },
  );
  it("slows uphill and gives WWII heavier acceleration with the same allowance", () => {
    const uphill = flat(),
      level = flat(),
      old = flat("ww2");
    uphill.terrain.forEach(
      (_, i) => (uphill.terrain[i] = 450 - (i - 210) * 0.5),
    );
    uphill.player.y = support(uphill.terrain, uphill.player.x);
    for (const b of [uphill, level, old]) {
      b.adjust(1);
      run(b, 0.5);
    }
    expect(uphill.player.x).toBeLessThan(level.player.x);
    expect(old.player.x).toBeLessThan(level.player.x);
    run(old, 2);
    expect(old.player.mobility.remaining).toBe(0);
  });
  it("traverses a shallow crater, blocks a deep cliff, and updates the reachable range after deformation", () => {
    const b = flat();
    for (let x = 230; x <= 270; x++)
      b.terrain[x] = 450 + 8 * Math.sin(((x - 230) / 40) * Math.PI);
    expect(canTraverse(b.terrain, 210, 280, 1070)).toBe(true);
    expect(reachable(b.terrain, 210, 60, 1070).right).toBe(270);
    b.terrain.fill(560, 250, 290);
    expect(canTraverse(b.terrain, 210, 280, 1070)).toBe(false);
    expect(b.adjustmentRange().right).toBeLessThan(230);
    b.adjust(1);
    run(b, 2);
    expect(b.player.x).toBeLessThan(230);
    expect(b.player.mobility.reason).not.toBe("");
  });
  it("sweeps large distances across walls, map bounds, and other vehicles", () => {
    const terrain = new Float64Array(1281).fill(450);
    terrain[240] = 300;
    expect(canTraverse(terrain, 210, 270, 1070)).toBe(false);
    terrain.fill(450);
    expect(canTraverse(terrain, 35, 34, 1070)).toBe(false);
    expect(canTraverse(terrain, 1245, 1246, 210)).toBe(false);
    expect(canTraverse(terrain, 210, 500, 300)).toBe(false);
    expect(reachable(terrain, 210, 60, 280).right).toBe(212);
  });
  it("blocks driving while falling, then permits it after settling", () => {
    const b = flat();
    b.player.y -= 30;
    expect(b.adjust(1)).toBe(false);
    run(b, 1);
    expect(b.adjust(1)).toBe(true);
  });
});
describe("AI tactical adjustment", () => {
  it("uses continuous movement and recomputes an imperfect shot once from its final position", () => {
    const b = flat();
    b.turn = "ai";
    b.phase = "ai-aim";
    b.round = 2;
    const internals = b as unknown as {
      mobilityRandom: () => number;
      planAdjustment: () => boolean;
      aiPlan: { angle: number; power: number } | null;
      aiAdjustment: number;
    };
    internals.mobilityRandom = () => 0;
    expect(internals.planAdjustment()).toBe(true);
    const start = b.ai.x;
    run(b, 0.2);
    expect(Math.abs(b.ai.x - start)).toBeGreaterThan(0);
    expect(Math.abs(b.ai.x - start)).toBeLessThan(20);
    for (let i = 0; i < 300 && !internals.aiPlan; i++) b.update(STEP);
    expect(internals.aiPlan).not.toBeNull();
    expect(b.ai.mobility.remaining).toBeGreaterThanOrEqual(0);
    expect(Math.abs(b.ai.x - start)).toBeLessThanOrEqual(60);
    expect(b.aiMemory.shots).toBe(1);
    const pos = b.ai.x;
    for (let i = 0; i < 200 && !b.projectile; i++) b.update(STEP);
    expect(b.projectile).not.toBeNull();
    expect(b.projectile!.x).toBeCloseTo(launch(b.ai, "shell").x, 5);
    expect(b.ai.x).toBe(pos);
    const perfect = planAI(
      b.ai,
      b.player,
      b.terrain,
      b.wind,
      "normal",
      { bias: 0, lastMiss: null, shots: 0 },
      () => 0.5,
    );
    const imperfect = planAI(
      b.ai,
      b.player,
      b.terrain,
      b.wind,
      "normal",
      { bias: 11, lastMiss: null, shots: 0 },
      seeded(12),
    );
    expect(imperfect.power).not.toBe(perfect.power);
  });
});

it("residual knockback cannot add uncharged distance and air cannot be fired while driving", () => {
  const b = flat();
  b.player.vx = 2;
  b.adjust(1);
  run(b, 0.2);
  b.adjust(0);
  expect(b.player.x - 210).toBeCloseTo(60 - b.player.mobility.remaining, 8);
  b.adjust(1);
  expect(b.requestAir("helicopter", b.ai.x)).toBe(false);
});
it("AI movement becomes more frequent with difficulty without altering the combat RNG", () => {
  const counts = [];
  for (const difficulty of ["easy", "normal", "hard"] as const) {
    let count = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const b = new Battle(difficulty, seed);
      b.terrain.fill(450);
      b.ai.y = 433;
      b.round = 2;
      b.turn = "ai";
      b.phase = "ai-aim";
      const untouched = new Battle(difficulty, seed);
      if ((b as unknown as { planAdjustment: () => boolean }).planAdjustment())
        count++;
      expect(b.random()).toBe(untouched.random());
    }
    counts.push(count);
  }
  expect(counts[0]).toBeLessThan(counts[1]);
  expect(counts[1]).toBeLessThan(counts[2]);
});

it("movement dust fades after stopping even in the shield reaction window", () => {
  const b = flat();
  b.adjust(1);
  run(b, 0.3);
  b.adjust(0);
  expect(b.player.mobility.dust).toBeGreaterThan(0);
  b.fire();
  expect(b.guardTime).toBeGreaterThan(0);
  run(b, 0.6);
  expect(b.player.mobility.dust).toBe(0);
});
