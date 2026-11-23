import { describe, it, expect, vi, afterEach } from "vitest";
import { Battle, advance, launch, STEP, solveShot, carve } from "./engine";
import type { WeaponId, Impact } from "./engine";
import { MISSIONS } from "./campaign";
import { predictAim, PredictionCache, guideLevel } from "./aimPrediction";
import { analyzeImpact, shotMessage } from "./shotHistory";
import { trainingConfig, loadTraining, saveTraining } from "./training";
import { loadSettings, loadRecords } from "./storage";
import {
  completeMission,
  freshProgress,
  normalizeProgress,
} from "./campaignStorage";
const practice = () => new Battle("easy", 31, trainingConfig("A"));
function finish(b: Battle) {
  for (let i = 0; i < 2200 && b.phase !== "aim"; i++) b.update(STEP);
  expect(b.phase).toBe("aim");
}
function shot(b: Battle, angle = 45, power = 35) {
  b.aim(angle, power);
  expect(b.fire()).toBe(true);
  finish(b);
}
afterEach(() => vi.unstubAllGlobals());
describe("same-physics prediction", () => {
  for (const weapon of ["shell", "ap", "crater", "shock"] as WeaponId[])
    for (const wind of [-5, 0, 5])
      it(
        weapon +
          " wind " +
          wind +
          " matches every sampled point and final collision",
        () => {
          const b = new Battle(
            "easy",
            31,
            weapon === "ap" ? MISSIONS[0].config : trainingConfig("A"),
          );
          b.weapon = weapon;
          b.wind = wind;
          b.aim(57, 60);
          const predicted = predictAim(b)!;
          const p = launch(b.player, weapon);
          const points = [{ x: p.x, y: p.y }];
          let impact: Impact | null = null;
          for (let i = 0; i < 1441; i++) {
            impact = advance(p, b.terrain, b.collisionTargets, b.wind);
            if (i % 8 === 0 || impact) points.push({ x: p.x, y: p.y });
            if (impact) break;
          }
          expect(predicted.points).toEqual(points);
          expect(predicted.impact).toEqual(impact);
          expect(predicted.steps).toBeLessThanOrEqual(1441);
        },
      );
  it("matches real Battle.fire and lastImpact for five changing shots", () => {
    const b = practice();
    for (const [a, p] of [
      [35, 28],
      [45, 37],
      [62, 49],
      [25, 55],
      [78, 95],
    ]) {
      b.aim(a, p);
      const expected = predictAim(b)!;
      expect(b.fire()).toBe(true);
      finish(b);
      expect(b.lastImpact.player).toEqual(expected.impact);
      expect(b.shotHistory[0].impact).toEqual(expected.impact);
    }
  });
  it("predicts direct tank collision with actual size", () => {
    const b = practice(),
      plan = solveShot(b.player, b.ai, b.terrain, b.wind);
    b.aim(plan.angle, plan.power);
    expect(predictAim(b)!.impact?.direct).toBe("ai");
    b.fire();
    finish(b);
    expect(b.shotHistory[0].reason).toBe("direct");
    expect(b.trainingStats!.hits).toBe(1);
  });
  it("uses facility collision and boss dimensions", () => {
    const b = new Battle("easy", 31, MISSIONS[5].config);
    const plan = solveShot(
      b.player,
      b.facility!,
      b.terrain,
      b.wind,
      b.collisionTargets,
    );
    b.aim(plan.angle, plan.power);
    expect(predictAim(b)!.impact?.direct).toBe("objective");
    const boss = new Battle("hard", 31, MISSIONS[7].config);
    const q = solveShot(boss.player, boss.ai, boss.terrain, boss.wind);
    boss.aim(q.angle, q.power);
    expect(predictAim(boss)!.impact?.direct).toBe("ai");
  });
  it("never consumes battle RNG or mutates time, ammo, terrain, stats or bodies", () => {
    const b = practice(),
      twin = practice();
    const before = JSON.stringify(b);
    for (let i = 0; i < 50; i++) predictAim(b);
    expect(JSON.stringify(b)).toBe(before);
    expect(b.random()).toBe(twin.random());
  });
  it("caps escaped high trajectories and renders missile initial flight only", () => {
    const b = practice();
    b.aim(45, 100);
    expect(predictAim(b)!.impact?.escaped).toBe(true);
    b.weapon = "missile";
    const p = predictAim(b)!;
    expect(p.steps).toBeLessThanOrEqual(75);
    expect(p.impact).toBeNull();
    expect(p.special).toBe(true);
    b.weapon = "drone";
    expect(predictAim(b)).toBeNull();
  });
  it("marks smoke as uncertain without consuming random error", () => {
    const b = practice();
    b.ai.smoke = true;
    expect(predictAim(b)!.uncertain).toBe(true);
    expect(b.player.angle).toBe(45);
  });
});
describe("cache and guide policy", () => {
  it("reuses identical prediction across render frames", () => {
    const b = practice(),
      c = new PredictionCache(),
      p = c.get(b);
    for (let i = 0; i < 600; i++) expect(c.get(b)).toBe(p);
    expect(c.calculations).toBe(1);
  });
  it("invalidates controls, wind, both poses, terrain, obstacles, target and mode", () => {
    const b = practice(),
      c = new PredictionCache();
    c.get(b);
    for (const mutate of [
      () => b.aim(55, 55),
      () => b.aim(55, 65),
      () => b.wind++,
      () => b.player.x++,
      () => b.player.y++,
      () => b.ai.x++,
      () => b.ai.y++,
      () => {
        carve(b.terrain, 450, 470, "crater");
        b.terrainRevision++;
      },
      () => (b.weapon = "crater"),
      () => (b.selectedTarget = "player"),
      () => (b.ai.smoke = true),
    ]) {
      const old = c.get(b);
      mutate();
      expect(c.get(b)).not.toBe(old);
    }
    expect(c.get(b, "off")).toBeNull();
    expect(c.get(b, "extended")).not.toBeNull();
  });
  it("follows actual campaign difficulty rather than free-battle preferences", () => {
    const b = new Battle("hard", 31, MISSIONS[7].config);
    expect(guideLevel(b, "default")).toBe("short");
    expect(guideLevel(b, "extended")).toBe("full");
    b.difficulty = "normal";
    expect(guideLevel(b, "default")).toBe("partial");
    b.difficulty = "easy";
    expect(guideLevel(b, "default")).toBe("full");
  });
  it("starts at the current muzzle after genuine movement", () => {
    const b = practice(),
      c = new PredictionCache(),
      before = c.get(b)!;
    b.adjust(1);
    for (let i = 0; i < 120; i++) b.update(STEP);
    b.adjust(0);
    for (let i = 0; i < 30; i++) b.update(STEP);
    const after = c.get(b)!;
    expect(after.setup.muzzle.x).toBeGreaterThan(before.setup.muzzle.x);
    expect(after.points[0]).toEqual(after.setup.muzzle);
  });
  it("does not show endpoints with hard default or off", () => {
    const b = new Battle("hard", 31),
      c = new PredictionCache();
    expect(c.get(b)!.impact).toBeNull();
    expect(c.get(b)!.steps).toBeLessThanOrEqual(75);
    expect(c.get(b, "off")).toBeNull();
  });
});
describe("actual shot history and analysis", () => {
  it("stores the latest three actual player shots and resets with a new battle", () => {
    const b = practice();
    for (let i = 0; i < 4; i++) shot(b, 40, 30 + i * 3);
    expect(b.shotHistory.map((s) => s.sequence)).toEqual([4, 3, 2]);
    expect(b.shotHistory[0]).toMatchObject({
      weapon: "shell",
      wind: 0,
      source: { x: 180 },
      kind: "ballistic",
    });
    expect(practice().shotHistory).toEqual([]);
  });
  it("keeps historical coordinates fixed after terrain and target changes", () => {
    const b = practice();
    shot(b);
    const s = structuredClone(b.shotHistory);
    b.terrain.fill(550);
    b.terrainRevision++;
    b.ai.x = 900;
    expect(b.shotHistory).toEqual(s);
  });
  it("separates electronic shots and excludes AI history", () => {
    const b = new Battle("easy", 31);
    b.select("missile");
    b.lockTarget("ai");
    b.fire();
    for (let i = 0; i < 2200 && !b.specialHistory.length; i++) b.update(STEP);
    expect(b.specialHistory).toHaveLength(1);
    expect(b.shotHistory).toHaveLength(0);
    const ai = b.specialHistory[0];
    for (let i = 0; i < 3000 && b.phase !== "aim"; i++) b.update(STEP);
    expect(b.specialHistory[0]).toBe(ai);
    expect(b.shotHistory).toHaveLength(0);
  });
  it("distinguishes hill blockage, obstacles, near misses, range and escape", () => {
    const s = predictAim(practice())!.setup;
    s.target = { x: 800, y: 450, side: "ai" };
    const hit = (
      x: number,
      y: number,
      direct: Impact["direct"] = null,
      escaped = false,
    ) => ({ x, y, direct, escaped });
    expect(analyzeImpact(s, hit(500, 300), -5)).toBe("terrain");
    expect(analyzeImpact(s, hit(500, 440, "objective"), 5)).toBe("obstacle");
    expect(analyzeImpact(s, hit(800, 442, "ai"), 5)).toBe("direct");
    expect(analyzeImpact(s, hit(780, 460), 5)).toBe("near");
    expect(analyzeImpact(s, hit(600, 470), 5)).toBe("short");
    expect(analyzeImpact(s, hit(1000, 470), 5)).toBe("long");
    expect(analyzeImpact(s, hit(1400, 300, null, true), 5)).toBe("escape");
    expect(shotMessage("terrain")).not.toContain("높이거나");
  });
});
describe("training isolation and lessons", () => {
  it("provides near, far and high targets", () => {
    const a = practice(),
      b = new Battle("easy", 31, trainingConfig("B")),
      c = new Battle("easy", 31, trainingConfig("C"));
    expect(a.ai.x).toBeLessThan(b.ai.x);
    expect(c.ai.y).toBeLessThan(a.ai.y - 100);
  });
  it("never counterattacks or ends and keeps infinite ammunition", () => {
    const b = practice();
    for (let i = 0; i < 5; i++) {
      const p = solveShot(b.player, b.ai, b.terrain, b.wind);
      shot(b, p.angle, p.power);
    }
    expect(b.result).toBeNull();
    expect(b.combat.ai.shots).toBe(0);
    expect(b.player.hp).toBe(100);
    expect(b.ai.hp).toBe(100);
    expect(b.player.ammo.shell).toBe(Infinity);
    expect(b.trainingStats).toMatchObject({
      shots: 5,
      hits: 5,
      direct: 5,
      streak: 5,
      bestStreak: 5,
      errorCount: 5,
    });
  });
  it("locks only the learning variable and disallows wind changes in flight", () => {
    const b = practice();
    b.setTrainingLesson(1);
    b.aim(70, 70);
    expect(b.player.angle).toBe(45);
    expect(b.player.power).toBe(70);
    b.setTrainingLesson(2);
    b.aim(60, 30);
    expect(b.player.angle).toBe(60);
    expect(b.player.power).toBe(70);
    b.setTrainingLesson(3);
    expect(b.wind).toBe(3);
    b.setTrainingLesson(0);
    b.fire();
    b.setTrainingWind(-5);
    expect(b.wind).toBe(3);
  });
  it("persists separate sessions, validates settings and preserves existing records", () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
    });
    const b = practice();
    shot(b);
    saveTraining(b.trainingStats!);
    saveTraining(b.trainingStats!);
    expect(loadTraining()).toHaveLength(1);
    expect(loadRecords()).toEqual([]);
    expect(map.has("crater.campaign.v1")).toBe(false);
    map.set("crater.settings", JSON.stringify({ aimGuide: "extended" }));
    expect(loadSettings().aimGuide).toBe("extended");
    map.set("crater.settings", JSON.stringify({ aimGuide: "wrong" }));
    expect(loadSettings().aimGuide).toBe("default");
    map.set("crater.training.v1", '[{"shots":99},null]');
    expect(loadTraining()).toEqual([]);
  });
  it("persists assisted campaign history without changing rewards", () => {
    const r = {
      id: "a",
      date: "today",
      outcome: "victory" as const,
      missionId: "normandy",
      hp: 80,
      enemyHp: 0,
      seconds: 30,
      difficulty: "easy" as const,
      shots: 3,
      hits: 3,
      direct: 3,
      damage: 100,
      assisted: true,
    };
    const p = completeMission(freshProgress(), "normandy", r);
    expect(p.supplies).toBe(100);
    expect(normalizeProgress(p).assisted).toEqual(["normandy"]);
  });
});

it("training resets spent mobility and counts an in-flight shot immediately", () => {
  const b = practice();
  b.adjust(1);
  for (let i = 0; i < 300; i++) b.update(STEP);
  b.adjust(0);
  for (let i = 0; i < 30; i++) b.update(STEP);
  expect(b.player.mobility.remaining).toBe(0);
  expect(b.player.mobility.used).toBe(true);
  b.aim(45, 35);
  expect(b.fire()).toBe(true);
  expect(b.trainingStats!.shots).toBe(1);
  expect(b.trainingStats!.errorCount).toBe(0);
  finish(b);
  expect(b.player.mobility.remaining).toBe(60);
  expect(b.player.mobility.used).toBe(false);
  expect(b.player.mobility.reason).toBe("");
});
