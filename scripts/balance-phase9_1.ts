import { writeFileSync } from "node:fs";
import {
  Battle,
  planAI,
  seeded,
  launch,
  advance,
  WIDTH,
} from "../src/game/engine";
import type { Difficulty } from "../src/game/engine";
import { choosePlayerSide } from "../src/game/sides";
const summary = [];
for (const difficulty of ["easy", "normal", "hard"] as Difficulty[]) {
  let maxMirrorError = 0,
    samePlans = 0,
    leftHits = 0,
    rightHits = 0,
    leftError = 0,
    rightError = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const a = new Battle(difficulty, seed, undefined, "left"),
      b = new Battle(difficulty, seed, undefined, "right");
    b.wind = -a.wind;
    const pa = planAI(
        a.ai,
        a.player,
        a.terrain,
        a.wind,
        difficulty,
        { bias: 4, lastMiss: 100, shots: 1 },
        seeded(seed + 100),
      ),
      pb = planAI(
        b.ai,
        b.player,
        b.terrain,
        b.wind,
        difficulty,
        { bias: 4, lastMiss: -100, shots: 1 },
        seeded(seed + 100),
      );
    if (JSON.stringify(pa) === JSON.stringify(pb)) samePlans++;
    Object.assign(a.ai, pa);
    Object.assign(b.ai, pb);
    const p = launch(a.ai, "shell"),
      q = launch(b.ai, "shell");
    let h = null,
      k = null;
    for (let i = 0; i < 1441 && !h; i++)
      h = advance(p, a.terrain, a.tanks, a.wind);
    for (let i = 0; i < 1441 && !k; i++)
      k = advance(q, b.terrain, b.tanks, b.wind);
    if (!h || !k) throw Error("No impact");
    maxMirrorError = Math.max(
      maxMirrorError,
      Math.hypot(h.x + k.x - WIDTH, h.y - k.y),
    );
    leftHits += Number(h.direct === "player");
    rightHits += Number(k.direct === "player");
    leftError += Math.abs(h.x - a.player.x);
    rightError += Math.abs(k.x - b.player.x);
  }
  summary.push({
    difficulty,
    seeds: 30,
    samePlans,
    leftDirectHits: leftHits,
    rightDirectHits: rightHits,
    leftMeanHorizontalError: leftError / 30,
    rightMeanHorizontalError: rightError / 30,
    maxMirrorError,
  });
}
const placements = Array.from({ length: 10000 }, (_, i) => choosePlayerSide(i));
const left = placements.filter((x) => x === "left").length;
const report = {
  kind: "Paired AI physics audit, mirrored terrain and opposite wind, identical seeded noise; not human win rates",
  placementSamples: placements.length,
  left,
  right: placements.length - left,
  summary,
};
writeFileSync(
  "docs/balance-phase9_1.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (
  summary.some(
    (s) =>
      s.maxMirrorError > 1e-5 ||
      s.samePlans !== 30 ||
      s.leftDirectHits !== s.rightDirectHits,
  )
)
  process.exitCode = 1;
