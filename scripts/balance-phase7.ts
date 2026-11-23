import { writeFileSync } from "node:fs";
import { Battle, solveShot, seeded, clamp, STEP } from "../src/game/engine";
import { MISSIONS } from "../src/game/campaign";
import { FREE_BATTLE } from "../src/game/eras";
const results = [];
for (const scenario of [
  ...MISSIONS.slice(0, 6).map((m) => ({
    id: m.id,
    difficulty: m.difficulty,
    config: m.config,
  })),
  ...(["easy", "normal", "hard"] as const).map((difficulty) => ({
    id: "free-" + difficulty,
    difficulty,
    config: FREE_BATTLE,
  })),
]) {
  let wins = 0,
    timeouts = 0,
    caps = 0,
    seconds = 0,
    rounds = 0,
    shots = 0,
    hits = 0,
    repairs = 0,
    shields = 0,
    aiShortDistance = 0,
    aiShortTurns = 0;
  const games = [];
  for (let seed = 31; seed < 41; seed++) {
    const b = new Battle(scenario.difficulty, seed, scenario.config),
      random = seeded(seed + 9000);
    let lastBudget = 60;
    for (let tick = 0; tick < 12000 && !b.result; tick++) {
      if (b.canEmp("player")) b.useEmp("player");
      else if (b.isReaction() && b.canShield()) b.activateShield();
      if (b.phase === "aim") {
        if (b.canReinforce() && b.facility!.hp <= 55) b.reinforce();
        else if (b.player.hp <= 45 && b.canRepair()) b.repair();
        else if (
          b.config.fortified &&
          b.round === 4 &&
          b.canRequestAir("propeller")
        )
          b.requestAir("propeller", b.ai.x);
        else if (
          b.config.field === "valley" &&
          b.round === 4 &&
          b.canRequestAir(seed % 2 ? "helicopter" : "bomber")
        )
          b.requestAir(seed % 2 ? "helicopter" : "bomber", b.ai.x);
        else {
          const aim =
            b.config.objective?.type === "defend"
              ? { angle: 10, power: 20 }
              : solveShot(
                  b.player,
                  b.config.objective?.type === "destroy-objective"
                    ? b.facility!
                    : b.ai,
                  b.terrain,
                  b.wind,
                  b.config.objective ? b.collisionTargets : [],
                );
          b.select(
            b.allowedWeapons.includes("ap") && b.player.ammo.ap > 0
              ? "ap"
              : b.fortified && b.player.ammo.crater > 0
                ? "crater"
                : "shell",
          );
          b.aim(
            clamp(aim.angle + (random() - 0.5) * 4, 10, 80),
            clamp(aim.power + (random() - 0.5) * 6, 20, 100),
          );
          b.fire();
        }
      }
      for (let step = 0; step < 12; step++) {
        b.update(STEP);
        if (b.ai.mobility.remaining < lastBudget) {
          aiShortDistance += lastBudget - b.ai.mobility.remaining;
          if (lastBudget === 60) aiShortTurns++;
        }
        lastBudget = b.ai.mobility.remaining;
      }
      b.drainEvents();
    }
    if (!b.result) timeouts++;
    if (b.result?.outcome === "victory") wins++;
    if (b.result && !b.config.objective && b.player.hp > 0 && b.ai.hp > 0)
      caps++;
    seconds += b.elapsed;
    rounds += b.round;
    shots += b.combat.ai.shots;
    hits += b.combat.ai.hits;
    repairs += b.actionCounts.player.repair;
    shields += b.actionCounts.player.shield;
    games.push({
      seed,
      outcome: b.result?.outcome ?? "timeout",
      round: b.round,
      hp: b.player.hp,
      enemyHp: b.ai.hp,
      breach: b.breachProgress,
      objective: b.objectiveRecord,
      reason: b.result?.reason,
    });
  }
  const row = {
    scenario: scenario.id,
    difficulty: scenario.difficulty,
    games: 10,
    playerWins: wins,
    timeouts,
    roundLimits: caps,
    meanSeconds: Math.round(seconds / 10),
    meanRounds: rounds / 10,
    aiHitRate: shots ? hits / shots : 0,
    playerRepairs: repairs,
    playerShields: shields,
    aiShortDistance: Math.round(aiShortDistance),
    aiShortTurns,
    runs: games,
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(
  "docs/balance-phase7.json",
  JSON.stringify(
    {
      date: "2026-11-23",
      method:
        "Phase 7 objectives; 90 simulated games. Legacy 70 use Phase 6 policy; defense deliberately misses, reinforces at facility HP<=55 and survives six rounds; radar policy targets the facility with shared ballistics and actual obstacles. Ten shared seeds (31–40) per mission/free difficulty. Solver-assisted artillery with error ±2 degrees/±3 power; AP where allowed; repair at HP<=45; reactive shield and EMP; one support call when available. No injected health, position or outcomes. Time excludes human decisions; not a human difficulty rating.",
      results,
    },
    null,
    2,
  ) + "\n",
);
if (results.some((r) => r.timeouts)) process.exitCode = 1;
