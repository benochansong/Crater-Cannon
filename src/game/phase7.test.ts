import { describe, it, expect } from "vitest";
import { Battle, STEP, advance, solveShot, blastDamage } from "./engine";
import type { Impact, WeaponId } from "./engine";
import { MISSIONS } from "./campaign";
import { facilityY, missionSucceeded } from "./objectives";
import {
  normalizeProgress,
  completeMission,
  missionGrade,
} from "./campaignStorage";
const make = (i = 4, seed = 31) =>
  new Battle(MISSIONS[i].difficulty, seed, MISSIONS[i].config);
const run = (b: Battle, t: number) => {
  for (let i = 0; i < Math.round(t / STEP); i++) b.update(STEP);
};
const endTurn = (b: Battle) =>
  (b as unknown as { nextTurn: () => void }).nextTurn();
const impact = (
  b: Battle,
  weapon: WeaponId = "shell",
  side: "player" | "ai" = "player",
) => {
  const f = b.facility!;
  (
    b as unknown as {
      finishAttack: (h: Impact, w: WeaponId, o: "player" | "ai") => void;
    }
  ).finishAttack(
    { x: f.x, y: f.y - 8, direct: "objective", escaped: false },
    weapon,
    side,
  );
};
const oldSave = () =>
  normalizeProgress({
    version: 1,
    current: "shadow",
    completed: MISSIONS.slice(0, 4).map((m) => m.id),
    grades: { normandy: "S", iron: "A", "last-line": "B", shadow: "S" },
    supplies: 800,
    transitionSeen: true,
  });
describe("facility collision and damage", () => {
  it("clears a hostile missile lock when inspecting a friendly facility", () => {
    const b = make();
    b.weapon = "missile";
    b.lockTarget("ai");
    expect(b.target).toBe("ai");
    b.chooseTarget("objective");
    expect(b.target).toBeNull();
  });
  it("uses the same swept collision with a separate, larger facility body", () => {
    const b = make(5),
      f = b.facility!;
    const p = {
      x: f.x - 90,
      y: f.y - 8,
      vx: 1000,
      vy: 0,
      age: 1,
      owner: "player" as const,
      weapon: "shell" as const,
      trail: [],
    };
    const hit = advance(p, b.terrain, b.collisionTargets, 0, 0.1, 0);
    expect(hit?.direct).toBe("objective");
    expect(p.x).toBeLessThan(f.x);
  });
  it.each(["shell", "crater", "drone", "missile"] as WeaponId[])(
    "applies actual %s damage and clamps facility HP at zero",
    (w) => {
      const b = make(5);
      const f = b.facility!;
      impact(b, w);
      expect(f.hp).toBe(65 - blastDamage(0, w, true));
      expect(b.stats.damage).toBe(blastDamage(0, w, true));
      for (let i = 0; i < 10; i++) impact(b, w);
      expect(f.hp).toBe(0);
      expect(b.stats.damage).toBe(65);
    },
  );
  it("friendly fire can damage the defended facility and a tank shield cannot protect it", () => {
    const b = make();
    b.player.shield = true;
    impact(b, "shell", "ai");
    expect(b.facility!.hp).toBe(46);
    expect(b.ai.hp).toBe(100);
    impact(b);
    expect(b.facility!.hp).toBe(22);
  });
  it("repositions the collision body with the foundation after terrain destruction", () => {
    const b = make(5),
      f = b.facility!,
      old = f.y;
    b.terrain.fill(590, Math.floor(f.x - 50), Math.ceil(f.x + 51));
    b.update(STEP);
    expect(f.y).toBe(facilityY(b.terrain, f.x));
    expect(f.y).toBeGreaterThan(old);
    const p = {
      x: f.x - 50,
      y: f.y - 8,
      vx: 1000,
      vy: 0,
      age: 1,
      owner: "player" as const,
      weapon: "shell" as const,
      trail: [],
    };
    expect(advance(p, b.terrain, b.collisionTargets, 0, 0.1, 0)?.direct).toBe(
      "objective",
    );
  });
  it("missiles can lock the hostile facility but cannot lock friendly facilities or dead tanks", () => {
    const b = make(5);
    b.select("missile");
    expect(b.lockTarget("objective")).toBe(true);
    expect(b.fire()).toBe(true);
    expect(b.projectile?.target).toBe("objective");
    const c = make();
    c.select("missile");
    expect(c.lockTarget("objective")).toBe(false);
    c.ai.hp = 0;
    expect(c.lockTarget("ai")).toBe(false);
  });
  it("keeps facilities solid for tactical and long tank movement", () => {
    const b = make();
    b.terrain.fill(450);
    b.player.x = 210;
    b.player.y = 433;
    const r = b.adjustmentRange();
    expect(r.left).toBeGreaterThanOrEqual(b.facility!.x + 82);
    b.adjust(-1);
    run(b, 2);
    expect(b.player.x).toBeGreaterThanOrEqual(b.facility!.x + 82);
  });
});
describe("objective outcomes and turn boundaries", () => {
  it("wins defense after exactly six completed rounds with the enemy still alive", () => {
    const b = make();
    b.completedRounds = 4;
    b.turn = "ai";
    endTurn(b);
    expect(b.result).toBeNull();
    expect(b.completedRounds).toBe(5);
    b.turn = "ai";
    endTurn(b);
    expect(b.result?.outcome).toBe("victory");
    expect(b.result?.enemyHp).toBe(100);
    expect(b.result?.reason).toBe("defended");
  });
  it("does not count the player half-turn or a pending support response as a full round", () => {
    const b = make();
    endTurn(b);
    expect(b.completedRounds).toBe(0);
    const c = make();
    c.requestAir("helicopter", c.ai.x);
    run(c, 0.9);
    expect(c.completedRounds).toBe(0);
  });
  it("reinforces once, consumes a turn, caps at 70 and records restored HP", () => {
    const b = make();
    expect(b.reinforce()).toBe(false);
    b.facility!.hp = 63;
    expect(b.reinforce()).toBe(true);
    expect(b.facility!.hp).toBe(70);
    expect(b.reinforcement).toBe(0);
    expect(b.fire()).toBe(false);
    expect(b.restoredFacilityHp).toBe(7);
    b.phase = "aim";
    b.facility!.hp = 40;
    expect(b.reinforce()).toBe(false);
  });
  it.each(["player", "facility"] as const)(
    "fails defense when %s is destroyed, including simultaneous destruction",
    (who) => {
      const b = make();
      if (who === "player") b.player.hp = 0;
      else b.facility!.hp = 0;
      b.ai.hp = 0;
      endTurn(b);
      expect(b.result?.outcome).toBe("defeat");
    },
  );
  it("permits early defense victory when the remaining attacker is destroyed", () => {
    const b = make();
    b.ai.hp = 0;
    endTurn(b);
    expect(b.result?.reason).toBe("defended");
  });
  it("wins radar destruction with the enemy alive, and player death takes priority", () => {
    const b = make(5);
    b.facility!.hp = 0;
    endTurn(b);
    expect(b.result?.outcome).toBe("victory");
    expect(b.result?.enemyHp).toBe(100);
    const c = make(5);
    c.facility!.hp = 0;
    c.player.hp = 0;
    endTurn(c);
    expect(c.result?.outcome).toBe("defeat");
  });
  it("continues after the enemy tank is destroyed, skips all its actions, and resets movement", () => {
    const b = make(5);
    b.ai.hp = 0;
    b.player.mobility.remaining = 12;
    endTurn(b);
    expect(b.result).toBeNull();
    expect(b.turn).toBe("player");
    expect(b.phase).toBe("aim");
    expect(b.completedRounds).toBe(1);
    expect(b.player.mobility.remaining).toBe(60);
    b.aim(80, 20);
    b.fire();
    for (let i = 0; i < 3000 && b.phase !== "aim"; i++) b.update(STEP);
    expect(b.combat.ai.shots).toBe(0);
    expect(b.completedRounds).toBe(2);
  });
  it("fails at the eighth completed round, but allows a target hit on the last player turn", () => {
    const b = make(5);
    b.completedRounds = 7;
    b.turn = "ai";
    endTurn(b);
    expect(b.result?.reason).toBe("time-limit");
    const c = make(5);
    c.completedRounds = 7;
    c.facility!.hp = 0;
    endTurn(c);
    expect(c.result?.outcome).toBe("victory");
  });
  it("fails an impossible no-ammunition config without hanging", () => {
    const b = make(5);
    for (const w of b.allowedWeapons) b.player.ammo[w] = 0;
    endTurn(b);
    expect(b.result?.reason).toBe("no-ammo");
  });
});
describe("campaign migration, proof and grading", () => {
  it("migrates a complete four-mission save without losing rewards or grades", () => {
    const p = oldSave();
    expect(p.completed).toHaveLength(4);
    expect(p.supplies).toBe(800);
    expect(p.unlocked.at(-1)).toBe("last-signal");
    expect(p.grades.iron).toBe("A");
    expect(p.transitionSeen).toBe(true);
  });
  it("credits both objective types, unlocks six, rewards once, and preserves best grades", () => {
    let p = oldSave();
    const b = make();
    b.completedRounds = 5;
    b.turn = "ai";
    endTurn(b);
    const r = b.result!;
    expect(missionSucceeded(b.config, r)).toBe(true);
    p = completeMission(p, "last-signal", r);
    expect(p.supplies).toBe(1150);
    expect(p.unlocked).toHaveLength(6);
    p = completeMission(p, "last-signal", {
      ...r,
      hp: 10,
      objective: { ...r.objective!, hp: 1 },
    });
    expect(p.supplies).toBe(1150);
    expect(p.grades["last-signal"]).toBe("S");
    const c = make(5);
    c.facility!.hp = 0;
    endTurn(c);
    p = completeMission(p, "blind-enemy", c.result!);
    expect(p.supplies).toBe(1550);
    expect(p.completed).toHaveLength(6);
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("rejects victories without the matching actual objective evidence", () => {
    const b = make();
    b.ai.hp = 0;
    endTurn(b);
    const r = b.result!;
    expect(
      completeMission(oldSave(), "last-signal", { ...r, objective: undefined })
        .completed,
    ).toHaveLength(4);
    expect(
      missionSucceeded(b.config, {
        ...r,
        objective: { ...r.objective!, hp: 0 },
      }),
    ).toBe(false);
    const c = make(5);
    c.ai.hp = 0;
    endTurn(c);
    expect(c.result).toBeNull();
    expect(missionSucceeded(c.config, { ...r, missionId: "blind-enemy" })).toBe(
      false,
    );
  });
  it("grades objective efficiency rather than requiring a tank kill", () => {
    const b = make();
    b.completedRounds = 5;
    b.turn = "ai";
    endTurn(b);
    const r = b.result!;
    expect(missionGrade(r)).toBe("S");
    expect(
      missionGrade({
        ...r,
        objective: { ...r.objective!, reinforcement: 1, restored: 7 },
      }),
    ).toBe("A");
    const c = make(5);
    c.facility!.hp = 0;
    endTurn(c);
    expect(missionGrade(c.result!)).toBe("S");
    expect(missionGrade({ ...c.result!, round: 8, hp: 20 })).toBe("B");
  });
});
describe("real objective combat", () => {
  it("AI announces different targets and its physical shells can hit a facility", () => {
    const b = make();
    endTurn(b);
    expect(b.aiAttackTarget).toBe("objective");
    const first = b.facility!.hp;
    for (let i = 0; i < 3000 && b.phase !== "aim"; i++) b.update(STEP);
    expect(b.lastImpact.ai).not.toBeNull();
    expect(b.facility!.hp).toBeLessThanOrEqual(first);
    b.completedRounds = 1;
    endTurn(b);
    expect(b.aiAttackTarget).toBe("player");
  });
  it("can destroy the radar through real ballistics from the initial position", () => {
    const b = make(5);
    for (let tick = 0; tick < 8000 && !b.result; tick++) {
      if (b.canEmp("player")) b.useEmp("player");
      if (b.isReaction() && b.canShield()) b.activateShield();
      if (b.phase === "aim") {
        const p = solveShot(
          b.player,
          b.facility!,
          b.terrain,
          b.wind,
          b.collisionTargets,
        );
        b.aim(p.angle, p.power);
        b.fire();
      }
      b.update(0.1);
      b.drainEvents();
    }
    expect(b.result?.outcome).toBe("victory");
    expect(b.facility!.hp).toBe(0);
    expect(b.ai.hp).toBeGreaterThan(0);
  });
});

it("defends six actual rounds with reinforcement while the enemy survives", () => {
  const b = make();
  for (let tick = 0; tick < 9000 && !b.result; tick++) {
    if (b.canEmp("player")) b.useEmp("player");
    if (b.isReaction() && b.canShield()) b.activateShield();
    if (b.phase === "aim") {
      if (b.canReinforce() && b.facility!.hp <= 55) b.reinforce();
      else if (b.player.hp <= 45 && b.canRepair()) b.repair();
      else {
        b.aim(10, 20);
        b.fire();
      }
    }
    b.update(0.1);
    b.drainEvents();
  }
  expect(b.result?.reason).toBe("defended");
  expect(b.completedRounds).toBe(6);
  expect(b.ai.hp).toBeGreaterThan(0);
});
it("one helicopter cannot destroy a full-health radar and shares its mission budget", () => {
  const b = make(5);
  expect(b.requestAir("helicopter", b.facility!.x)).toBe(true);
  for (let i = 0; i < 9000 && b.phase !== "aim" && !b.result; i++)
    b.update(STEP);
  expect(b.facility!.hp).toBeGreaterThanOrEqual(38);
  expect(b.facility!.hp).toBeLessThan(65);
  expect(b.result).toBeNull();
  expect(b.player.airRemaining).toBe(0);
  expect(b.requestAir("helicopter", b.facility!.x)).toBe(false);
});
