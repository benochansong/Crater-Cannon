import { describe, it, expect } from "vitest";
import { Battle, STEP, solveShot, advance } from "./engine";
import type { Impact } from "./engine";
import { MISSIONS } from "./campaign";
import { CONVOY_ROUTE, WAVES } from "./operations";
import { missionSucceeded } from "./objectives";
import {
  normalizeProgress,
  completeMission,
  missionGrade,
} from "./campaignStorage";
const make = (index = 6, seed = 31) =>
  new Battle(MISSIONS[index].difficulty, seed, MISSIONS[index].config);
const next = (b: Battle) =>
  (b as unknown as { nextTurn: () => void }).nextTurn();
const run = (b: Battle, seconds: number) => {
  for (let i = 0; i < seconds / STEP; i++) b.update(STEP);
};
const hit = (
  b: Battle,
  target: "ai" | "objective" = "ai",
  owner: "player" | "ai" = "player",
) => {
  const t = target === "ai" ? b.ai : b.facility!;
  (
    b as unknown as {
      finishAttack: (h: Impact, w: "shell", o: "player" | "ai") => void;
    }
  ).finishAttack(
    { x: t.x, y: t.y - 8, direct: target, escaped: false },
    "shell",
    owner,
  );
};
const oldSave = () =>
  normalizeProgress({
    version: 1,
    current: "blind-enemy",
    completed: MISSIONS.slice(0, 6).map((m) => m.id),
    grades: { normandy: "S", iron: "A", shadow: "S" },
    supplies: 1550,
    transitionSeen: true,
  });
describe("convoy checkpoints and sequential opponents", () => {
  it("creates a distinct noncombat truck and the first wave", () => {
    const b = make();
    expect(b.facility!.hp).toBe(80);
    expect(b.facility!.kind).toBe("truck");
    expect(b.ai.hp).toBe(WAVES[0].hp);
    expect(b.convoy!.checkpoint).toBe(0);
    expect(b.tanks).toHaveLength(2);
  });
  it("moves smoothly one checkpoint after a full round and waits at an uncleared gate", () => {
    const b = make();
    b.turn = "ai";
    next(b);
    expect(b.convoy!.moving).toBe(true);
    run(b, 0.7);
    expect(b.facility!.x).toBeGreaterThan(120);
    expect(b.facility!.x).toBeLessThan(220);
    expect(b.fire()).toBe(false);
    run(b, 1);
    expect(b.convoy!.checkpoint).toBe(1);
    expect(b.completedRounds).toBe(1);
    b.turn = "ai";
    next(b);
    expect(b.convoy!.moving).toBe(false);
    expect(b.convoy!.warning).toContain("통로 차단");
    expect(b.result).toBeNull();
  });
  it("does not strand the truck in destroyed terrain", () => {
    const b = make();
    b.terrain.fill(620, 120, 250);
    b.turn = "ai";
    next(b);
    run(b, 1.8);
    expect(b.facility!.x).toBe(CONVOY_ROUTE[1]);
    expect(b.facility!.hp).toBe(80);
    expect(b.convoy!.moving).toBe(false);
  });
  it("replaces only the enemy after resolution and keeps player resources and statistics", () => {
    const b = make();
    b.player.hp = 62;
    b.player.ammo.drone = 1;
    b.player.repairs = 1;
    b.player.shields = 1;
    b.stats.shots = 8;
    b.stats.damage = 50;
    b.ai.hp = 1;
    hit(b);
    expect(b.convoy!.wave).toBe(0);
    expect(b.result).toBeNull();
    run(b, 4);
    expect(b.convoy!.wave).toBe(1);
    expect(b.ai.hp).toBe(46);
    expect(b.player.hp).toBe(62);
    expect(b.player.repairs).toBe(1);
    expect(b.player.shields).toBe(1);
    expect(b.player.ammo.drone).toBe(1);
    expect(b.stats.shots).toBe(8);
    expect(b.stats.damage).toBe(51);
    expect(b.turn).toBe("player");
    expect(b.result).toBeNull();
  });
  it("keeps a killed enemy until reserved player air support fully resolves", () => {
    const b = make();
    b.requestAir("helicopter", b.ai.x);
    b.ai.hp = 0;
    next(b);
    expect(b.convoy!.wave).toBe(0);
    expect(b.air).not.toBeNull();
    run(b, 14);
    expect(b.convoy!.wave).toBe(1);
    expect(b.player.airRemaining).toBe(0);
    expect(b.supportStats.player.helicopter.shots).toBeGreaterThan(0);
  });
  it("uses truck collision and actual attack damage", () => {
    const b = make(),
      f = b.facility!;
    const p = {
      x: f.x + 80,
      y: f.y - 8,
      vx: -1000,
      vy: 0,
      age: 1,
      owner: "ai" as const,
      weapon: "shell" as const,
      trail: [],
    };
    expect(advance(p, b.terrain, b.collisionTargets, 0, 0.1, 0)?.direct).toBe(
      "objective",
    );
    hit(b, "objective", "ai");
    expect(f.hp).toBe(56);
    expect(b.convoy!.warning).toContain("피격");
  });
  it("rewards an ahead position and a spent shield with real damage reduction", () => {
    const b = make();
    b.player.x = b.facility!.x + 100;
    expect(b.convoyCovered).toBe(true);
    expect(b.protectConvoy()).toBe(true);
    expect(b.player.shields).toBe(1);
    expect(b.phase).toBe("resolve");
    hit(b, "objective", "ai");
    expect(b.facility!.hp).toBe(71);
    expect(b.convoy!.protectedDamage).toBe(15);
    expect(b.convoy!.shield).toBe(false);
  });
  it("does not let a distant or moving player cast convoy protection", () => {
    const b = make();
    expect(b.canProtectConvoy()).toBe(false);
    b.player.x = 220;
    b.player.mobility.input = 1;
    expect(b.canProtectConvoy()).toBe(false);
    expect(b.player.shields).toBe(2);
  });
  it("announces wave-specific physical attack targets", () => {
    const b = make();
    next(b);
    expect(b.aiAttackTarget).toBe("player");
    b.turn = "player";
    b.phase = "aim";
    b.convoy!.wave = 1;
    next(b);
    expect(b.aiAttackTarget).toBe("objective");
    expect(b.ai.hp).toBeGreaterThan(0);
  });
  it("never awards mission success from killing the first opponent", () => {
    const b = make();
    b.ai.hp = 0;
    next(b);
    expect(b.result).toBeNull();
    expect(b.convoy!.kills).toBe(1);
    expect(b.ai.hp).toBeGreaterThan(0);
  });
  it.each(["player", "truck", "timeout"] as const)(
    "fails on %s without awarding supplies",
    (which) => {
      const b = make();
      if (which === "player") b.player.hp = 0;
      else if (which === "truck") b.facility!.hp = 0;
      else {
        b.completedRounds = 17;
        b.convoy!.checkpoint = 1;
        b.turn = "ai";
      }
      next(b);
      expect(b.result?.outcome).toBe("defeat");
      expect(
        completeMission(oldSave(), MISSIONS[6].id, b.result!).supplies,
      ).toBe(1550);
    },
  );
  it("requires actual arrival and both survivors at the final checkpoint", () => {
    const b = make();
    b.convoy!.checkpoint = 5;
    b.convoy!.kills = 3;
    b.convoy!.wave = 2;
    b.convoy!.cleared = true;
    b.ai.hp = 0;
    next(b);
    expect(b.result?.reason).toBe("escorted");
    expect(missionSucceeded(b.config, b.result!)).toBe(true);
    expect(
      missionSucceeded(b.config, {
        ...b.result!,
        operation: { ...b.result!.operation!, checkpoint: 4 },
      }),
    ).toBe(false);
    expect(missionSucceeded(b.config, { ...b.result!, hp: 0 })).toBe(false);
  });
});
describe("boss armor, transitions and fair warnings", () => {
  it("starts a distinguishable boss with a skippable, noninteractive entrance", () => {
    const b = make(7);
    expect(b.ai.hp).toBe(100);
    expect(b.ai.width).toBe(108);
    expect(b.scene?.kind).toBe("boss-intro");
    expect(b.fire()).toBe(false);
    b.skipScene();
    expect(b.scene).toBeNull();
    expect(b.boss!.phase).toBe(1);
    expect(b.ai.repairs).toBe(0);
    expect(b.ai.shields).toBe(1);
  });
  it("reduces early damage then removes armor after three effective attacks", () => {
    const b = make(7);
    b.skipScene();
    hit(b);
    expect(b.ai.hp).toBe(87);
    expect(b.boss!.plates).toBe(2);
    hit(b);
    hit(b);
    next(b);
    expect(b.boss!.phase).toBe(2);
    expect(b.boss!.plates).toBe(0);
    b.skipScene();
    const hp = b.ai.hp;
    hit(b);
    expect(b.ai.hp).toBe(hp - 24);
  });
  it.each(["terrain", "position"] as const)(
    "exposes armor with the announced %s rule",
    (rule) => {
      const b = make(7);
      b.skipScene();
      if (rule === "terrain") b.terrain[Math.round(b.ai.x)] += 16;
      else b.player.x = 550;
      next(b);
      expect(b.boss!.phase).toBe(2);
      expect(b.boss!.weakness).toBe(1);
    },
  );
  it("advances monotonically and does not replay transitions", () => {
    const b = make(7);
    b.skipScene();
    b.ai.hp = 34;
    next(b);
    expect(b.boss!.transitions).toEqual([1, 2, 3]);
    b.skipScene();
    b.ai.hp = 70;
    next(b);
    expect(b.boss!.phase).toBe(3);
    expect(b.boss!.transitions).toEqual([1, 2, 3]);
    expect(b.boss!.weakness).toBe(1);
  });
  it("announces a phase-two missile matching the actual projectile and allows EMP", () => {
    const b = make(7);
    b.skipScene();
    b.boss!.phase = 2;
    b.boss!.plates = 0;
    next(b);
    expect(b.boss!.announced).toContain("유도");
    run(b, 3);
    expect(b.projectile?.weapon).toBe("missile");
    expect(b.projectile?.target).toBe("player");
    expect(b.canEmp("player")).toBe(true);
    b.useEmp("player");
    expect(b.projectile?.guided).toBe(false);
  });
  it("requests the phase-three bomber once with the normal response turn", () => {
    const b = make(7);
    b.skipScene();
    b.boss!.phase = 3;
    b.ai.hp = 30;
    next(b);
    expect(b.boss!.announced).toBe("폭격 지원");
    run(b, 3);
    expect(b.pendingAir?.kind).toBe("bomber");
    expect(b.pendingAir?.responseStarted).toBe(true);
    expect(b.turn).toBe("player");
    expect(b.player.hp).toBe(100);
    expect(b.ai.airRemaining).toBe(0);
    expect(b.boss!.finalAttackUsed).toBe(true);
  });
  it("finishes the wreck cinematic before crediting the final kill", () => {
    const b = make(7);
    b.skipScene();
    b.ai.hp = 0;
    next(b);
    expect(b.result).toBeNull();
    expect(b.scene?.kind).toBe("boss-end");
    b.skipScene();
    expect(b.result?.reason).toBe("boss-destroyed");
    expect(b.boss!.transitions).toEqual([1, 2, 3]);
    expect(missionSucceeded(b.config, b.result!)).toBe(true);
  });
  it("prioritizes player loss and enforces the limit", () => {
    const b = make(7);
    b.skipScene();
    b.ai.hp = 0;
    b.player.hp = 0;
    next(b);
    expect(b.result?.outcome).toBe("defeat");
    const c = make(7);
    c.skipScene();
    c.round = 18;
    c.turn = "ai";
    next(c);
    expect(c.result?.reason).toBe("time-limit");
  });
});
describe("eight mission persistence", () => {
  it("preserves six earned records, unlocks seven, then eight without duplicate rewards", () => {
    let p = oldSave();
    expect(p.supplies).toBe(1550);
    expect(p.completed).toHaveLength(6);
    expect(p.unlocked).toHaveLength(7);
    const b = make();
    b.convoy!.checkpoint = 5;
    b.convoy!.kills = 3;
    b.convoy!.wave = 2;
    b.convoy!.cleared = true;
    b.ai.hp = 0;
    next(b);
    p = completeMission(p, "convoy-fire", b.result!);
    expect(p.supplies).toBe(2000);
    expect(p.unlocked).toHaveLength(8);
    const c = make(7);
    c.skipScene();
    c.ai.hp = 0;
    next(c);
    c.skipScene();
    p = completeMission(p, "iron-citadel", c.result!);
    expect(p.supplies).toBe(2550);
    expect(p.completed).toHaveLength(8);
    p = completeMission(p, "iron-citadel", c.result!);
    expect(p.supplies).toBe(2550);
    expect(normalizeProgress(p)).toEqual(p);
    expect(p.grades.normandy).toBe("S");
  });
  it("grades truck survival and boss weakness/defense rather than an arbitrary HP victory", () => {
    const b = make();
    b.convoy!.checkpoint = 5;
    b.convoy!.kills = 3;
    b.convoy!.wave = 2;
    b.convoy!.cleared = true;
    b.ai.hp = 0;
    next(b);
    expect(missionGrade(b.result!)).toBe("S");
    expect(
      missionGrade({
        ...b.result!,
        objective: { ...b.result!.objective!, hp: 10 },
      }),
    ).toBe("B");
    const c = make(7);
    c.skipScene();
    c.ai.hp = 0;
    next(c);
    c.skipScene();
    expect(
      missionGrade({
        ...c.result!,
        operation: { ...c.result!.operation!, defenses: 1 },
      }),
    ).toBe("S");
  });
});
it.each([6, 7])(
  "completes mission %s with actual seeded ballistics and all stages",
  (index) => {
    const b = make(index);
    for (let tick = 0; tick < 20000 && !b.result; tick++) {
      if (b.canEmp("player")) b.useEmp("player");
      if (b.isReaction() && b.canShield()) b.activateShield();
      if (b.phase === "aim" && !b.scene && !b.convoy?.moving) {
        if (b.player.hp <= 45 && b.canRepair()) b.repair();
        else {
          const p = solveShot(
            b.player,
            b.ai,
            b.terrain,
            b.wind,
            b.collisionTargets,
          );
          b.select("shell");
          b.aim(p.angle, p.power);
          b.fire();
        }
      }
      b.update(0.1);
      b.drainEvents();
    }
    expect(b.result?.outcome).toBe("victory");
    if (b.convoy) {
      expect(b.convoy.kills).toBe(3);
      expect(b.convoy.checkpoint).toBe(5);
    } else expect(b.boss!.transitions).toEqual([1, 2, 3]);
  },
  20000,
);

it.each(["player", "ai"] as const)(
  "keeps %s movement and range outside the enlarged boss hull",
  (side) => {
    const b = make(7);
    b.skipScene();
    b.terrain.fill(500);
    b.player.x = 910;
    b.ai.x = 1050;
    b.player.y = b.ai.y = 483;
    b.turn = side;
    b.phase = side === "player" ? "aim" : "ai-aim";
    b.timer = 100;
    if (side === "ai")
      (b as unknown as { aiAdjustment: number }).aiAdjustment = 60;
    const range = b.adjustmentRange(side);
    expect(
      side === "player" ? b.ai.x - range.right : range.left - b.player.x,
    ).toBeGreaterThanOrEqual(93);
    expect(b.adjust(side === "player" ? 1 : -1, side)).toBe(true);
    run(b, 1.5);
    expect(b.ai.x - b.player.x).toBeGreaterThanOrEqual(93);
    const t = side === "player" ? b.player : b.ai;
    expect(t.mobility.remaining).toBeGreaterThan(0);
    expect(t.mobility.input).toBe(0);
    expect(t.mobility.reason).toContain("다른 전차");
  },
);
