import { mkdirSync, writeFileSync } from "node:fs";
import {
  Battle,
  WEAPON_IDS,
  advance,
  blastDamage,
  clamp,
  launch,
  planAI,
  seeded,
  solveShot,
} from "../src/game/engine";
import type { Difficulty, Stats, WeaponId } from "../src/game/engine";
const count = Number(process.env.BALANCE_MATCHES ?? 20);
if (!Number.isInteger(count) || count < 1)
  throw new Error("BALANCE_MATCHES must be a positive integer");
const difficulties: Difficulty[] = ["easy", "normal", "hard"];
const results = [];
const firstShot = [];
// Compare old and new decision errors on the same fixed terrain/wind seeds.
for (const difficulty of difficulties) {
  let oldHits = 0,
    newHits = 0,
    oldDirect = 0,
    newDirect = 0;
  for (let i = 1; i <= 40; i++) {
    const b = new Battle(difficulty, 7000 + i),
      random = seeded(i + 400);
    const optimal = solveShot(b.ai, b.player, b.terrain, b.wind);
    const spread =
      difficulty === "easy" ? 11 : difficulty === "normal" ? 5.5 : 2.4;
    const old = {
      ...optimal,
      angle: clamp(optimal.angle + (random() - 0.5) * spread, 10, 80),
      power: clamp(optimal.power + (random() - 0.5) * spread * 1.5, 20, 100),
    };
    const current = planAI(
      b.ai,
      b.player,
      b.terrain,
      b.wind,
      difficulty,
      { bias: b.aiMemory.bias, shots: 0, lastMiss: null },
      seeded(i + 400),
    );
    for (const [index, plan] of [old, current].entries()) {
      const p = launch({ ...b.ai, ...plan }, "shell");
      let hit = null;
      for (let n = 0; n < 1441 && !hit; n++)
        hit = advance(p, b.terrain, b.tanks, b.wind);
      const direct = hit?.direct === "player";
      const damage =
        hit && !hit.escaped
          ? blastDamage(
              Math.hypot(hit.x - b.player.x, hit.y - b.player.y + 8),
              "shell",
              direct,
            )
          : 0;
      if (index === 0) {
        if (damage > 0) oldHits++;
        if (direct) oldDirect++;
      } else {
        if (damage > 0) newHits++;
        if (direct) newDirect++;
      }
    }
  }
  firstShot.push({
    difficulty,
    samples: 40,
    phase2HitRate: oldHits / 40,
    phase3HitRate: newHits / 40,
    phase2DirectRate: oldDirect / 40,
    phase3DirectRate: newDirect / 40,
  });
}
for (const difficulty of difficulties) {
  let wins = 0,
    draws = 0,
    timeouts = 0,
    seconds = 0,
    shots = 0,
    hits = 0,
    direct = 0,
    emp = 0;
  const weapons = Object.fromEntries(
    WEAPON_IDS.map((id) => [id, { shots: 0, hits: 0, direct: 0, damage: 0 }]),
  ) as Record<WeaponId, Stats>;
  for (let i = 1; i <= count; i++) {
    const b = new Battle(difficulty, 10000 + i),
      random = seeded(90000 + i);
    let plannedDefense = -1,
      shouldDefend = false,
      droneOffset = 0;
    for (let tick = 0; tick < 9000 && !b.result; tick++) {
      if (b.phase === "aim") {
        const aim = solveShot(b.player, b.ai, b.terrain, b.wind);
        let weapon: WeaponId = "shell";
        const roll = random();
        if (roll < 0.15 && b.player.ammo.drone > 0) weapon = "drone";
        else if (roll < 0.3 && b.player.ammo.missile > 0) weapon = "missile";
        else if (roll < 0.4 && b.player.ammo.crater > 0) weapon = "crater";
        else if (roll < 0.5 && b.player.ammo.shock > 0) weapon = "shock";
        b.select(weapon);
        b.aim(
          clamp(aim.angle + (random() - 0.5) * 8, 10, 80),
          clamp(aim.power + (random() - 0.5) * 10, 20, 100),
        );
        if (weapon === "missile") {
          b.lockTarget("ai");
          b.aim(35, 55);
        }
        droneOffset = (random() - 0.5) * 50;
        b.fire();
      }
      if (b.canEmp("player")) {
        if (plannedDefense !== b.combat.ai.shots) {
          plannedDefense = b.combat.ai.shots;
          shouldDefend = random() < 0.65;
        }
        if (shouldDefend && b.defense!.remaining < 1.4) b.useEmp("player");
      }
      if (b.phase === "drone" && b.turn === "player" && b.drone) {
        const d = b.drone,
          dx = b.ai.x + droneOffset - d.x,
          dy = (Math.abs(dx) > 60 ? 210 : b.ai.y - 12) - d.y,
          length = Math.max(1, Math.hypot(dx, dy));
        b.steerDrone(dx / length, dy / length);
        if (Math.abs(dx) < 15 && Math.abs(dy) < 15) b.attackDrone();
      }
      b.update(1 / 30);
      b.drainEvents();
    }
    if (!b.result) timeouts++;
    else if (b.result.outcome === "defeat") wins++;
    else if (b.result.outcome === "draw") draws++;
    seconds += b.elapsed;
    shots += b.combat.ai.shots;
    hits += b.combat.ai.hits;
    direct += b.combat.ai.direct;
    emp += b.defenses.ai;
    for (const id of WEAPON_IDS)
      for (const key of ["shots", "hits", "direct", "damage"] as const)
        weapons[id][key] += b.telemetry.ai[id][key];
  }
  const row = {
    difficulty,
    matches: count,
    aiWinRate: wins / count,
    draws,
    timeouts,
    aiHitRate: hits / shots,
    aiDirectRate: direct / shots,
    meanSeconds: seconds / count,
    meanAIEMP: emp / count,
    weapons: Object.fromEntries(
      WEAPON_IDS.map((id) => [
        id,
        {
          ...weapons[id],
          usageShare: weapons[id].shots / shots,
          damagePerUse: weapons[id].shots
            ? weapons[id].damage / weapons[id].shots
            : 0,
        },
      ]),
    ),
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
const report = {
  date: "2026-11-22",
  method: `Same ${count} fixed seeds per difficulty. Player benchmark: exact solver plus angle ±4°, power ±5, mixed weapons, 65% EMP response, public drone controls. No HP/positions/turn outcome injection. Time excludes human thinking.`,
  firstShot,
  results,
};
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/balance-phase3.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log("FIRST_SHOT", JSON.stringify(firstShot));
