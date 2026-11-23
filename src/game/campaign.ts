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
      "관측소 접근로를 확보했습니다. 그러나 북부 통신망에 이상 신호가 감지되고 있습니다. 다음 임무는 마지막 통신소를 지키는 방어 작전입니다.",
    reward: 300,
    unlocks: ["작전 기록 완성", "통신시설 방어 작전"],
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
  {
    id: "last-signal",
    number: 5,
    title: "최후의 통신소",
    date: "2020s",
    location: "가상 국가 세라 연방 · 북부 산악 경계",
    era: "modern",
    difficulty: "normal",
    objective: "통신시설과 차량을 지키며 6라운드 방어하라",
    briefing:
      "윤서진 대위, 마지막 통신소를 반드시 지켜야 합니다. 적의 공격으로 주요 통신망이 끊겼습니다. 지원부대가 도착할 때까지 방어선을 유지하십시오. 시설과 차량 모두 살아 있어야 합니다.",
    tip: "통신시설 HP 70 · 6라운드 방어. 시설 긴급 보강은 +15, 단 1회, 공격 턴 사용. 적 공격 목표 경고를 확인하세요. 차량 방어막은 시설을 보호하지 않으며 아군 폭발도 시설에 피해를 줍니다. 남은 적을 먼저 격파하면 즉시 성공합니다.",
    epilogue:
      "통신소를 지켜냈습니다. 지원부대가 방어선에 도착했습니다. 그러나 적의 레이더 시설이 여전히 우리 부대의 움직임을 추적하고 있습니다.",
    reward: 350,
    unlocks: ["레이더 차단 작전"],
    config: {
      initialHp: { player: 100, ai: 100 },
      winCondition: "destroy",
      era: "modern",
      missionId: "last-signal",
      spawns: { player: 310, ai: 1070 },
      field: "signal",
      playerName: "KX-21 센티널",
      enemyName: "통신망 습격 전차",
      weapons: ["shell", "crater", "drone", "missile"],
      ammo: { shell: Infinity, crater: 2, drone: 2, missile: 2 },
      supports: ["helicopter"],
      enemySupports: [],
      airBudget: 1,
      repairs: 2,
      smoke: false,
      cover: false,
      movement: true,
      armor: 0,
      objective: {
        type: "defend",
        kind: "comms",
        name: "북부 통신시설",
        x: 110,
        hp: 70,
        rounds: 6,
      },
    },
  },
  {
    id: "blind-enemy",
    number: 6,
    title: "적의 눈을 꺼라",
    date: "2020s",
    location: "가상 국가 세라 연방 · 산악 레이더 기지",
    era: "modern",
    difficulty: "normal",
    objective: "8라운드 이내 레이더 중계시설을 파괴하라",
    briefing:
      "적의 감시망을 무력화하십시오. 이번 작전의 목표는 적 전차가 아니라 레이더 중계시설입니다. 방어 전차를 먼저 제거해 위협을 줄이거나, 고각 포격과 유도탄으로 시설을 직접 공략하십시오.",
    tip: "레이더 HP 65 · 제한 8라운드. 전차를 격파해도 임무는 계속됩니다. 시설/전차 목표 버튼으로 구분하세요. 유도탄은 선택한 목표에 고정됩니다. 헬기 1회만으로 시설을 파괴할 수 없습니다.",
    epilogue:
      "적 레이더망이 무력화되었습니다. 아군 부대가 다음 작전을 준비하고 있습니다. 후속 작전은 준비 중이며 아직 출격할 수 없습니다.",
    reward: 400,
    unlocks: ["FRONTLINE OPERATIONS 완료"],
    config: {
      initialHp: { player: 100, ai: 100 },
      winCondition: "destroy",
      era: "modern",
      missionId: "blind-enemy",
      field: "radar",
      spawns: { player: 210, ai: 935 },
      playerName: "KX-21 센티널",
      enemyName: "레이더 기지 방어 전차",
      weapons: ["shell", "crater", "drone", "missile"],
      ammo: { shell: Infinity, crater: 2, drone: 2, missile: 2 },
      supports: ["helicopter"],
      enemySupports: [],
      airBudget: 1,
      repairs: 2,
      smoke: false,
      cover: false,
      movement: true,
      armor: 0,
      objective: {
        type: "destroy-objective",
        kind: "radar",
        name: "적 레이더 중계시설",
        x: 1150,
        hp: 65,
        rounds: 8,
      },
    },
  },
];
export const getMission = (id: string | undefined) =>
  MISSIONS.find((m) => m.id === id);
export const nextMission = (id: string) =>
  MISSIONS[MISSIONS.findIndex((m) => m.id === id) + 1];
