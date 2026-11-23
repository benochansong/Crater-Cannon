import { missionSucceeded, REASON_TEXT } from "../game/objectives";
import { useEffect, useState } from "react";
import { MISSIONS, nextMission } from "../game/campaign";
import type { Mission } from "../game/campaign";
import type { CampaignProgress } from "../game/campaignStorage";
import { missionGrade } from "../game/campaignStorage";
import type { BattleResult } from "../game/engine";
import { weaponInfo } from "../game/engine";
import { AIR } from "../game/airSupport";
import type { Era, Field } from "../game/eras";

export function CampaignArt({
  field,
  completion = false,
}: {
  field: Field;
  completion?: boolean;
}) {
  const modern = ["frontier", "signal", "radar"].includes(field),
    fortress = field === "fortress",
    france = field === "france";
  const sky = modern
    ? "#172d48"
    : fortress
      ? "#515762"
      : france
        ? "#8b6c5d"
        : "#9caeaa";
  return (
    <svg
      className="campaign-art"
      viewBox="0 0 800 380"
      role="img"
      aria-label={
        completion
          ? "작전 완료 기념 일러스트"
          : modern
            ? "드론과 현대 장갑차가 있는 국경 전장"
            : fortress
              ? "요새와 프로펠러 공격기가 있는 1945년 전장"
              : france
                ? "파괴된 교량과 중전차가 있는 프랑스 전장"
                : "노르망디의 들판과 연합군 전차"
      }
    >
      <rect width="800" height="380" fill={sky} />
      <circle
        cx="650"
        cy="90"
        r="54"
        fill={modern ? "#71c7db" : "#f8d9a0"}
        opacity=".6"
      />
      <path
        d="M0 150Q170 30 320 155T800 125V380H0Z"
        fill={modern ? "#234254" : "#697c76"}
      />
      <path
        d="M0 215Q140 140 280 220T800 180V380H0Z"
        fill={modern ? "#263b41" : "#4f6254"}
      />
      {Array.from({ length: 12 }, (_, i) => (
        <g
          key={i}
          transform={
            "translate(" + (i * 77 - 20) + " " + (130 + (i % 3) * 17) + ")"
          }
          opacity=".65"
        >
          <rect
            x="0"
            y="0"
            width={modern ? 45 : 34}
            height={modern ? 100 : 65}
            fill={modern ? "#1a2b39" : "#3d4b43"}
          />
          <path
            d={modern ? "M0 0H45L35 -30H8Z" : "M-8 0L17 -28L42 0Z"}
            fill="#273a3b"
          />
          {modern && (
            <path
              d="M8 15h7m10 0h7M8 35h7m10 0h7M8 55h7m10 0h7"
              stroke="#6ca7a4"
              strokeWidth="4"
            />
          )}
        </g>
      ))}
      {france && (
        <g fill="#2b3631">
          <path
            d="M380 220V180H560V195H620V210H800V250H380ZM405 212Q440 150 475 212V270H405ZM650 230Q700 160 750 230V280H650Z"
            fillRule="evenodd"
          />
          <path d="M520 185l10-55 35 62z" />
        </g>
      )}
      {fortress && (
        <g>
          <path
            d="M500 270L530 175H730L785 270Z"
            fill="#333d3e"
            stroke="#a4a092"
            strokeWidth="5"
          />
          <path d="M548 210H718V240H548Z" fill="#172122" />
          <path
            d="M565 185l35 65m30-65 35 65m30-65 35 65"
            stroke="#606862"
            strokeWidth="2"
          />
        </g>
      )}
      <path
        d="M0 285Q180 240 375 288T800 260V380H0Z"
        fill={modern ? "#344342" : "#576045"}
      />
      <path d="M0 335Q230 275 480 325T800 310V380H0Z" fill="#263732" />
      {(field === "signal" || field === "radar") && (
        <g transform="translate(620 260)" stroke="#132c31" strokeWidth="4">
          <path d="M-72 25V-35H72V25Z" fill="#7f9d8c" />
          <path d="M-82-35H82L65-55H-65Z" fill="#b3c8a5" />
          <path d="M-22-55 0-140 22-55" fill="none" stroke="#c0dac6" />
          {field === "signal" ? (
            <>
              <path d="M-42-105H42M-30-127H30" stroke="#d1e6c2" />
              <circle cy="-145" r="7" fill="#9cf3d3" />
            </>
          ) : (
            <>
              <path d="M-58-135Q0-70 58-135Z" fill="#afcdbb" />
              <path d="M0-112V-160" stroke="#d6e6c4" />
            </>
          )}
          <path d="M-48-15H-27M27-15H48" stroke="#d2f1cf" strokeWidth="10" />
        </g>
      )}
      <g transform="translate(115 235)" stroke="#172923" strokeWidth="4">
        <path d="M0 65L28 35H230L257 65L240 100H20Z" fill="#172c29" />
        {[35, 73, 111, 149, 187, 225].map((x) => (
          <circle key={x} cx={x} cy="76" r="15" fill="#596e58" />
        ))}
        <path
          d="M10 55L42 24H207L247 55Z"
          fill={modern ? "#738f85" : "#8f9465"}
        />
        <path
          d={
            modern
              ? "M70 25L88 -14H164L188 25Z"
              : "M75 25V-8Q120 -38 165 -8L177 25Z"
          }
          fill={modern ? "#a0b8a5" : "#b2af79"}
        />
        <path d="M157 0L290 -9L293 5L164 15Z" fill="#7e8b63" />
        <path d="M85 14h58M40 40h150" stroke="#d7d4a0" strokeWidth="3" />
        {!modern && (
          <path
            d="m58 30 4 10 10 0-8 6 3 10-9-6-9 6 3-10-8-6h10Z"
            fill="#eee9c6"
            stroke="none"
          />
        )}
        {modern && (
          <>
            <path d="M96-15V-55m0 15h45" stroke="#aecac0" />
            <rect x="127" y="-25" width="25" height="12" fill="#56cfca" />
          </>
        )}
      </g>
      <g fill={modern ? "#9cbab4" : "#293d3c"} transform="translate(555 80)">
        {modern ? (
          <>
            <path d="M-50-10h100v7H-50ZM-30 4h60v12H-30Z" />
            <ellipse cx="-50" cy="-10" rx="24" ry="4" />
            <ellipse cx="50" cy="-10" rx="24" ry="4" />
            <path d="M0 15l-8 100h16Z" opacity=".12" />
          </>
        ) : (
          <>
            <path d="M-70 0L-12 -8L-4 -28H6L12 -8L70 0V8L10 5L7 35L25 45V50H-25V45L-7 35L-10 5L-70 8Z" />
            <path d="M-24 -28H24" stroke="#cad1bc" strokeWidth="3" />
          </>
        )}
      </g>
      <path d="M0 370H800" stroke="#d9c69a" strokeWidth="3" />
      {completion && (
        <g
          transform="translate(650 260)"
          fill="#f2ce7f"
          stroke="#243a36"
          strokeWidth="4"
        >
          <circle r="60" />
          <path
            d="m0-40 11 25 28 3-21 19 6 28-24-14-24 14 6-28-21-19 28-3Z"
            fill="#354b43"
          />
        </g>
      )}
    </svg>
  );
}
export function Portrait({ era }: { era: Era }) {
  return (
    <svg
      className="commander-portrait"
      viewBox="0 0 160 180"
      role="img"
      aria-label={
        era === "ww2" ? "가상 지휘관 아서 베넷 초상" : "가상 지휘관 윤서진 초상"
      }
    >
      <rect
        width="160"
        height="180"
        rx="12"
        fill={era === "ww2" ? "#4b5948" : "#294758"}
      />
      <path
        d="M10 180Q15 125 54 120H106Q145 125 150 180Z"
        fill={era === "ww2" ? "#8b9068" : "#718b82"}
      />
      <path d="M58 111V133L80 149L102 133V111" fill="#b78c71" />
      <path d="M44 60Q80 20 116 60L110 108Q80 145 50 108Z" fill="#d9b295" />
      <path d="M43 72V46Q80 10 117 46V72L103 53H57Z" fill="#343e34" />
      <path
        d="M39 57V42Q80 5 121 42V57Z"
        fill={era === "ww2" ? "#9ca27c" : "#91ada3"}
      />
      <path
        d="M37 59H123M58 78H69M91 78H102M69 110H91"
        fill="none"
        stroke="#4c5144"
        strokeWidth="5"
      />
      <path d="M80 80L75 98H85" fill="none" stroke="#a07962" strokeWidth="3" />
      <path
        d="M50 125L66 157L80 149L94 157L110 125M80 149V180"
        fill="none"
        stroke="#c3c6a8"
        strokeWidth="3"
      />
      {era === "modern" && (
        <path
          d="M121 62V98L99 105"
          fill="none"
          stroke="#182e31"
          strokeWidth="6"
        />
      )}
      <path d="M22 150H44M116 150H138" stroke="#e8cf91" strokeWidth="5" />
    </svg>
  );
}
export function CampaignSelect({
  progress,
  onMission,
  onBack,
  onFree,
}: {
  progress: CampaignProgress;
  onMission: (m: Mission) => void;
  onBack: () => void;
  onFree: () => void;
}) {
  const [era, setEra] = useState<Era>(
    MISSIONS.find((m) => m.id === progress.current)?.era ?? "ww2",
  );
  return (
    <section className="campaign-screen">
      <div className="campaign-heading">
        <div>
          <small>STORY CAMPAIGN / 작전 기록</small>
          <h1>CHRONICLES OF WAR</h1>
          <p>두 시대. 서로 다른 지휘관. 한 발에 담긴 책임.</p>
        </div>
        <button onClick={onBack}>← 메인 메뉴</button>
      </div>
      <div className="campaign-era-tabs">
        <button aria-pressed={era === "ww2"} onClick={() => setEra("ww2")}>
          1944–1945 · 제2차 세계대전 <small>아서 베넷의 기록 / 3개 임무</small>
        </button>
        <button
          aria-pressed={era === "modern"}
          onClick={() => setEra("modern")}
        >
          2020s · 가상의 현대전 <small>윤서진의 기록 / 3개 임무</small>
        </button>
      </div>
      <div className="campaign-overview">
        <CampaignArt field={era === "ww2" ? "normandy" : "frontier"} />
        <div>
          <small>
            {era === "ww2"
              ? "WESTERN FRONT / 1944–1945"
              : "FICTIONAL FRONT / 2020s"}
          </small>
          <h2>{era === "ww2" ? "포성 너머의 길" : "드론 아래의 그림자"}</h2>
          <p>
            {era === "ww2"
              ? "노르망디에서 독일 서부까지. 연합군의 신임 지휘관이 되어 세 번의 작전을 지휘하세요."
              : "가상 국가 세라 연방의 국경. 새로운 지휘관이 무인 장비와 전자전에 맞섭니다."}
          </p>
          <b>
            보급 점수 {progress.supplies} · 완료 {progress.completed.length}/
            {MISSIONS.length}
          </b>
          <p className="historical-note">
            역사적 시대 배경 위의 가상 인물·차량·전투입니다. 현대전은 실제 특정
            전쟁의 재현이나 1945년 전쟁의 연장이 아닙니다.
          </p>
        </div>
      </div>
      <div className="mission-grid">
        {MISSIONS.filter((m) => m.era === era).map((m) => {
          const locked = !progress.unlocked.includes(m.id),
            done = progress.completed.includes(m.id);
          return (
            <article
              className={"mission-card " + (locked ? "locked" : "")}
              key={m.id}
            >
              <CampaignArt field={m.config.field} />
              <div>
                <small>
                  MISSION 0{m.number} · {m.date} ·{" "}
                  {
                    { easy: "쉬움", normal: "보통", hard: "어려움" }[
                      m.difficulty
                    ]
                  }
                </small>
                <h3>{m.title}</h3>
                <p>{m.objective}</p>
                <p className="loadout">
                  {m.config.weapons
                    .map((w) => weaponInfo(w, m.era).short)
                    .join(" / ")}
                  {m.config.supports.map((w) => " / " + AIR[w].name).join("")}
                </p>
                <strong>
                  {done
                    ? "완료 · 최고 등급 " + progress.grades[m.id]
                    : locked
                      ? "이전 임무를 완료하면 해금"
                      : "출격 가능"}
                </strong>
                <button
                  className="primary"
                  disabled={locked}
                  onClick={() => onMission(m)}
                >
                  {locked ? "잠김" : done ? "임무 다시 플레이" : "브리핑 보기"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="campaign-bottom">
        <p>
          보급 점수는 최초 승리 보상입니다. 재도전은 최고 등급을 갱신하며,
          장비·체력은 매번 초기화됩니다.
        </p>
        <button onClick={onFree}>자유 전투로 이동 →</button>
      </div>
    </section>
  );
}
export function MissionBriefing({
  mission: m,
  onStart,
  onBack,
}: {
  mission: Mission;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <section className="briefing-screen">
      <CampaignArt field={m.config.field} />
      <div className="briefing-body">
        <small>
          MISSION 0{m.number} / {m.date} / {m.location}
        </small>
        <h1>{m.title}</h1>
        <div className="radio-brief">
          <Portrait era={m.era} />
          <div>
            <small>
              RADIO / {m.era === "ww2" ? "아서 베넷 소위" : "윤서진 대위"} ·
              가상 인물
            </small>
            <p>{m.briefing}</p>
          </div>
        </div>
        <div className="briefing-orders">
          <div>
            <b>작전 목표</b>
            <p>{m.objective}</p>
          </div>
          <div>
            <b>전술 안내</b>
            <p>{m.tip}</p>
          </div>
        </div>
        <p className="historical-note">
          차량·전투·대사는 창작입니다.{" "}
          {m.config.objective
            ? m.config.objective.type === "defend"
              ? "시설과 차량 생존이 모두 필요합니다. 적을 먼저 격파하면 조기 성공합니다."
              : "시설 파괴가 목표입니다. 플레이어 파괴 또는 제한 라운드 초과 시 실패합니다."
            : "임무는 적 격파 시 성공하며, 40라운드 초과 시 실패합니다."}
        </p>
        <div className="briefing-actions">
          <button onClick={onBack}>← 임무 선택</button>
          <button className="primary" onClick={onStart}>
            작전 시작
          </button>
        </div>
      </div>
    </section>
  );
}
const TRANSITION = [
  [
    "1945",
    "하나의 기록이 끝났다.",
    "베넷의 부대는 포성이 잦아든 전장을 떠난다.",
  ],
  [
    "AFTER THE WAR",
    "기술은 다른 길을 열었다.",
    "장갑과 항공 기술, 통신 체계가 변한다.",
  ],
  [
    "A NEW ERA",
    "하늘에는 새로운 눈이 생겼다.",
    "드론, 유도 무기, 전자전이 전장의 판단을 바꾼다.",
  ],
  [
    "2020s · FICTION",
    "다른 시대, 다른 지휘관.",
    "가상 국가 세라 연방. 윤서진 대위의 이야기가 시작된다.",
  ],
];
export function EraTransition({ onDone }: { onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (elapsed >= 16) onDone();
  }, [elapsed, onDone]);
  const step = Math.min(3, Math.floor(elapsed / 4));
  return (
    <section className="era-transition" aria-label="시대 전환">
      <CampaignArt key={step} field={step < 2 ? "fortress" : "frontier"} />
      <div>
        <small>{TRANSITION[step][0]}</small>
        <h1>{TRANSITION[step][1]}</h1>
        <p>{TRANSITION[step][2]}</p>
        <progress max="16" value={elapsed} />
        <p>두 전쟁과 주인공은 연결되지 않는 별개의 이야기입니다.</p>
        <button onClick={onDone}>건너뛰고 현대전으로 →</button>
      </div>
    </section>
  );
}
export function MissionResult({
  mission: m,
  result: r,
  progress,
  reward,
  onRetry,
  onNext,
  onBack,
}: {
  mission: Mission;
  result: BattleResult;
  progress: CampaignProgress;
  reward: number;
  onRetry: () => void;
  onNext: (m: Mission) => void;
  onBack: () => void;
}) {
  const win = missionSucceeded(m.config, r),
    next = nextMission(m.id);
  return (
    <section className="mission-result">
      <CampaignArt field={m.config.field} completion={win} />
      <div>
        {win && r.objective && (
          <div className="operation-cinematic" role="status">
            <span>
              {r.objective.type === "defend"
                ? "▰ ▰ ▰ 지원부대 도착"
                : "◉ → ○ 적 감시망 차단"}
            </span>
            <b>
              {r.objective.type === "defend"
                ? "통신망 연결 유지"
                : "레이더 신호 소실"}
            </b>
          </div>
        )}
        <small>MISSION 0{m.number} / AFTER ACTION REPORT</small>
        <h1>
          {win ? "작전 성공" : "작전 실패"} · {m.title}
        </h1>
        <p>
          {win
            ? m.epilogue
            : r.reason
              ? REASON_TEXT[r.reason]
              : r.enemyHp > 0 && r.hp > 0
                ? "40라운드 안에 격파하지 못했습니다. 다음 출격에서 다시 도전하세요."
                : "차량을 정비하고 같은 임무에 다시 도전할 수 있습니다."}
        </p>
        <div className="campaign-stat-grid">
          <span>
            평가<b>{win ? missionGrade(r) : "—"}</b>
          </span>
          <span>
            남은 HP<b>{r.hp}</b>
          </span>
          <span>
            명중 / 발사
            <b>
              {r.hits} / {r.shots}
            </b>
          </span>
          <span>
            피해량<b>{r.damage}</b>
          </span>
          <span>
            시간
            <b>
              {Math.floor(r.seconds / 60)}:
              {String(r.seconds % 60).padStart(2, "0")}
            </b>
          </span>
          <span>
            보급 보상<b>+{reward}</b>
          </span>
        </div>
        {r.objective && (
          <p className="objective-result">
            {r.objective.type === "defend"
              ? "통신시설 잔여 HP " +
                r.objective.hp +
                " · 보강 회복 " +
                r.objective.restored
              : "레이더 잔여 HP " + r.objective.hp}{" "}
            · 완료 라운드 {r.round} · {r.reason ? REASON_TEXT[r.reason] : ""}
          </p>
        )}
        {win && (
          <p>
            해금 기록: {m.unlocks.join(" · ")}
            <br />
            누적 보급 {progress.supplies} · 최고 등급 {progress.grades[m.id]}
            {reward === 0 ? " · 재도전 보상 중복 지급 없음" : ""}
          </p>
        )}
        <div className="briefing-actions">
          <button onClick={onRetry}>임무 재도전</button>
          <button onClick={onBack}>임무 선택</button>
          {win && next && (
            <button className="primary" onClick={() => onNext(next)}>
              {m.number === 3 ? "다음 시대의 이야기" : "다음 임무"}
            </button>
          )}
          {win && !next && (
            <strong>
              FRONTLINE COMPLETE · {MISSIONS.length}/{MISSIONS.length} · 후속
              작전 준비 중
            </strong>
          )}
        </div>
      </div>
    </section>
  );
}
