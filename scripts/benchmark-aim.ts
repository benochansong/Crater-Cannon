import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { Battle } from "../src/game/engine";
import { predictAim, PredictionCache } from "../src/game/aimPrediction";
import { trainingConfig } from "../src/game/training";
import { MISSIONS } from "../src/game/campaign";
const cases = [
  new Battle("easy", 31, trainingConfig("A")),
  new Battle("easy", 31, trainingConfig("C")),
  new Battle("normal", 31, MISSIONS[5].config),
  new Battle("hard", 31, MISSIONS[7].config),
];
const durations: number[] = [];
let maxSteps = 0,
  maxPoints = 0;
for (const b of cases)
  for (let i = 0; i < 100; i++) {
    b.aim(10 + ((i * 7) % 70), 20 + ((i * 13) % 80));
    b.wind = (i % 11) - 5;
    const start = performance.now(),
      p = predictAim(b)!;
    durations.push(performance.now() - start);
    maxSteps = Math.max(maxSteps, p.steps);
    maxPoints = Math.max(maxPoints, p.points.length);
  }
const cache = new PredictionCache(),
  b = cases[0];
cache.get(b);
const start = performance.now();
for (let i = 0; i < 20000; i++) cache.get(b);
const cachedMs = performance.now() - start;
durations.sort((a, b) => a - b);
const report = {
  runtime: process.version,
  platform: process.platform,
  kind: "Node microbenchmark; not a browser/mobile frame-rate measurement",
  simulations: durations.length,
  medianMs: durations[200],
  p95Ms: durations[380],
  maxMs: durations.at(-1),
  maxSteps,
  maxPoints,
  cachedLookups: 20000,
  cachedTotalMs: cachedMs,
  cacheCalculations: cache.calculations,
};
writeFileSync(
  "docs/performance-phase9.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
