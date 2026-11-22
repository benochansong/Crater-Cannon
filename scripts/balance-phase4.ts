import { mkdirSync, writeFileSync } from "node:fs";
import {
  Battle,
  WEAPON_IDS,
  clamp,
  seeded,
  solveShot,
} from "../src/game/engine";
import type { Difficulty, WeaponId } from "../src/game/engine";
const count = Number(process.env.BALANCE_MATCHES ?? 20);
if (!Number.isInteger(count) || count < 1)
  throw Error("BALANCE_MATCHES must be a positive integer");
const results = [];
for (const difficulty of ["easy", "normal", "hard"] as Difficulty[]) {
  const totals = {
    wins: 0,
    draws: 0,
    timeouts: 0,
    roundLimits: 0,
    maxSeconds: 0,
    maxRounds: 0,
    seconds: 0,
    rounds: 0,
    shots: 0,
    hits: 0,
    damage: 0,
  };
  const actions = {
    player: { repair: 0, shield: 0, move: 0, helicopter: 0, bomber: 0 },
    ai: { repair: 0, shield: 0, move: 0, helicopter: 0, bomber: 0 },
  };
  const weapons = Object.fromEntries(
    [...WEAPON_IDS, "helicopter", "bomber"].map((k) => [
      k,
      { shots: 0, hits: 0, damage: 0 },
    ]),
  );
  for (let i = 1; i <= count; i++) {
    const b = new Battle(difficulty, 10000 + i),
      random = seeded(90000 + i);
    let defenseShot = -1,
      willEmp = false,
      droneOffset = 0;
    for (let tick = 0; tick < 18000 && !b.result; tick++) {
      if (b.phase === "aim") {
        let acted = false;
        if (b.pendingAir?.owner === "ai") {
          const away = Math.sign(b.player.x - b.pendingAir.targetX) || 1;
          if (random() < 0.5 && b.canMove(away)) acted = b.move(away);
          else if (b.canShield()) acted = b.activateShield();
        }
        if (
          !acted &&
          b.player.hp <= 45 &&
          b.lastAction.player !== "repair" &&
          b.canRepair()
        )
          acted = b.repair();
        if (!acted && b.round >= 2 && random() < 0.24) {
          const kind =
            b.player.support.helicopter > 0 ? "helicopter" : "bomber";
          if (b.canRequestAir(kind))
            acted = b.requestAir(kind, b.ai.x + (random() - 0.5) * 35);
        }
        if (!acted) {
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
      }
      if (b.canEmp("player")) {
        if (defenseShot !== b.combat.ai.shots) {
          defenseShot = b.combat.ai.shots;
          willEmp = random() < 0.65;
        }
        if (willEmp && b.defense!.remaining < 3) b.useEmp("player");
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
    if (!b.result) totals.timeouts++;
    else if (b.result.outcome === "defeat") totals.wins++;
    else if (b.result.outcome === "draw") totals.draws++;
    if (b.result && b.player.hp > 0 && b.ai.hp > 0) totals.roundLimits++;
    totals.maxSeconds = Math.max(totals.maxSeconds, b.elapsed);
    totals.maxRounds = Math.max(totals.maxRounds, b.round);
    totals.seconds += b.elapsed;
    totals.rounds += b.round;
    totals.shots += b.combat.ai.shots;
    totals.hits += b.combat.ai.hits;
    totals.damage += b.combat.ai.damage;
    for (const side of ["player", "ai"] as const)
      for (const key of Object.keys(
        actions[side],
      ) as (keyof typeof actions.ai)[])
        actions[side][key] += b.actionCounts[side][key];
    for (const [key, stats] of Object.entries({
      ...b.telemetry.ai,
      ...b.supportStats.ai,
    }))
      for (const n of ["shots", "hits", "damage"] as const)
        weapons[key][n] += stats[n];
  }
  const row = {
    difficulty,
    matches: count,
    aiWinRate: totals.wins / count,
    draws: totals.draws,
    timeouts: totals.timeouts,
    roundLimits: totals.roundLimits,
    maxSeconds: totals.maxSeconds,
    maxRounds: totals.maxRounds,
    meanSeconds: totals.seconds / count,
    meanRounds: totals.rounds / count,
    aiHitRate: totals.hits / totals.shots,
    actions,
    weapons: Object.fromEntries(
      Object.entries(weapons).map(([k, s]) => [
        k,
        {
          ...s,
          usageShare: s.shots / totals.shots,
          damagePerUse: s.shots ? s.damage / s.shots : 0,
        },
      ]),
    ),
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/balance-phase4.json",
  JSON.stringify(
    {
      date: "2026-11-22",
      method: `Same ${count} seeds per difficulty (10001 onward). Mixed-weapon benchmark with aim error ±4 degrees / ±5 power, public drone input, repair at HP<=45, optional support calls and shield/move responses, 65% EMP. Time excludes player decisions. No HP/position/outcome injection.`,
      results,
    },
    null,
    2,
  ) + "\n",
);
