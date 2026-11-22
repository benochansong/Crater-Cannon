import { describe, it, expect } from "vitest";
import {
  Battle,
  STEP,
  EMP_WINDOW,
  DRONE_TIME,
  WIDTH,
  WEAPONS,
  AI_PROFILE,
  advance,
  advanceMissile,
  launch,
  planAI,
  chooseArsenal,
  seeded,
  support,
  solveShot,
} from "./engine";
import type { Difficulty, WeaponId } from "./engine";
function run(b: Battle, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) b.update(STEP);
}
function playerDrone(seed = 44) {
  const b = new Battle("easy", seed);
  b.ai.emp = 0;
  b.select("drone");
  expect(b.fire()).toBe(true);
  return b;
}
function enemyAttack(b: Battle, weapon: WeaponId) {
  // Enter an opponent turn at its public boundary, with an explicitly known test plan.
  b.turn = "ai";
  b.phase = "ai-aim";
  b.timer = 0;
  (b as unknown as { aiPlan: unknown }).aiPlan = {
    angle: 45,
    power: 55,
    weapon,
  };
  b.update(STEP);
}
describe("directly controlled drone", () => {
  it("deploys from the tank and reserves a full response window before five-second control", () => {
    const b = playerDrone();
    expect(b.phase).toBe("deploy");
    expect(b.drone!.x).toBe(b.player.x);
    expect(b.player.ammo.drone).toBe(1);
    run(b, 2.1);
    expect(b.phase).toBe("deploy");
    expect(b.drone!.age).toBe(0);
    run(b, 0.31);
    expect(b.phase).toBe("drone");
  });
  it("moves continuously with input while tanks stay still, and locks other attacks", () => {
    const b = playerDrone();
    run(b, EMP_WINDOW + 0.02);
    const x = b.drone!.x,
      tx = b.player.x,
      ty = b.player.y;
    b.player.vx = 100;
    b.steerDrone(1, -1);
    run(b, 0.5);
    expect(b.drone!.x).toBeGreaterThan(x + 50);
    expect(b.drone!.y).toBeLessThan(210);
    expect(b.player.x).toBe(tx);
    expect(b.player.y).toBe(ty);
    expect(b.fire()).toBe(false);
    b.select("shell");
    expect(b.weapon).toBe("drone");
  });
  it("expires without damage and moves to the next turn", () => {
    const b = playerDrone();
    run(b, EMP_WINDOW + DRONE_TIME + 0.05);
    expect(b.drone).toBeNull();
    expect(b.ai.hp).toBe(100);
    expect(b.phase).toBe("resolve");
    run(b, 0.5);
    expect(b.turn).toBe("ai");
  });
  it("attacks once at the selected position, records actual damage, then clears input", () => {
    const b = playerDrone();
    run(b, EMP_WINDOW + 0.02);
    b.drone!.x = b.ai.x;
    b.drone!.y = b.ai.y - 8;
    expect(b.attackDrone()).toBe(true);
    expect(b.attackDrone()).toBe(false);
    expect(b.ai.hp).toBe(78);
    expect(b.stats.damage).toBe(22);
    expect(b.telemetry.player.drone.shots).toBe(1);
    expect(b.droneInput).toEqual({ x: 0, y: 0 });
    expect(b.events.filter((e) => e.type === "explosion")).toHaveLength(1);
  });
  it("sweeps into terrain instead of flying through it", () => {
    const b = playerDrone();
    run(b, EMP_WINDOW + 0.02);
    b.drone!.y = support(b.terrain, b.drone!.x) - 10;
    b.steerDrone(0, 1);
    run(b, 0.4);
    expect(b.drone).toBeNull();
    expect(b.terrainRevision).toBe(1);
  });
});
describe("limited guided missile", () => {
  it("requires an enemy target and uses exactly one missile", () => {
    const b = new Battle();
    b.select("missile");
    expect(b.fire()).toBe(false);
    expect(b.player.ammo.missile).toBe(2);
    expect(b.lockTarget("player")).toBe(false);
    expect(b.lockTarget("ai")).toBe(true);
    expect(b.fire()).toBe(true);
    expect(b.player.ammo.missile).toBe(1);
    expect(b.projectile!.target).toBe("ai");
    expect(b.fire()).toBe(false);
  });
  it.each([false, true])(
    "resolves actual missile damage even when jammed=%s",
    (jammed) => {
      const b = new Battle("easy", 44);
      b.select("missile");
      b.lockTarget("ai");
      const aim = jammed
        ? solveShot(b.player, b.ai, b.terrain, b.wind)
        : { angle: 35, power: 55 };
      b.aim(aim.angle, aim.power);
      expect(b.fire()).toBe(true);
      // A deterministic defender decision: neither test alters flight or impact state.
      b.defense!.reactionAt = null;
      if (jammed) expect(b.useEmp("ai")).toBe(true);
      for (let i = 0; i < 2400 && b.phase !== "resolve"; i++) b.update(STEP);
      expect(b.phase).toBe("resolve");
      expect(b.ai.hp).toBe(80);
      expect(b.telemetry.player.missile).toEqual({
        shots: 1,
        hits: 1,
        direct: 1,
        damage: 20,
      });
      expect(b.projectile).toBeNull();
    },
  );
  it("turns at a bounded rate and stops tracking after 3.2 seconds", () => {
    const b = new Battle();
    const p = launch(b.player, "missile");
    p.guided = true;
    p.target = "ai";
    const h = Math.atan2(p.vy, p.vx);
    advanceMissile(p, b.terrain, b.tanks, b.wind);
    const changed = Math.atan2(p.vy, p.vx) - h;
    expect(Math.abs(changed)).toBeLessThanOrEqual(0.85 * STEP + 1e-9);
    expect(changed).toBeGreaterThan(0);
    p.flightAge = 3.3;
    const vx = p.vx,
      vy = p.vy;
    advanceMissile(p, b.terrain, b.tanks, b.wind);
    expect(p.vx).toBe(vx);
    expect(p.vy).toBe(vy);
  });
  it("still collides with terrain and does not teleport to its target", () => {
    const b = new Battle();
    const p = launch(b.player, "missile");
    p.x = 600;
    p.y = 500;
    p.vx = 0;
    p.vy = 200;
    p.guided = true;
    p.target = "ai";
    const t = new Float64Array(WIDTH + 1).fill(500);
    expect(advanceMissile(p, t, b.tanks, 0)?.direct).toBeNull();
    expect(Math.abs(p.x - 600)).toBeLessThan(2);
  });
  it("a jammed missile keeps its velocity and uses the shared unguided physics", () => {
    const b = new Battle();
    enemyAttack(b, "missile");
    const before = { ...b.projectile!, trail: [] };
    expect(b.useEmp("player")).toBe(true);
    expect(b.projectile!.guided).toBe(false);
    expect(b.projectile!.vx).toBe(before.vx);
    expect(b.projectile!.vy).toBe(before.vy);
    const p = { ...b.projectile!, trail: [] },
      q = { ...p, trail: [] };
    advanceMissile(p, b.terrain, b.tanks, b.wind);
    advance(q, b.terrain, b.tanks, b.wind);
    expect(p.x).toBe(q.x);
    expect(p.y).toBe(q.y);
  });
});
describe("fair EMP reaction", () => {
  it("offers at least two seconds and cannot affect regular shells", () => {
    const b = new Battle();
    b.fire();
    expect(b.canEmp("player")).toBe(false);
    expect(b.useEmp("ai")).toBe(false);
    expect(b.ai.emp).toBe(2);
    const c = new Battle();
    enemyAttack(c, "missile");
    run(c, 2);
    expect(c.canEmp("player")).toBe(true);
    run(c, 0.5);
    expect(c.canEmp("player")).toBe(false);
    expect(c.useEmp("player")).toBe(false);
  });
  it("disables drone damage, spends one charge and never consumes an attack turn", () => {
    const b = new Battle();
    enemyAttack(b, "drone");
    expect(b.useEmp("player")).toBe(true);
    expect(b.useEmp("player")).toBe(false);
    expect(b.player.emp).toBe(1);
    expect(b.drone).toBeNull();
    expect(b.player.hp).toBe(100);
    expect(b.stats.shots).toBe(0);
    run(b, 0.5);
    expect(b.phase).toBe("aim");
    expect(b.round).toBe(2);
  });
  it("enforces exactly two defenses across separate attacks", () => {
    const b = new Battle();
    for (let i = 0; i < 2; i++) {
      enemyAttack(b, "drone");
      expect(b.useEmp("player")).toBe(true);
      run(b, 0.5);
    }
    enemyAttack(b, "missile");
    expect(b.player.emp).toBe(0);
    expect(b.useEmp("player")).toBe(false);
  });
  it("AI uses the same response rules after a visible delay", () => {
    const b = playerDrone();
    b.ai.emp = 2;
    b.defense!.reactionAt = 0.8;
    run(b, 0.5);
    expect(b.ai.emp).toBe(2);
    run(b, 0.4);
    expect(b.ai.emp).toBe(1);
    expect(b.drone).toBeNull();
    expect(b.stats.damage).toBe(0);
  });
  it("optional automatic defense reacts at 0.9 seconds and respects ammo", () => {
    const b = new Battle();
    b.autoEmp = true;
    enemyAttack(b, "drone");
    run(b, 0.6);
    expect(b.player.emp).toBe(2);
    run(b, 0.4);
    expect(b.player.emp).toBe(1);
    expect(b.drone).toBeNull();
  });
});
describe("AI estimation and arsenal limits", () => {
  it("uses larger first-shot error for lower difficulty", () => {
    expect(AI_PROFILE.easy.initialBias).toBeGreaterThan(
      AI_PROFILE.normal.initialBias,
    );
    expect(AI_PROFILE.normal.initialBias).toBeGreaterThan(
      AI_PROFILE.hard.initialBias,
    );
    const b = new Battle();
    const memory = { bias: -10, shots: 1, lastMiss: 120 };
    planAI(b.ai, b.player, b.terrain, b.wind, "normal", memory, () => 0.5);
    expect(memory.bias).toBeGreaterThan(-10);
    expect(memory.lastMiss).toBeNull();
    expect(memory.shots).toBe(2);
  });
  it("launches exactly the displayed AI angle and power with no ballistic post-launch correction", () => {
    const b = new Battle("hard", 31);
    enemyAttack(b, "shell");
    const expected = launch(b.ai, "shell");
    expect(b.projectile!.vx).toBe(expected.vx);
    expect(b.projectile!.vy).toBe(expected.vy);
    expect(b.projectile!.x).toBe(expected.x);
  });
  it("prefers electronics more often once enemy EMP runs out and never chooses exhausted ammo", () => {
    const b = new Battle();
    let defended = 0,
      unprotected = 0;
    for (let i = 1; i <= 200; i++) {
      b.player.emp = 2;
      if (
        ["drone", "missile"].includes(
          chooseArsenal(b.ai, b.player, b.terrain, "normal", seeded(i)),
        )
      )
        defended++;
      b.player.emp = 0;
      if (
        ["drone", "missile"].includes(
          chooseArsenal(b.ai, b.player, b.terrain, "normal", seeded(i)),
        )
      )
        unprotected++;
    }
    expect(unprotected).toBeGreaterThan(defended);
    b.ai.ammo.drone = 0;
    b.ai.ammo.missile = 0;
    expect(["drone", "missile"]).not.toContain(
      chooseArsenal(b.ai, b.player, b.terrain, "hard", () => 0),
    );
  });
  it("all five weapons use the published direct damage values", () => {
    expect(Object.values(WEAPONS).map((w) => w.directDamage)).toEqual([
      28, 18, 16, 22, 20,
    ]);
  });
  it("resets electronics, defenses, input and targeting on retry", () => {
    const b = new Battle();
    expect(b.player.emp).toBe(2);
    expect(b.ai.emp).toBe(2);
    expect(b.player.ammo.drone).toBe(2);
    expect(b.ai.ammo.missile).toBe(2);
    expect(b.drone).toBeNull();
    expect(b.defense).toBeNull();
    expect(b.target).toBeNull();
    b.phase = "over";
    expect(b.fire()).toBe(false);
    expect(b.attackDrone()).toBe(false);
    expect(b.useEmp("player")).toBe(false);
  });
  it.each(["easy", "normal", "hard"] as Difficulty[])(
    "terminates electronic attacks at %s without stuck states",
    (difficulty) => {
      const b = new Battle(difficulty, 14);
      enemyAttack(b, "missile");
      for (let i = 0; i < 3000 && b.phase !== "aim"; i++) b.update(1 / 60);
      expect(b.phase).toBe("aim");
      enemyAttack(b, "drone");
      for (let i = 0; i < 3000 && b.phase !== "aim"; i++) b.update(1 / 60);
      expect(b.phase).toBe("aim");
      expect(b.ai.ammo.drone).toBe(1);
      expect(b.ai.ammo.missile).toBe(1);
    },
  );
});
