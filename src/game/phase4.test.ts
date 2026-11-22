import { chooseTactic } from "./tactics";
import { describe, it, expect } from "vitest";
import { Battle, STEP, EMP_WINDOW } from "./engine";
import type { WeaponId, Impact, Side } from "./engine";
import { shieldDamage } from "./defense";
const run = (b: Battle, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) b.update(STEP);
};
function impact(
  b: Battle,
  weapon: WeaponId,
  owner: Side = "player",
  hit: Impact | null = {
    x: b.ai.x,
    y: b.ai.y - 8,
    direct: "ai",
    escaped: false,
  },
) {
  (
    b as unknown as {
      finishAttack(h: Impact | null, w: WeaponId, s: Side): void;
    }
  ).finishAttack(hit, weapon, owner);
}
describe("field repair", () => {
  it("heals gradually, caps at 100, spends one turn and cannot be repeated mid-action", () => {
    const b = new Battle("easy", 11);
    b.player.hp = 91;
    expect(b.repair()).toBe(true);
    expect(b.player.repairs).toBe(1);
    expect(b.repair()).toBe(false);
    expect(b.fire()).toBe(false);
    run(b, 0.8);
    expect(b.player.hp).toBeGreaterThan(91);
    expect(b.player.hp).toBeLessThan(100);
    run(b, 1.1);
    expect(b.player.hp).toBe(100);
    expect(b.turn).toBe("ai");
  });
  it("rejects full HP, depleted repairs and off-turn actions", () => {
    const b = new Battle();
    expect(b.repair()).toBe(false);
    b.player.hp = 20;
    b.player.repairs = 0;
    expect(b.repair()).toBe(false);
    b.player.repairs = 2;
    b.phase = "flight";
    expect(b.repair()).toBe(false);
    b.phase = "aim";
    expect(b.repair("ai")).toBe(false);
  });
  it("uses the same 20 HP for AI", () => {
    const b = new Battle();
    b.turn = "ai";
    b.phase = "ai-aim";
    b.ai.hp = 40;
    expect(b.repair("ai")).toBe(true);
    run(b, 1.7);
    expect(b.ai.hp).toBe(60);
    expect(b.ai.repairs).toBe(1);
  });
});
describe("energy shield", () => {
  it("costs a turn and rejects duplicate activation", () => {
    const b = new Battle("easy", 1);
    expect(b.activateShield()).toBe(true);
    expect(b.player.shields).toBe(1);
    expect(b.player.shield).toBe(true);
    expect(b.activateShield()).toBe(false);
    expect(b.fire()).toBe(false);
    run(b, 1.1);
    expect(b.turn).toBe("ai");
    b.phase = "aim";
    b.turn = "player";
    expect(b.activateShield()).toBe(false);
  });
  it.each(["shell", "crater", "shock", "drone", "missile"] as WeaponId[])(
    "reduces %s damage and disappears after the entire attack",
    (weapon) => {
      const a = new Battle(),
        b = new Battle();
      b.ai.shield = true;
      impact(a, weapon);
      impact(b, weapon);
      expect(100 - b.ai.hp).toBe(Math.ceil((100 - a.ai.hp) / 2));
      expect(b.ai.shield).toBe(false);
      const blocked = b.events
        .filter((e) => e.type === "block")
        .reduce((sum, e) => sum + e.amount!, 0);
      expect(blocked + 100 - b.ai.hp).toBe(100 - a.ai.hp);
    },
  );
  it("expires on misses and EMP-disabled attacks, but not on repair", () => {
    const b = new Battle();
    b.ai.shield = true;
    impact(b, "shell", "player", null);
    expect(b.ai.shield).toBe(false);
    b.ai.shield = true;
    b.phase = "aim";
    b.player.hp = 70;
    b.repair();
    run(b, 1.7);
    expect(b.ai.shield).toBe(true);
  });
  it("rounds multiple hits as one operation", () => {
    let raw = 0,
      received = 0,
      absorbed = 0;
    for (let i = 0; i < 3; i++) {
      const d = shieldDamage(9, raw, true);
      raw = d.total;
      received += d.amount;
      absorbed += d.absorbed;
    }
    expect(received).toBe(14);
    expect(absorbed).toBe(13);
  });
});
it("EMP retains its shared rules and has a four-second reaction window", () => {
  const b = new Battle("easy", 6);
  b.ai.emp = 0;
  b.select("drone");
  b.fire();
  expect(EMP_WINDOW).toBe(4);
  run(b, 3.8);
  expect(b.canEmp("ai")).toBe(false);
  b.ai.emp = 2;
  expect(b.canEmp("ai")).toBe(true);
  run(b, 0.3);
  expect(b.canEmp("ai")).toBe(false);
});

describe("limited terrain movement", () => {
  it("moves continuously at most 145 units and consumes the attack turn", () => {
    const b = new Battle("easy", 3);
    b.terrain.fill(450);
    b.player.y = 433;
    const x = b.player.x;
    expect(b.move(1)).toBe(true);
    expect(b.move(-1)).toBe(false);
    expect(b.fire()).toBe(false);
    run(b, 0.5);
    expect(b.player.x).toBeGreaterThan(x);
    expect(b.player.x).toBeLessThan(x + 60);
    run(b, 1.5);
    expect(b.player.x - x).toBeCloseTo(145, 5);
    expect(b.turn).toBe("ai");
    expect(b.player.y).toBe(433);
  });
  it("stops at impassable slopes and cannot pass through another vehicle", () => {
    const b = new Battle();
    b.terrain.fill(450);
    b.player.y = 433;
    for (let i = 270; i < b.terrain.length; i++) b.terrain[i] = 330;
    expect(b.move(1)).toBe(true);
    run(b, 1.8);
    expect(b.player.x).toBeLessThan(250);
    const c = new Battle();
    c.terrain.fill(450);
    c.ai.x = c.player.x + 69;
    expect(c.move(1)).toBe(false);
    expect(c.move(-1)).toBe(true);
  });
});
function until(b: Battle, check: () => boolean, max = 5000) {
  for (let i = 0; i < max && !check(); i++) b.update(STEP);
  expect(check()).toBe(true);
}
function enemyAir(kind: "helicopter" | "bomber", shield = false) {
  const b = new Battle("easy", 4);
  b.turn = "ai";
  b.phase = "ai-aim";
  expect(b.requestAir(kind, b.player.x, "ai")).toBe(true);
  until(b, () => b.phase === "aim");
  expect(b.pendingAir?.responseStarted).toBe(true);
  if (shield) expect(b.activateShield()).toBe(true);
  else {
    b.player.hp = 80;
    expect(b.repair()).toBe(true);
  }
  until(b, () => b.phase === "air");
  return b;
}
describe("air support reservation and response", () => {
  it.each(["helicopter", "bomber"] as const)(
    "%s gives exactly one response then executes once and resumes the correct side",
    (kind) => {
      const b = enemyAir(kind);
      expect(b.pendingAir).toBeNull();
      expect(b.air?.kind).toBe(kind);
      expect(b.ai.support[kind]).toBe(0);
      expect(b.canEmp("player")).toBe(false);
      until(b, () => b.phase === "ai-aim");
      expect(b.player.hp).toBe(kind === "helicopter" ? 73 : 70);
      expect(b.terrainRevision).toBe(3);
      expect(b.air).toBeNull();
      expect(b.supportStats.ai[kind].shots).toBe(1);
      expect(b.supportStats.ai[kind].hits).toBe(1);
      expect(b.supportStats.ai[kind].damage).toBe(
        kind === "helicopter" ? 27 : 30,
      );
      expect(b.requestAir(kind, b.player.x, "ai")).toBe(false);
    },
  );
  it.each(["helicopter", "bomber"] as const)(
    "one shield halves the entire %s operation",
    (kind) => {
      const b = enemyAir(kind, true);
      // It must remain through intermediate blasts, not vanish on the first pellet.
      until(b, () => !!b.air?.impacts.some((p) => p.done));
      expect(b.player.shield).toBe(true);
      until(b, () => b.phase === "ai-aim");
      expect(b.player.hp).toBe(kind === "helicopter" ? 86 : 85);
      expect(b.player.shield).toBe(false);
      const absorbed = b.events
        .filter((e) => e.type === "block")
        .reduce((s, e) => s + e.amount!, 0);
      expect(absorbed).toBe(kind === "helicopter" ? 13 : 15);
    },
  );
  it("rejects nested support without spending resources", () => {
    const b = new Battle("easy", 1);
    b.requestAir("bomber", b.ai.x);
    until(b, () => b.phase === "ai-aim");
    expect(b.requestAir("helicopter", b.player.x, "ai")).toBe(false);
    expect(b.ai.support.helicopter).toBe(1);
    expect(b.pendingAir?.owner).toBe("player");
  });
  it("allows movement away from the advertised bomber zone before damage", () => {
    const b = new Battle("easy", 2);
    b.terrain.fill(450);
    b.tanks.forEach((t) => (t.y = 433));
    b.turn = "ai";
    b.phase = "ai-aim";
    b.requestAir("bomber", b.player.x, "ai");
    until(b, () => b.phase === "aim");
    const x = b.player.x;
    expect(b.move(1)).toBe(true);
    until(b, () => b.phase === "ai-aim");
    expect(b.player.x - x).toBeCloseTo(145, 5);
    expect(b.player.hp).toBeGreaterThan(90);
    expect(b.supportStats.ai.bomber.damage).toBeLessThan(10);
  });
  it("allows an attack response and cancels a reservation when its owner dies", () => {
    const b = new Battle("easy", 2);
    b.turn = "ai";
    b.phase = "ai-aim";
    b.requestAir("helicopter", b.player.x, "ai");
    until(b, () => b.phase === "aim");
    b.ai.hp = 20;
    impact(b, "shell");
    until(b, () => b.phase === "over");
    expect(b.result?.outcome).toBe("victory");
    expect(b.pendingAir).toBeNull();
    expect(b.air).toBeNull();
    expect(b.supportStats.ai.helicopter.shots).toBe(0);
  });
  it("resets support and defense state and enforces a finite match", () => {
    const b = new Battle();
    expect(b.player.support).toEqual({ helicopter: 1, bomber: 1 });
    expect(b.ai.repairs).toBe(2);
    expect(b.air).toBeNull();
    expect(b.pendingAir).toBeNull();
    expect(b.action).toBeNull();
    b.round = 40;
    b.turn = "ai";
    b.phase = "resolve";
    b.timer = 0;
    b.ai.hp = 40;
    run(b, 0.1);
    expect(b.result?.outcome).toBe("victory");
    expect(b.repair()).toBe(false);
    expect(b.requestAir("bomber", 100)).toBe(false);
  });
});

describe("AI tactical decisions", () => {
  it("considers repair and air support with difficulty-specific mistakes instead of always defending", () => {
    const seen = new Set<string>();
    let repairs = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const b = new Battle("hard", seed);
      b.round = 3;
      b.turn = "ai";
      b.phase = "ai-aim";
      b.ai.hp = 30;
      const choice = chooseTactic(b);
      if (choice) {
        seen.add(choice.kind);
        if (choice.kind === "repair") repairs++;
      }
    }
    expect(repairs).toBeGreaterThan(20);
    expect(repairs).toBeLessThan(80);
    expect(seen.has("helicopter") || seen.has("bomber")).toBe(true);
  });
  it("reacts to the visible target zone with shield or movement and respects used resources", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const b = new Battle("normal", seed);
      b.pendingAir = {
        id: 1,
        kind: "bomber",
        owner: "player",
        targetX: b.ai.x,
        responseStarted: true,
      };
      b.turn = "ai";
      b.phase = "ai-aim";
      const choice = chooseTactic(b);
      if (choice) seen.add(choice.kind);
      b.ai.repairs = 0;
      b.ai.shields = 0;
      b.ai.support = { helicopter: 0, bomber: 0 };
      const empty = chooseTactic(b);
      expect(["repair", "shield", "helicopter", "bomber"]).not.toContain(
        empty?.kind,
      );
    }
    expect(seen.has("shield")).toBe(true);
    expect(seen.has("move")).toBe(true);
  });
  it("cannot repair on consecutive AI actions", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const b = new Battle("hard", seed);
      b.round = 3;
      b.turn = "ai";
      b.phase = "ai-aim";
      b.ai.hp = 15;
      b.lastAction.ai = "repair";
      expect(chooseTactic(b)?.kind).not.toBe("repair");
    }
  });
});
it.each(["player", "ai"] as Side[])(
  "settles the final reserved operation before the round-limit verdict (%s)",
  (owner) => {
    const b = new Battle("easy", 3);
    b.round = 40;
    b.turn = owner;
    b.phase = owner === "player" ? "aim" : "ai-aim";
    b.requestAir("helicopter", owner === "player" ? b.ai.x : b.player.x, owner);
    until(b, () => b.phase === (owner === "player" ? "ai-aim" : "aim"));
    expect(b.round).toBe(40);
    expect(b.result).toBeNull();
    expect(b.activateShield(owner === "player" ? "ai" : "player")).toBe(true);
    until(b, () => b.phase === "air");
    expect(b.result).toBeNull();
    until(b, () => b.phase === "over");
    expect(b.air).toBeNull();
    expect(b.pendingAir).toBeNull();
    expect(b.supportStats[owner].helicopter.shots).toBe(1);
  },
);
it("air support outcomes are independent of render/update batching", () => {
  const a = enemyAir("bomber", true),
    b = enemyAir("bomber", true);
  run(a, 5.5);
  for (let i = 0; i < 55; i++) b.update(0.1);
  expect(a.tanks.map((t) => t.hp)).toEqual(b.tanks.map((t) => t.hp));
  expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
  expect(a.phase).toBe(b.phase);
  expect(a.supportStats).toEqual(b.supportStats);
});
