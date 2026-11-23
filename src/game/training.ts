import { FREE_BATTLE } from "./eras";
import type { BattleConfig } from "./eras";
import type { ShotRecord } from "./shotHistory";
export type TrainingTarget = "A" | "B" | "C";
export const TRAINING_TARGETS = [
  { id: "A", name: "가까운 목표", description: "평지 · 세기 조절", x: 580 },
  { id: "B", name: "먼 목표", description: "장거리 · 각도와 세기", x: 1060 },
  { id: "C", name: "높은 목표", description: "언덕 · 고저차와 바람", x: 1000 },
] as const;
export function trainingConfig(id: TrainingTarget): BattleConfig {
  const t = TRAINING_TARGETS.find((t) => t.id === id)!;
  return {
    ...FREE_BATTLE,
    training: id,
    playerName: "사격 훈련",
    enemyName: "TARGET " + id + " · " + t.name,
    weapons: ["shell", "crater", "shock"],
    ammo: { shell: Infinity, crater: Infinity, shock: Infinity },
    supports: [],
    airBudget: 0,
    repairs: 0,
    armor: 0,
    spawns: { player: 180, ai: t.x },
  };
}
export interface TrainingStats {
  id: string;
  date: string;
  shots: number;
  hits: number;
  direct: number;
  streak: number;
  bestStreak: number;
  errorTotal: number;
  errorCount: number;
}
export const newTrainingStats = (): TrainingStats => ({
  id: Date.now() + "-" + Math.random().toString(36).slice(2),
  date: new Date().toISOString(),
  shots: 0,
  hits: 0,
  direct: 0,
  streak: 0,
  bestStreak: 0,
  errorTotal: 0,
  errorCount: 0,
});
export function countTraining(s: TrainingStats, r: ShotRecord) {
  s.hits += Number(r.hit);
  s.direct += Number(r.reason === "direct");
  s.streak = r.hit ? s.streak + 1 : 0;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  if (r.error !== null) {
    s.errorTotal += r.error;
    s.errorCount++;
  }
}
export function loadTraining(): TrainingStats[] {
  try {
    const rows: unknown = JSON.parse(
      localStorage.getItem("crater.training.v1") || "[]",
    );
    return Array.isArray(rows)
      ? rows
          .filter(
            (s): s is TrainingStats =>
              !!s &&
              typeof s === "object" &&
              typeof s.id === "string" &&
              typeof s.date === "string" &&
              [
                "shots",
                "hits",
                "direct",
                "streak",
                "bestStreak",
                "errorTotal",
                "errorCount",
              ].every((k) => Number.isFinite(s[k]) && s[k] >= 0),
          )
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
export function saveTraining(s: TrainingStats) {
  if (!s.shots) return;
  try {
    localStorage.setItem(
      "crater.training.v1",
      JSON.stringify(
        [s, ...loadTraining().filter((r) => r.id !== s.id)].slice(0, 10),
      ),
    );
  } catch {
    /* Optional practice history. */
  }
}
export function trainingLessonSeen() {
  try {
    return localStorage.getItem("crater.training.lesson") === "done";
  } catch {
    return false;
  }
}
export function finishTrainingLesson() {
  try {
    localStorage.setItem("crater.training.lesson", "done");
  } catch {
    /* Optional. */
  }
}
