import { writeFileSync } from "node:fs";
import { Battle, solveShot, seeded, clamp } from "../src/game/engine";
import { MISSIONS } from "../src/game/campaign";
import type { Difficulty } from "../src/game/engine";
const results = [];
for (const m of MISSIONS.slice(6))
  for (const difficulty of ["easy", "normal", "hard"] as Difficulty[])
    for (const policy of ["balanced", "attack-only"] as const) {
      const runs = [];
      for (let seed = 31; seed < (policy === "balanced" ? 41 : 36); seed++) {
        const b = new Battle(difficulty, seed, m.config),
          random = seeded(seed + 9000);
        let protectedOnce = false,
          moves = 0,
          scenes = 0,
          lastScene = "";
        for (let tick = 0; tick < 24000 && !b.result; tick++) {
          if (b.scene && b.scene.title !== lastScene) {
            scenes++;
            lastScene = b.scene.title;
          }
          if (policy === "balanced") {
            if (b.canEmp("player")) b.useEmp("player");
            if (
              b.isReaction() &&
              b.canShield() &&
              (!b.boss || b.boss.phase === 3) &&
              (!b.convoy || b.convoy.wave === 2)
            )
              b.activateShield();
          }
          if (b.phase === "aim" && !b.scene && !b.convoy?.moving) {
            if (b.player.mobility.input) {
              if (b.player.x >= b.facility!.x + 40 || !b.canAdjust())
                b.adjust(0);
              b.update(0.1);
              b.drainEvents();
              continue;
            }
            if (policy === "balanced" && b.player.hp <= 45 && b.canRepair())
              b.repair();
            else if (
              policy === "balanced" &&
              b.convoy &&
              b.convoy.wave === 1 &&
              !protectedOnce &&
              b.player.x <= b.facility!.x &&
              b.canAdjust() &&
              b.adjustmentRange().right > b.player.x + 1
            ) {
              b.adjust(1);
              moves++;
            } else if (
              policy === "balanced" &&
              b.convoy?.wave === 1 &&
              !protectedOnce &&
              b.canProtectConvoy()
            ) {
              b.protectConvoy();
              protectedOnce = true;
            } else {
              const p = solveShot(
                b.player,
                b.ai,
                b.terrain,
                b.wind,
                b.collisionTargets,
              );
              b.select("shell");
              b.aim(
                clamp(p.angle + (random() - 0.5) * 4, 10, 80),
                clamp(p.power + (random() - 0.5) * 6, 20, 100),
              );
              b.fire();
            }
          }
          b.update(0.1);
          b.drainEvents();
        }
        runs.push({
          seed,
          outcome: b.result?.outcome ?? "timeout",
          reason: b.result?.reason,
          seconds: Math.round(b.elapsed),
          round: b.result?.round,
          hp: b.player.hp,
          truckHp: b.facility?.hp,
          operation: b.operationRecord,
          bossTransitions: b.boss?.transitions,
          finalAttackUsed: b.boss?.finalAttackUsed,
          aiBomberDamage: b.supportStats.ai.bomber.damage,
          moves,
          scenes,
        });
      }
      const result = {
        mission: m.id,
        difficulty,
        policy,
        games: runs.length,
        wins: runs.filter((r) => r.outcome === "victory").length,
        timeouts: runs.filter((r) => r.outcome === "timeout").length,
        meanSeconds: Math.round(
          runs.reduce((n, r) => n + r.seconds, 0) / runs.length,
        ),
        meanHp: Math.round(runs.reduce((n, r) => n + r.hp, 0) / runs.length),
        runs,
      };
      results.push(result);
      console.log(JSON.stringify({ ...result, runs: undefined }));
    }
writeFileSync(
  "docs/balance-phase8.json",
  JSON.stringify(
    {
      date: "2026-11-23",
      method:
        "90 real-engine games: two missions × three AI difficulties × (10 balanced + 5 attack-only) shared seeds 31–40. Common solver with angle ±2/power ±3 error. Balanced policy uses repairs, EMP, reactive shields, plus one convoy cover maneuver/protection. Attack-only never repairs or defends. No HP, position, damage or outcome injection. Engine time excludes human decision time; not a human difficulty rating.",
      results,
    },
    null,
    2,
  ) + "\n",
);
