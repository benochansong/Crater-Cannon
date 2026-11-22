import { describe, it, expect, vi, afterEach } from "vitest";
import { Battle, STEP, WEAPON_IDS, solveShot } from "./engine";
import type { WeaponId } from "./engine";
import { MISSIONS } from "./campaign";
import { FREE_BATTLE } from "./eras";
import {
  freshProgress,
  normalizeProgress,
  completeMission,
  loadCampaign,
  saveCampaign,
  CAMPAIGN_KEY,
} from "./campaignStorage";
import type { BattleResult } from "./engine";
const run = (b: Battle, n: number) => {
  for (let i = 0; i < n / STEP; i++) b.update(STEP);
};
const hit = (b: Battle, w: WeaponId = "shell") =>
  (b as unknown as { finishAttack: Function }).finishAttack(
    { x: b.ai.x, y: b.ai.y - 8, direct: "ai", escaped: false },
    w,
    "player",
  );
const victory: BattleResult = {
  id: "test",
  outcome: "victory",
  hp: 80,
  enemyHp: 0,
  seconds: 90,
  difficulty: "easy",
  date: "2026-11-22",
  shots: 6,
  hits: 6,
  direct: 6,
  damage: 100,
};
afterEach(() => vi.unstubAllGlobals());
describe("era capabilities at the engine boundary", () => {
  it.each(MISSIONS.slice(0, 3))(
    "$title rejects electronic weapons, modern support and energy shield even with forged stock",
    (m) => {
      const b = new Battle(m.difficulty, 12, m.config);
      for (const t of b.tanks) {
        expect(t.emp).toBe(0);
        expect(t.shields).toBe(0);
      }
      for (const w of ["drone", "missile", "shock"] as WeaponId[]) {
        b.player.ammo[w] = 99;
        b.select(w);
        expect(b.weapon).not.toBe(w);
        b.weapon = w;
        expect(b.fire()).toBe(false);
      }
      for (const side of ["player", "ai"] as const) {
        b.turn = side;
        b.phase = side === "player" ? "aim" : "ai-aim";
        const t = side === "player" ? b.player : b.ai;
        t.shields = 99;
        t.support.helicopter = 99;
        expect(b.activateShield(side)).toBe(false);
        expect(b.requestAir("helicopter", 600, side)).toBe(false);
        t.emp = 99;
        b.phase = "deploy";
        b.defense = {
          owner: side === "ai" ? "player" : "ai",
          used: false,
          remaining: 4,
          reactionAt: null,
        };
        expect(b.useEmp(side)).toBe(false);
      }
    },
  );
  it("free battle keeps all modern weapons and excludes period weapons", () => {
    const b = new Battle();
    expect(b.allowedWeapons).toEqual(FREE_BATTLE.weapons);
    b.player.ammo.ap = 99;
    b.select("ap");
    expect(b.weapon).toBe("shell");
    expect(b.fieldDefense("smoke")).toBe(false);
    expect(b.requestAir("propeller", 600)).toBe(false);
  });
  it("mission-specific restrictions apply even within the same era", () => {
    const b = new Battle("easy", 1, MISSIONS[0].config);
    b.player.ammo.crater = 99;
    b.select("crater");
    expect(b.weapon).toBe("shell");
    expect(b.fieldDefense("cover")).toBe(false);
    expect(b.requestAir("artillery", 1000)).toBe(false);
  });
  it.each(MISSIONS)(
    "$title AI uses only authorized resources over a real match",
    (m) => {
      const b = new Battle(m.difficulty, 31, m.config);
      let steps = 0;
      while (!b.result && steps++ < 18000) {
        if (b.canEmp("player")) b.useEmp("player");
        if (b.isReaction() && b.canShield()) b.activateShield();
        if (b.phase === "aim") {
          const p = solveShot(b.player, b.ai, b.terrain, b.wind);
          b.aim(p.angle, p.power);
          b.select(
            b.allowedWeapons.includes("ap") && b.player.ammo.ap > 0
              ? "ap"
              : "shell",
          );
          b.fire();
        }
        b.update(0.1);
        b.drainEvents();
      }
      expect(b.result).not.toBeNull();
      for (const w of WEAPON_IDS)
        if (!b.allowedWeapons.includes(w))
          expect(b.telemetry.ai[w].shots).toBe(0);
      for (const k of [
        "helicopter",
        "bomber",
        "artillery",
        "propeller",
      ] as const)
        if (
          !b.allowedSupports.includes(k) ||
          (m.config.enemySupports && !m.config.enemySupports.includes(k))
        )
          expect(b.supportStats.ai[k].shots).toBe(0);
    },
  );
});
describe("survival and fortress mechanics", () => {
  it("reactive shield does not steal or restart the attack turn", () => {
    const b = new Battle("normal", 1);
    b.phase = "ai-aim";
    b.turn = "ai";
    (b as unknown as { shoot: Function }).shoot(b.ai, "shell");
    const p = b.projectile;
    expect(b.guardTime).toBe(2.5);
    run(b, 1);
    expect(b.projectile?.x).toBe(p?.x);
    expect(b.activateShield()).toBe(true);
    expect(b.turn).toBe("ai");
    expect(b.phase).toBe("flight");
    expect(b.action).toBeNull();
    expect(b.activateShield()).toBe(false);
  });
  it("repair heals 28, cannot repeat consecutively, and resets for each mission", () => {
    const b = new Battle();
    b.player.hp = 30;
    b.repair();
    run(b, 1.7);
    expect(b.player.hp).toBe(58);
    b.turn = "player";
    b.phase = "aim";
    expect(b.repair()).toBe(false);
    b.fire();
    expect(b.lastAction.player).toBe("shell");
    const next = new Battle("easy", 2, MISSIONS[0].config);
    expect(next.player.hp).toBe(100);
    expect(next.player.repairs).toBe(1);
  });
  it("modern air uses one shared budget, WWII permits its two different supports", () => {
    const b = new Battle();
    expect(b.requestAir("helicopter", 1000)).toBe(true);
    b.pendingAir = null;
    b.phase = "aim";
    expect(b.requestAir("bomber", 1000)).toBe(false);
    const w = new Battle("hard", 1, MISSIONS[2].config);
    expect(w.requestAir("artillery", 1000)).toBe(true);
    w.pendingAir = null;
    w.phase = "aim";
    expect(w.requestAir("propeller", 1000)).toBe(true);
    expect(w.player.airRemaining).toBe(0);
  });
  it("armor resists HE while AP penetrates and cover applies to both sides", () => {
    const m = MISSIONS[1];
    const a = new Battle("normal", 1, m.config),
      b = new Battle("normal", 1, m.config);
    hit(a);
    hit(b, "ap");
    expect(100 - a.ai.hp).toBe(17);
    expect(100 - b.ai.hp).toBe(26);
    const c = new Battle("normal", 1, m.config);
    c.ai.cover = true;
    hit(c);
    expect(100 - c.ai.hp).toBe(11);
    expect(c.ai.cover).toBe(false);
  });
  it("smoke affects the actual launch and expires after the next attack", () => {
    const b = new Battle("normal", 1, MISSIONS[1].config);
    b.ai.smoke = true;
    b.aim(45, 55);
    b.fire();
    expect([b.player.angle, b.player.power]).not.toEqual([45, 55]);
    expect(b.projectile).not.toBeNull();
    hit(b);
    expect(b.ai.smoke).toBe(false);
  });
  it("fortress blocks damage below 40 until AP breaches its structure, then permits defeat", () => {
    const b = new Battle("hard", 1, MISSIONS[2].config);
    b.ai.hp = 40;
    hit(b);
    expect(b.ai.hp).toBe(40);
    expect(b.canMove(1, "ai")).toBe(false);
    hit(b, "ap");
    hit(b, "ap");
    expect(b.fortified).toBe(true);
    hit(b, "ap");
    expect(b.fortified).toBe(false);
    expect(b.ai.hp).toBeLessThan(40);
    hit(b, "ap");
    expect(b.ai.hp).toBe(0);
  });
  it("terrain destruction is an alternate fortress breach route", () => {
    const b = new Battle("hard", 1, MISSIONS[2].config);
    for (let i = 1035; i <= 1105; i++) b.terrain[i] += 19;
    expect(b.breachProgress).toBe(1);
    expect(b.fortified).toBe(false);
  });
  it("a mission cannot win on remaining HP at the turn limit", () => {
    const b = new Battle("easy", 1, MISSIONS[0].config);
    b.round = 40;
    b.turn = "ai";
    b.player.hp = 100;
    b.ai.hp = 50;
    (b as unknown as { nextTurn: Function }).nextTurn();
    expect(b.result?.outcome).toBe("defeat");
  });
});
describe("versioned campaign progress", () => {
  it("unlocks in order, preserves best grade and rewards only the first completion", () => {
    let p = freshProgress();
    expect(completeMission(p, "iron", victory)).toEqual(p);
    for (const m of MISSIONS) p = completeMission(p, m.id, victory);
    expect(p.supplies).toBe(800);
    expect(p.unlocked).toHaveLength(4);
    p = completeMission(p, "normandy", { ...victory, hp: 10 });
    expect(p.supplies).toBe(800);
    expect(p.grades.normandy).toBe("S");
  });
  it("loss, draw and HP-only verdict never unlock", () => {
    for (const r of [
      { ...victory, outcome: "defeat" as const },
      { ...victory, outcome: "draw" as const },
      { ...victory, enemyHp: 1 },
    ])
      expect(
        completeMission(freshProgress(), "normandy", r).completed,
      ).toHaveLength(0);
  });
  it.each([
    null,
    42,
    [],
    { version: 9 },
    { version: 1, completed: ["shadow"], unlocked: ["shadow"], supplies: 9999 },
    { version: 1, completed: "normandy" },
  ])("recovers from corrupt or unsupported data %j", (raw) =>
    expect(normalizeProgress(raw)).toEqual(freshProgress()),
  );
  it("repairs inconsistent values and rejects unknown mission IDs", () => {
    const p = normalizeProgress({
      version: 1,
      completed: ["normandy", "bogus"],
      grades: { normandy: "X" },
      current: "bogus",
      transitionSeen: true,
    });
    expect(p.supplies).toBe(100);
    expect(p.grades.normandy).toBe("B");
    expect(p.unlocked).toEqual(["normandy", "iron"]);
    expect(p.transitionSeen).toBe(false);
  });
  it("uses a separate key and handles blocked browser storage", () => {
    const values = new Map([
      ["crater.settings", "settings"],
      ["crater.records", "records"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => values.get(k),
      setItem: (k: string, v: string) => values.set(k, v),
    });
    expect(saveCampaign(freshProgress())).toBe(true);
    expect(values.get("crater.settings")).toBe("settings");
    expect(values.get("crater.records")).toBe("records");
    values.set(CAMPAIGN_KEY, "{bad");
    expect(loadCampaign()).toEqual(freshProgress());
    vi.stubGlobal("localStorage", {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    });
    expect(loadCampaign()).toEqual(freshProgress());
    expect(saveCampaign(freshProgress())).toBe(false);
  });
});
it("campaign results never replace or trim the existing free battle log", async () => {
  const { saveRecord } = await import("./storage");
  const old = JSON.stringify(
    Array.from({ length: 20 }, (_, i) => ({ ...victory, id: "legacy-" + i })),
  );
  let value = old;
  vi.stubGlobal("localStorage", {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
  });
  saveRecord({ ...victory, missionId: "normandy" });
  expect(value).toBe(old);
  saveRecord({ ...victory, id: "new-free" });
  expect(JSON.parse(value)[0].id).toBe("new-free");
  expect(JSON.parse(value)).toHaveLength(20);
});
it("initial HP and destruction-only victory follow injected config rather than mission ID", () => {
  const b = new Battle("easy", 1, {
    ...FREE_BATTLE,
    initialHp: { player: 75, ai: 75 },
    winCondition: "destroy",
  });
  expect(b.player.hp).toBe(75);
  expect(b.ai.hp).toBe(75);
  b.round = 40;
  b.turn = "ai";
  (b as unknown as { nextTurn: Function }).nextTurn();
  expect(b.result?.outcome).toBe("defeat");
});
