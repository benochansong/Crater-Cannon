import { describe, it, expect, vi, afterEach } from "vitest";
import {
  Battle,
  STEP,
  WIDTH,
  muzzle,
  launch,
  advance,
  advanceMissile,
  support,
  carve,
  solveShot,
  planAI,
  seeded,
} from "./engine";
import type { Difficulty, WeaponId } from "./engine";
import { choosePlayerSide, mirrorTerrain, gunRotation } from "./sides";
import {
  guideLevel,
  migrateAimGuide,
  predictAim,
  visibleGuide,
  PredictionCache,
} from "./aimPrediction";
import { loadSettings, saveSettings, defaults } from "./storage";
import { MISSIONS } from "./campaign";
import { trainingConfig } from "./training";
import { makeOperation, airPosition } from "./airSupport";
import { analyzeImpact } from "./shotHistory";
const pair = () =>
  [
    new Battle("normal", 31, undefined, "left"),
    new Battle("normal", 31, undefined, "right"),
  ] as const;
afterEach(() => vi.unstubAllGlobals());
describe("9.1 guidance and migration", () => {
  it.each([
    [undefined, "balanced"],
    ["default", "balanced"],
    ["extended", "beginner"],
    ["off", "off"],
    ["beginner", "beginner"],
    ["expert", "expert"],
    ["balanced", "balanced"],
    ["broken", "balanced"],
    [null, "balanced"],
  ])("migrates %s to %s", (old, next) => {
    expect(migrateAimGuide(old)).toBe(next);
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({ aimGuide: old, volume: 0.3, difficulty: "hard" }),
    });
    expect(loadSettings()).toMatchObject({
      aimGuide: next,
      volume: 0.3,
      difficulty: "hard",
    });
  });
  it("survives corrupt or unavailable storage and preserves chosen values", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "{bad",
      setItem: () => {
        throw Error("quota");
      },
    });
    expect(loadSettings()).toEqual(defaults);
    expect(() => saveSettings(defaults)).not.toThrow();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("denied");
      },
    });
    expect(loadSettings()).toEqual(defaults);
  });
  it.each(["easy", "normal", "hard"] as Difficulty[])(
    "does not couple guidance to %s AI",
    (difficulty) => {
      const b = new Battle(difficulty, 31);
      expect(guideLevel(b, "balanced")).toBe("partial");
      expect(guideLevel(b, "beginner")).toBe("full");
      expect(guideLevel(b, "expert")).toBe("short");
      expect(guideLevel(b, "off")).toBe("off");
      for (const mode of ["balanced", "beginner", "expert", "off"] as const)
        expect(
          guideLevel(new Battle(difficulty, 31, trainingConfig("A")), mode),
        ).toBe("full");
    },
  );
  it("shows about 67 percent with a fading tail without changing exact internal physics", () => {
    const b = new Battle("normal", 31);
    b.aim(65, 65);
    b.wind = 0;
    const p = predictAim(b)!,
      full = visibleGuide(p, "full"),
      shown = visibleGuide(p, "partial");
    expect(shown.length).toBeGreaterThan(10);
    expect(shown.at(-1)!.t / (p.steps * STEP)).toBeGreaterThan(0.63);
    expect(shown.at(-1)!.t / (p.steps * STEP)).toBeLessThanOrEqual(0.67);
    expect(shown[0].alpha).toBe(1);
    expect(shown.at(-1)!.alpha).toBeCloseTo(0.04);
    expect(full.length).toBe(p.points.length);
    expect(full.every((q) => q.alpha === 1)).toBe(true);
    expect(visibleGuide(p, "off")).toEqual([]);
    expect(p.impact).not.toBeNull();
  });
  it.each([10, 20, 30, 45, 65, 80])(
    "stops safely ahead of near collisions at %s degrees",
    (angle) => {
      const b = new Battle("normal", 31);
      b.terrain.fill(450);
      b.player.y = support(b.terrain, b.player.x);
      b.ai.x = b.player.x + 160;
      b.ai.y = b.player.y;
      b.aim(angle, 20);
      b.wind = 0;
      const p = predictAim(b)!,
        shown = visibleGuide(p, "partial");
      for (const q of shown) {
        expect(q.t).toBeLessThanOrEqual(
          Math.max(0, p.steps * STEP - 0.35) + 1e-9,
        );
        expect(
          Math.hypot(q.x - p.impact!.x, q.y - p.impact!.y),
        ).toBeGreaterThanOrEqual(100);
        expect(
          Math.hypot(q.x - b.ai.x, q.y - (b.ai.y - 8)),
        ).toBeGreaterThanOrEqual(100);
      }
    },
  );
  it("refreshes cache on facing changes without consuming combat randomness", () => {
    const [b, twin] = pair(),
      c = new PredictionCache();
    const first = c.get(b);
    const before = JSON.stringify(b);
    for (let i = 0; i < 100; i++) expect(c.get(b)).toBe(first);
    expect(JSON.stringify(b)).toBe(before);
    expect(b.random()).toBe(twin.random());
    b.player.facing = -1;
    expect(c.get(b)).not.toBe(first);
    expect(c.calculations).toBe(2);
  });
});
describe("9.1 random placement and mode isolation", () => {
  it("uses a deterministic independent near-even hash across 10000 seeds, with repeated sides", () => {
    const a = Array.from({ length: 10000 }, (_, i) => choosePlayerSide(i));
    const left = a.filter((x) => x === "left").length;
    expect(left).toBeGreaterThan(4800);
    expect(left).toBeLessThan(5200);
    expect(a.some((x, i) => i > 0 && x === a[i - 1])).toBe(true);
    expect(a).toEqual(
      Array.from({ length: 10000 }, (_, i) => choosePlayerSide(i)),
    );
    for (let seed = 1; seed <= 50; seed++)
      expect(new Battle("easy", seed).placement).toBe(choosePlayerSide(seed));
  });
  it("mirrors heightmap and spawn support while preserving world wind and RNG", () => {
    const [a, b] = pair();
    expect(b.terrain).toEqual(mirrorTerrain(a.terrain));
    expect(b.originalTerrain).toEqual(b.terrain);
    expect(b.originalTerrain).not.toBe(b.terrain);
    for (let i = 0; i < 2; i++) {
      expect(a.tanks[i].x + b.tanks[i].x).toBe(WIDTH);
      expect(a.tanks[i].y).toBeCloseTo(b.tanks[i].y, 8);
      expect(b.tanks[i].y).toBe(support(b.terrain, b.tanks[i].x));
      expect(a.tanks[i].facing).toBe(-b.tanks[i].facing);
    }
    expect(b.wind).toBe(a.wind);
    for (let i = 0; i < 20; i++) expect(b.random()).toBe(a.random());
  });
  it.each(MISSIONS.map((m) => [m.id, m.config] as const))(
    "keeps campaign %s fixed",
    (_, config) => {
      const a = new Battle("normal", 31, config, "left"),
        b = new Battle("normal", 31, config, "right");
      expect(b.placement).toBe("left");
      expect(b.terrain).toEqual(a.terrain);
      expect(b.tanks).toEqual(a.tanks);
      expect(b.config).toBe(config);
    },
  );
  it.each(["A", "B", "C"] as const)("keeps training %s fixed", (target) => {
    const a = new Battle("easy", 31, trainingConfig(target), "left"),
      b = new Battle("easy", 31, trainingConfig(target), "right");
    expect(b.placement).toBe("left");
    expect(b.terrain).toEqual(a.terrain);
    expect(b.tanks).toEqual(a.tanks);
  });
});
describe("9.1 bidirectional actual physics", () => {
  for (const wind of [-5, 0, 5])
    for (const weapon of ["shell", "crater", "shock", "missile"] as WeaponId[])
      it(`${weapon} mirrors every physics step and collision with opposite wind ${wind}`, () => {
        const [a, b] = pair();
        a.wind = wind;
        b.wind = -wind;
        for (const g of [a, b]) g.aim(58, 62);
        const p = launch(a.player, weapon),
          q = launch(b.player, weapon);
        expect(muzzle(a.player).x + muzzle(b.player).x).toBeCloseTo(WIDTH, 8);
        expect(p.vx).toBe(-q.vx);
        expect(p.vy).toBe(q.vy);
        expect(p.vy).toBeLessThan(0);
        if (weapon === "missile") {
          p.guided = q.guided = true;
          p.target = q.target = "ai";
        }
        const step = weapon === "missile" ? advanceMissile : advance;
        let h = null,
          k = null;
        for (let i = 0; i < 1441; i++) {
          h = step(p, a.terrain, a.tanks, wind);
          k = step(q, b.terrain, b.tanks, -wind);
          expect(p.x + q.x).toBeCloseTo(WIDTH, 5);
          expect(p.y).toBeCloseTo(q.y, 5);
          expect(!!h).toBe(!!k);
          if (h) break;
        }
        expect(h).not.toBeNull();
        expect(k?.direct).toBe(h?.direct);
        expect(k?.escaped).toBe(h?.escaped);
        if (h && k && !h.escaped) {
          carve(a.terrain, h.x, h.y, weapon);
          carve(b.terrain, k.x, k.y, weapon);
          for (let i = 0; i <= WIDTH; i++)
            expect(a.terrain[i]).toBeCloseTo(b.terrain[WIDTH - i], 5);
        }
      });
  it.each(["easy", "normal", "hard"] as Difficulty[])(
    "keeps %s AI noise and correction equivalent after mirroring",
    (difficulty) => {
      const [a, b] = pair();
      a.wind = 3;
      b.wind = -3;
      const ma = { bias: 4, lastMiss: 100, shots: 2 },
        mb = { bias: 4, lastMiss: -100, shots: 2 };
      const p = planAI(
          a.ai,
          a.player,
          a.terrain,
          a.wind,
          difficulty,
          ma,
          seeded(72),
        ),
        q = planAI(
          b.ai,
          b.player,
          b.terrain,
          b.wind,
          difficulty,
          mb,
          seeded(72),
        );
      expect(q).toEqual(p);
      expect(mb).toEqual(ma);
    },
  );
  it.each(["left", "right"] as const)(
    "fires a real direct shot and preserves A/D world direction on %s",
    (side) => {
      const b = new Battle("easy", 31, undefined, side);
      const x = b.player.x;
      b.adjust(1);
      for (let i = 0; i < 100; i++) b.update(STEP);
      b.adjust(0);
      for (let i = 0; i < 60; i++) b.update(STEP);
      expect(b.player.x).toBeGreaterThan(x);
      const plan = solveShot(b.player, b.ai, b.terrain, b.wind);
      b.aim(plan.angle, plan.power);
      const predicted = predictAim(b)!;
      expect(predicted.impact?.direct).toBe("ai");
      expect(b.fire()).toBe(true);
      for (let i = 0; i < 2000 && !b.shotHistory.length; i++) b.update(STEP);
      expect(b.shotHistory[0].impact).toEqual(predicted.impact);
      expect(b.shotHistory[0].reason).toBe("direct");
      expect(b.ai.hp).toBeLessThan(100);
      const event = b.events.find((e) => e.type === "shot");
      expect(event?.facing).toBe(side === "left" ? 1 : -1);
      expect(Math.sin(gunRotation(45, b.player.facing))).toBeLessThan(0);
    },
  );
  it.each(["left", "right"] as const)(
    "launches drone from owner and permits shield on %s",
    (side) => {
      const b = new Battle("easy", 31, undefined, side);
      b.select("drone");
      expect(b.fire()).toBe(true);
      expect(b.drone!.x).toBe(b.player.x);
      const c = new Battle("easy", 31, undefined, side);
      expect(c.activateShield()).toBe(true);
      expect(c.player.shields).toBe(1);
    },
  );
  it.each(["helicopter", "bomber"] as const)(
    "mirrors %s approach and impact schedule without changing resources",
    (kind) => {
      const [a, b] = pair();
      expect(a.requestAir(kind, a.ai.x)).toBe(true);
      expect(b.requestAir(kind, b.ai.x)).toBe(true);
      expect(a.player.support[kind]).toBe(b.player.support[kind]);
      const p = makeOperation(a.pendingAir!),
        q = makeOperation(b.pendingAir!);
      for (let i = 0; i < 3; i++) {
        expect(p.impacts[i].x + q.impacts[i].x).toBe(WIDTH);
        expect(p.impacts[i].time).toBeCloseTo(q.impacts[i].time, 8);
      }
      for (const age of [0, 0.7, 1.5, 2.5, 3.5, 4.5]) {
        p.age = q.age = age;
        expect(airPosition(p).x + airPosition(q).x).toBeCloseTo(WIDTH, 8);
        expect(airPosition(p).y).toBe(airPosition(q).y);
      }
    },
  );
  it("classifies mirrored past range errors identically", () => {
    const [a, b] = pair(),
      p = predictAim(a)!.setup,
      q = predictAim(b)!.setup;
    for (const x of [800, 1200]) {
      const h = { x, y: a.ai.y + 20, direct: null, escaped: false },
        k = { ...h, x: WIDTH - x };
      expect(analyzeImpact(p, h, 50)).toBe(analyzeImpact(q, k, 50));
    }
  });
});
it.each(["left", "right"] as const)(
  "9.1 long move and EMP remain world-directed on %s",
  (side) => {
    const b = new Battle("easy", 31, undefined, side);
    b.terrain.fill(450);
    for (const t of b.tanks) t.y = support(b.terrain, t.x);
    const x = b.player.x;
    const direction = side === "left" ? 1 : -1;
    expect(b.move(direction)).toBe(true);
    for (let i = 0; i < 220; i++) b.update(STEP);
    expect((b.player.x - x) * direction).toBeCloseTo(145, 5);
    const c = new Battle("easy", 31, undefined, side);
    c.select("missile");
    c.lockTarget("ai");
    expect(c.fire()).toBe(true);
    expect(c.projectile!.vx * direction).toBeGreaterThan(0);
    expect(c.useEmp("ai")).toBe(true);
    expect(c.projectile!.guided).toBe(false);
    expect(c.ai.emp).toBe(1);
    expect(c.useEmp("ai")).toBe(false);
  },
);
