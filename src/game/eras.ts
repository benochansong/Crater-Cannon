import type { ObjectiveConfig } from "./objectives";
import type { WeaponId } from "./engine";
import type { AirKind } from "./airSupport";
export type Era = "ww2" | "modern";
export type Field =
  | "valley"
  | "normandy"
  | "france"
  | "fortress"
  | "frontier"
  | "signal"
  | "radar"
  | "convoy"
  | "citadel";
export interface BattleConfig {
  objective?: ObjectiveConfig;
  boss?: { rounds: number };
  spawns?: { player: number; ai: number };
  initialHp?: { player: number; ai: number };
  winCondition?: "destroy" | "hp-verdict";
  era: Era;
  missionId?: string;
  field: Field;
  playerName: string;
  enemyName: string;
  weapons: readonly WeaponId[];
  ammo: Partial<Record<WeaponId, number>>;
  supports: readonly AirKind[];
  airBudget: number;
  repairs: number;
  smoke: boolean;
  cover: boolean;
  movement: boolean;
  armor: number;
  fortified?: boolean;
  enemySupports?: readonly AirKind[];
  openingDrone?: boolean;
}
export const FREE_BATTLE: BattleConfig = {
  initialHp: { player: 100, ai: 100 },
  winCondition: "hp-verdict",
  era: "modern",
  field: "valley",
  playerName: "블루 코멧",
  enemyName: "레드 배저",
  weapons: ["shell", "crater", "shock", "drone", "missile"],
  ammo: { shell: Infinity, crater: 2, shock: 2, drone: 2, missile: 2 },
  supports: ["helicopter", "bomber"],
  airBudget: 1,
  repairs: 2,
  smoke: false,
  cover: false,
  movement: true,
  armor: 0,
};
export const ERA_WEAPONS: Record<Era, readonly WeaponId[]> = {
  ww2: ["shell", "ap", "crater"],
  modern: ["shell", "crater", "shock", "drone", "missile"],
};
export const ERA_SUPPORTS: Record<Era, readonly AirKind[]> = {
  ww2: ["artillery", "propeller"],
  modern: ["helicopter", "bomber"],
};
