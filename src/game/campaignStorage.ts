import { MISSIONS } from "./campaign";
import type { BattleResult } from "./engine";
export const CAMPAIGN_KEY = "crater.campaign.v1";
export type Grade = "S" | "A" | "B";
export interface CampaignProgress {
  version: 1;
  current: string;
  completed: string[];
  unlocked: string[];
  grades: Record<string, Grade>;
  supplies: number;
  weapons: string[];
  transitionSeen: boolean;
}
export function freshProgress(): CampaignProgress {
  return {
    version: 1,
    current: "normandy",
    completed: [],
    unlocked: ["normandy"],
    grades: {},
    supplies: 0,
    weapons: [],
    transitionSeen: false,
  };
}
export function normalizeProgress(value: unknown): CampaignProgress {
  const p = freshProgress();
  if (!value || typeof value !== "object") return p;
  const v = value as Partial<CampaignProgress>;
  if (v.version !== 1) return p;
  for (const m of MISSIONS) {
    if (!Array.isArray(v.completed) || !v.completed.includes(m.id)) break;
    p.completed.push(m.id);
  }
  p.unlocked = MISSIONS.slice(0, Math.min(4, p.completed.length + 1)).map(
    (m) => m.id,
  );
  for (const id of p.completed) {
    const grade = v.grades?.[id];
    p.grades[id] = grade === "S" || grade === "A" ? grade : "B";
  }
  const done = MISSIONS.filter((m) => p.completed.includes(m.id));
  p.supplies = done.reduce((n, m) => n + m.reward, 0);
  p.weapons = [...new Set(done.flatMap((m) => m.unlocks))];
  p.current =
    typeof v.current === "string" && p.unlocked.includes(v.current)
      ? v.current
      : p.unlocked[p.unlocked.length - 1];
  p.transitionSeen =
    p.completed.includes("last-line") && v.transitionSeen === true;
  return p;
}
export function loadCampaign(): CampaignProgress {
  try {
    return normalizeProgress(
      JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? "null"),
    );
  } catch {
    return freshProgress();
  }
}
export function saveCampaign(p: CampaignProgress) {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
export const missionGrade = (r: BattleResult): Grade =>
  r.hp >= 65 && r.shots <= 12 ? "S" : r.hp >= 30 ? "A" : "B";
export function completeMission(
  p: CampaignProgress,
  id: string,
  r: BattleResult,
): CampaignProgress {
  if (r.outcome !== "victory" || r.enemyHp > 0 || !p.unlocked.includes(id))
    return p;
  const grade = missionGrade(r),
    rank = { S: 3, A: 2, B: 1 },
    old = p.grades[id];
  return normalizeProgress({
    ...p,
    current: id,
    completed: [...new Set([...p.completed, id])],
    grades: { ...p.grades, [id]: old && rank[old] > rank[grade] ? old : grade },
  });
}
