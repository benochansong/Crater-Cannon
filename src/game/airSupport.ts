import type { Side } from "./engine";
export type AirKind = "helicopter" | "bomber" | "artillery" | "propeller";
export const AIR = {
  artillery: {
    name: "포병 지원",
    callSign: "FIELD BATTERY",
    damage: 24,
    radius: 115,
    duration: 4.8,
    description: "예고 구역 포격 · 지형 파괴 · 최대 24",
  },
  propeller: {
    name: "프로펠러 공격기",
    callSign: "SKY LARK",
    damage: 26,
    radius: 140,
    duration: 4.8,
    description: "저공 접근 · 폭탄 3개 투하 · 최대 26",
  },
  helicopter: {
    name: "공격 헬기",
    callSign: "SKY HUNTER",
    damage: 27,
    radius: 70,
    duration: 5.2,
    description: "좁은 구역에 3회 집중 공격 · 최대 27",
  },
  bomber: {
    name: "폭격기",
    callSign: "THUNDER WING",
    damage: 30,
    radius: 170,
    duration: 4.8,
    description: "넓은 구역 피해 · 3개 지점 지형 파괴 · 최대 30",
  },
};
export interface AirReservation {
  id: number;
  kind: AirKind;
  owner: Side;
  facing?: import("./sides").Facing;
  mirrored?: boolean;
  targetX: number;
  responseStarted: boolean;
}
export interface AirOperation extends AirReservation {
  age: number;
  impacts: { x: number; time: number; done: boolean }[];
  enemyHit: boolean;
}
export function makeOperation(reservation: AirReservation): AirOperation {
  const direction =
    reservation.facing ?? (reservation.owner === "player" ? 1 : -1);
  return {
    ...reservation,
    age: 0,
    enemyHit: false,
    impacts: (reservation.kind === "helicopter"
      ? [-24, 0, 24]
      : [-70, 0, 70]
    ).map((offset, i) => {
      const x = Math.max(
        25,
        Math.min(
          1255,
          reservation.targetX + offset * (reservation.mirrored ? -1 : 1),
        ),
      );
      return {
        x,
        time:
          reservation.kind === "helicopter"
            ? 1.9 + i * 0.55
            : 0.45 + ((direction === 1 ? x + 220 : 1500 - x) / 1720) * 4.2,
        done: false,
      };
    }),
  };
}
export function airDamage(kind: AirKind, distance: number) {
  return kind === "helicopter"
    ? Math.round(9 * Math.max(0, 1 - Math.max(0, distance - 28) / 42))
    : Math.round(
        AIR[kind].damage * Math.max(0, 1 - distance / AIR[kind].radius),
      );
}
export function airPosition(a: AirOperation) {
  const dir = a.facing ?? (a.owner === "player" ? 1 : -1),
    start = dir === 1 ? -220 : 1500,
    end = dir === 1 ? 1500 : -220;
  if (a.kind !== "helicopter")
    return { x: start + (end - start) * Math.min(1, a.age / 4.2), y: 215, dir };
  const hold = Math.max(150, Math.min(1130, a.targetX - dir * 100));
  const x =
    a.age < 1.4
      ? start +
        (hold - start) * Math.sin((Math.min(1, a.age / 1.4) * Math.PI) / 2)
      : a.age < 3.2
        ? hold
        : hold + (end - hold) * Math.min(1, (a.age - 3.2) / 2);
  return { x, y: 215 + Math.sin(a.age * 5) * 5, dir };
}
