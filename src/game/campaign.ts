import type { BattleConfig, Era } from "./eras";
import type { Difficulty } from "./engine";
export interface Mission {
  id: string;
  number: number;
  title: string;
  date: string;
  location: string;
  era: Era;
  difficulty: Difficulty;
  objective: string;
  briefing: string;
  tip: string;
  epilogue: string;
  reward: number;
  unlocks: string[];
  config: BattleConfig;
}
const ww2: BattleConfig = {
  initialHp: { player: 100, ai: 100 },
  winCondition: "destroy",
  era: "ww2",
  field: "normandy",
  playerName: "M4 파이오니어",
  enemyName: "방어 전차",
  weapons: ["shell", "ap"],
  ammo: { shell: Infinity, ap: 6 },
  supports: [],
  airBudget: 2,
  repairs: 2,
  smoke: false,
  cover: false,
  movement: true,
  armor: 0.08,
};
export const MISSIONS: readonly Mission[] = [
  {
    id: "normandy",
    number: 1,
    title: "노르망디의 포성",
    date: "1944",
    location: "프랑스 · 노르망디",
    era: "ww2",
    difficulty: "easy",
    objective: "독일군 방어 전차를 격파하라",
    briefing:
      "베넷 소위, 해안에서 내륙으로 향하는 길이 막혔다. 당신의 첫 지휘다. 바람을 읽고 포격으로 길을 열어라. 아군의 안전한 진격이 우리 임무다.",
    tip: "고폭탄은 범위 피해, 철갑탄은 직격에 강합니다. 정비는 1회: HP 28 회복. 포탄은 바람과 지형의 영향을 받습니다.",
    epilogue:
      "도로가 열렸다. 그러나 프랑스 내륙에서는 더 두꺼운 장갑을 가진 적이 기다린다.",
    reward: 100,
    unlocks: ["연막", "엄폐", "중포탄"],
    config: { ...ww2, missionId: "normandy", repairs: 1 },
  },
  {
    id: "iron",
    number: 2,
    title: "철의 반격",
    date: "1944",
    location: "프랑스 · 내륙 철도 교차로",
    era: "ww2",
    difficulty: "normal",
    objective: "중전차 아이언 울프를 격파하라",
    briefing:
      "철도 교차로에서 중전차가 반격해 왔다. 아이언 울프는 타이거 계열에서 영감을 받은 가상 차량이다. 철갑탄으로 장갑을 공략하고, 연막과 엄폐로 다음 공격에 대비하라.",
    tip: "적 장갑은 일반 피해 28%를 줄입니다. 철갑탄은 장갑을 관통합니다. 연막은 다음 적 포격의 조준을 흔들고, 엄폐는 다음 공격 피해를 35% 줄입니다.",
    epilogue:
      "교차로를 확보했다. 겨울이 지나고, 부대는 독일 서부의 마지막 방어선에 도착한다.",
    reward: 150,
    unlocks: ["포병 지원", "프로펠러 공격기"],
    config: {
      ...ww2,
      missionId: "iron",
      field: "france",
      enemyName: "아이언 울프 중전차",
      weapons: ["shell", "ap", "crater"],
      ammo: { shell: Infinity, ap: 8, crater: 3 },
      smoke: true,
      cover: true,
      armor: 0.28,
    },
  },
  {
    id: "last-line",
    number: 3,
    title: "마지막 방어선",
    date: "1945",
    location: "독일 서부 · 요새 지대",
    era: "ww2",
    difficulty: "hard",
    objective: "진지를 무너뜨린 후 지휘 차량을 격파하라",
    briefing:
      "지휘 차량이 강화 진지 안에서 방어선을 통솔한다. 진지가 온전하면 적 체력은 40 아래로 내려가지 않는다. 중포탄으로 기초를 파괴하거나 철갑탄을 세 번 직격시켜 방호 구조를 무너뜨려라. 적 포병의 예고 구역을 주시하라.",
    tip: "기초 평균 18 이상 파괴 또는 철갑탄 3회 직격 → 진지 붕괴. 포병·프로펠러 지원 각 1회. 요청 후 적도 한 번 행동합니다. 이동·엄폐로 대응하세요.",
    epilogue:
      "방어선의 포성이 멎었다. 베넷의 이야기는 여기서 끝난다. 이어지는 전장은 다른 시대, 다른 인물의 이야기다.",
    reward: 250,
    unlocks: ["현대전 캠페인", "드론", "유도탄", "EMP", "에너지 방어막"],
    config: {
      ...ww2,
      missionId: "last-line",
      field: "fortress",
      enemyName: "요새 지휘 차량",
      weapons: ["shell", "ap", "crater"],
      ammo: { shell: Infinity, ap: 9, crater: 4 },
      smoke: true,
      cover: true,
      armor: 0.18,
      fortified: true,
      supports: ["artillery", "propeller"],
      enemySupports: ["artillery"],
    },
  },
  {
    id: "shadow",
    number: 4,
    title: "드론의 그림자",
    date: "2020s",
    location: "가상 국가 세라 연방 · 경계 지대",
    era: "modern",
    difficulty: "normal",
    objective: "적 무인 전투 부대를 격파하라",
    briefing:
      "윤서진 대위, 국경 관측소에서 무인 장비가 포착됐다. 이곳은 1945년 전쟁의 연장이 아닌, 가상의 현대 분쟁 지역이다. 적은 첫 공격에 드론을 투입한다. EMP와 반응 방어막을 준비하고 관측소 접근로를 확보하라.",
    tip: "전자 무기 출격 중 E: EMP. 적 공격 중 R: 방어막, 턴 소비 없음. 정비 +28, 연속 정비 불가. 드론 WASD 이동, Space 공격. 유도탄은 목표 지정이 필요합니다.",
    epilogue:
      "관측소 접근로를 확보했다. 기술이 변해도 지휘의 책임은 남는다. CHRONICLES OF WAR — 네 개의 기록을 완수했다.",
    reward: 300,
    unlocks: ["작전 기록 완성"],
    config: {
      initialHp: { player: 100, ai: 100 },
      winCondition: "destroy",
      era: "modern",
      missionId: "shadow",
      field: "frontier",
      playerName: "KX-21 센티널",
      enemyName: "무인 레이더 전차",
      weapons: ["shell", "crater", "drone", "missile"],
      ammo: { shell: Infinity, crater: 3, drone: 2, missile: 2 },
      supports: [],
      airBudget: 1,
      repairs: 2,
      smoke: false,
      cover: false,
      movement: true,
      armor: 0,
      openingDrone: true,
    },
  },
];
export const getMission = (id: string | undefined) =>
  MISSIONS.find((m) => m.id === id);
export const nextMission = (id: string) =>
  MISSIONS[MISSIONS.findIndex((m) => m.id === id) + 1];
