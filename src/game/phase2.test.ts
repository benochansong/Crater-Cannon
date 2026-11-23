import { describe, it, expect, vi } from "vitest";
import { Camera } from "./camera";
import {
  Battle,
  HEIGHT,
  WIDTH,
  advance,
  chooseWeapon,
  launch,
  STEP,
} from "./engine";
import { Renderer } from "./renderer";
import {
  defaults,
  loadRecords,
  loadSettings,
  saveRecord,
  saveSettings,
} from "./storage";
describe("Phase 2 camera and effects", () => {
  it("keeps a high arc and both tank positions visible and returns to aim view", () => {
    const b = new Battle("normal", 1),
      c = new Camera();
    const p = launch({ ...b.player, angle: 80, power: 100 }, "shell");
    for (let i = 0; i < 600; i++) {
      const hit = advance(p, b.terrain, b.tanks, 0);
      c.update(p, STEP, false);
      const pos = c.toScreen(p);
      if (!hit) {
        expect(pos.y).toBeGreaterThan(0);
        expect(pos.y).toBeLessThan(HEIGHT);
      }
      for (const t of b.tanks) {
        const s = c.toScreen(t);
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(WIDTH);
      }
      if (hit) break;
    }
    for (let i = 0; i < 800; i++) c.update(null, STEP, false);
    expect(c.scale).toBeCloseTo(1, 3);
    expect(c.x).toBeCloseTo(0, 0);
  });
  it("inverts camera coordinates accurately for aiming", () => {
    const c = new Camera();
    c.scale = 0.6;
    c.x = 240;
    c.y = 256;
    const original = { x: 280, y: 400 };
    expect(c.toWorld(c.toScreen(original))).toEqual(original);
  });
  it("bounds particle memory and hitstop, with a clean renderer on retry", () => {
    vi.stubGlobal("document", {
      createElement: () => ({ width: 0, height: 0 }),
    });
    const r = new Renderer();
    for (let i = 0; i < 30; i++)
      r.event({
        type: "explosion",
        x: 700,
        y: 500,
        weapon: "crater",
        direct: true,
      });
    expect(r.particles.length).toBeLessThanOrEqual(240);
    expect(r.simulationDelta(0.1)).toBeCloseTo(0.045);
    expect(r.simulationDelta(0.1)).toBe(0.1);
    const fresh = new Renderer();
    expect(fresh.particles).toHaveLength(0);
    expect(fresh.bursts).toHaveLength(0);
    expect(fresh.camera.scale).toBe(1);
    vi.unstubAllGlobals();
  });
  it("retains original grass heights while destruction changes actual terrain", () => {
    const b = new Battle("normal", 31, undefined, "left");
    const original = b.originalTerrain[200];
    b.terrain[200] += 50;
    expect(b.originalTerrain[200]).toBe(original);
  });
});
describe("fair tactical AI", () => {
  it("uses shells for finishing shots and low own health", () => {
    const b = new Battle("normal", 31, undefined, "left");
    b.player.hp = 30;
    expect(chooseWeapon(b.ai, b.player, b.terrain, "hard", () => 0)).toBe(
      "shell",
    );
    b.player.hp = 100;
    b.ai.hp = 20;
    expect(chooseWeapon(b.ai, b.player, b.terrain, "hard", () => 0)).toBe(
      "shell",
    );
  });
  it("uses shock on slopes, crater on high ground, and respects ammo", () => {
    const b = new Battle("normal", 31, undefined, "left");
    for (let x = 0; x <= WIDTH; x++) b.terrain[x] = 350 + x * 0.3;
    expect(chooseWeapon(b.ai, b.player, b.terrain, "hard", () => 0)).toBe(
      "shock",
    );
    b.terrain.fill(400);
    expect(chooseWeapon(b.ai, b.player, b.terrain, "hard", () => 0)).toBe(
      "crater",
    );
    b.ai.ammo.crater = 0;
    b.ai.ammo.shock = 0;
    expect(chooseWeapon(b.ai, b.player, b.terrain, "hard", () => 0)).toBe(
      "shell",
    );
    expect(chooseWeapon(b.ai, b.player, b.terrain, "easy", () => 0)).toBe(
      "shell",
    );
  });
});
describe("storage resilience", () => {
  it("falls back when storage is corrupt or denied", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "{broken",
      setItem: () => {
        throw Error("denied");
      },
    });
    expect(loadSettings()).toEqual(defaults);
    expect(loadRecords()).toEqual([]);
    expect(() => saveSettings(defaults)).not.toThrow();
    vi.unstubAllGlobals();
  });
  it("validates settings types and safely clamps volumes", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          volume: 9,
          difficulty: "impossible",
          muted: "false",
          shake: 0,
        }),
    });
    expect(loadSettings()).toEqual({ ...defaults, volume: 1 });
    vi.unstubAllGlobals();
  });
  it("deduplicates result records and rejects malformed entries", () => {
    let stored = JSON.stringify([{ id: "broken", outcome: "victory" }]);
    vi.stubGlobal("localStorage", {
      getItem: () => stored,
      setItem: (_: string, value: string) => {
        stored = value;
      },
    });
    expect(loadRecords()).toEqual([]);
    const r = {
      id: "ok",
      outcome: "victory" as const,
      hp: 50,
      enemyHp: 0,
      shots: 5,
      hits: 4,
      direct: 2,
      damage: 100,
      seconds: 90,
      difficulty: "normal" as const,
      date: new Date().toISOString(),
    };
    saveRecord(r);
    saveRecord(r);
    expect(loadRecords()).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
