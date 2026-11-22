import {
  CampaignSelect,
  MissionBriefing,
  EraTransition,
  MissionResult,
} from "./components/Campaign";
import { getMission } from "./game/campaign";
import type { Mission } from "./game/campaign";
import {
  loadCampaign,
  saveCampaign,
  completeMission,
} from "./game/campaignStorage";
import { AIR } from "./game/airSupport";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Battle, WEAPONS, WEAPON_IDS, WIDTH, HEIGHT } from "./game/engine";
import type { Difficulty, WeaponId } from "./game/engine";
import { Arsenal, AmmoIcon } from "./components/Arsenal";
import { Renderer } from "./game/renderer";
import { Sound } from "./game/audio";
import {
  defaults,
  finishTutorial,
  loadRecords,
  loadSettings,
  saveRecord,
  saveSettings,
  tutorialSeen,
  weaponHintSeen,
  markWeaponHint,
} from "./game/storage";
import "./style.css";
import { attachQA } from "./game/qa";
const difficultyNames: Record<Difficulty, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};
const weaponIds = WEAPON_IDS;
const testSeed =
  import.meta.env.MODE === "test" &&
  new URLSearchParams(location.search).has("seed")
    ? Number(new URLSearchParams(location.search).get("seed"))
    : undefined;
const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
function App() {
  const [progress, setProgress] = useState(loadCampaign);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [reward, setReward] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [battle, setBattle] = useState(
    () => new Battle(settings.difficulty, testSeed),
  );
  const [screen, setScreen] = useState<
    "menu" | "battle" | "result" | "campaign" | "briefing" | "transition"
  >("menu");
  const [overlay, setOverlay] = useState<
    "help" | "records" | "settings" | null
  >(null);
  const [tutorial, setTutorial] = useState(() => !tutorialSeen());
  const [, refresh] = useState(0);
  const [hint, setHint] = useState<"drone" | "missile" | "emp" | null>(null);
  const held = useRef(new Set<string>());
  const canvas = useRef<HTMLCanvasElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const renderer = useMemo(() => new Renderer(), [battle]);
  const sound = useMemo(() => new Sound(), []);
  const recorded = useRef<string | null>(null);
  const dragging = useRef(false);
  const paused = overlay !== null;
  useEffect(() => {
    if (import.meta.env.MODE === "test") return attachQA(battle, renderer);
  }, [battle, renderer]);
  useEffect(() => {
    setSaveFailed(!saveCampaign(progress));
  }, [progress]);
  useEffect(() => {
    saveSettings(settings);
    sound.configure(settings.volume, settings.muted);
    battle.autoEmp = settings.autoEmp;
  }, [settings, sound, battle]);
  useEffect(() => () => sound.dispose(), [sound]);
  useEffect(() => {
    if (overlay) dialog.current?.showModal();
    else dialog.current?.close();
  }, [overlay]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      ui = 0;
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const stopped = paused || document.hidden;
      if (screen === "battle" && !stopped) {
        if (
          battle.phase === "drone" &&
          battle.turn === "player" &&
          held.current.size
        ) {
          battle.steerDrone(
            Number(held.current.has("ArrowRight") || held.current.has("d")) -
              Number(held.current.has("ArrowLeft") || held.current.has("a")),
            Number(held.current.has("ArrowDown") || held.current.has("s")) -
              Number(held.current.has("ArrowUp") || held.current.has("w")),
          );
        }
        battle.update(renderer.simulationDelta(dt));
        for (const event of battle.drainEvents()) {
          renderer.event(event);
          sound.event(event);
          if (
            event.type === "threat" &&
            event.side === "ai" &&
            !weaponHintSeen("emp")
          )
            setHint("emp");
        }
        if (battle.result && recorded.current !== battle.result.id) {
          recorded.current = battle.result.id;
          saveRecord(battle.result);
          const m = getMission(battle.config.missionId);
          if (m) {
            setReward(
              battle.result.outcome === "victory" &&
                battle.result.enemyHp <= 0 &&
                !progress.completed.includes(m.id)
                ? m.reward
                : 0,
            );
            setProgress((p) => completeMission(p, m.id, battle.result!));
          }
          setScreen("result");
        }
      }
      sound.flight(
        screen === "battle" && !stopped
          ? (battle.projectile ?? battle.drone)
          : null,
      );
      const ctx = canvas.current?.getContext("2d");
      if (ctx && ["menu", "battle", "result"].includes(screen))
        renderer.draw(ctx, battle, stopped ? 0 : dt, {
          shake: settings.shake,
          menu: screen === "menu",
        });
      ui += dt;
      if (screen === "battle" && !stopped && ui >= 0.05) {
        ui = 0;
        refresh((n) => n + 1);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [
    battle,
    renderer,
    sound,
    screen,
    paused,
    settings.shake,
    progress.completed,
  ]);
  function aim(angle: number, power: number) {
    battle.aim(angle, power);
    refresh((n) => n + 1);
  }
  function select(weapon: WeaponId) {
    if (battle.phase !== "aim" || battle.player.ammo[weapon] <= 0) return;
    battle.select(weapon);
    if ((weapon === "drone" || weapon === "missile") && !weaponHintSeen(weapon))
      setHint(weapon);
    refresh((n) => n + 1);
  }
  function fire() {
    sound.unlock();
    if (
      battle.airSelection
        ? battle.airTarget !== null &&
          battle.requestAir(battle.airSelection, battle.airTarget)
        : battle.phase === "drone"
          ? battle.attackDrone()
          : battle.fire()
    ) {
      finishTutorial();
      setTutorial(false);
      if (hint) {
        markWeaponHint(hint);
        setHint(null);
      }
      canvas.current?.focus();
      refresh((n) => n + 1);
    }
  }
  function tactic(action: () => boolean) {
    sound.unlock();
    if (action()) {
      finishTutorial();
      setTutorial(false);
      setHint(null);
      held.current.clear();
      canvas.current?.focus();
      refresh((n) => n + 1);
    }
  }
  function emp() {
    sound.unlock();
    if (battle.useEmp("player")) {
      markWeaponHint("emp");
      setHint(null);
      refresh((n) => n + 1);
    }
  }
  function lock() {
    battle.lockTarget("ai");
    refresh((n) => n + 1);
  }
  function dismissHint() {
    if (hint) markWeaponHint(hint);
    setHint(null);
  }
  function openMission(m: Mission) {
    if (!progress.unlocked.includes(m.id)) return;
    setSelectedMission(m);
    setHint(null);
    sound.stop();
    setOverlay(null);
    setProgress((p) => ({ ...p, current: m.id }));
    setScreen(
      m.era === "modern" && !progress.transitionSeen
        ? "transition"
        : "briefing",
    );
  }
  function finishTransition() {
    setProgress((p) => ({ ...p, transitionSeen: true }));
    setScreen("briefing");
  }
  function startMission(m: Mission) {
    held.current.clear();
    setHint(null);
    sound.unlock();
    sound.stop();
    recorded.current = null;
    setBattle(new Battle(m.difficulty, testSeed, m.config));
    setScreen("battle");
    setOverlay(null);
    setTutorial(m.number === 1);
    setReward(0);
  }
  function start() {
    setSelectedMission(null);
    held.current.clear();
    setHint(null);
    sound.unlock();
    sound.stop();
    setBattle(new Battle(settings.difficulty, testSeed));
    recorded.current = null;
    setScreen("battle");
    setOverlay(null);
    setTutorial(!tutorialSeen());
  }
  function menu() {
    held.current.clear();
    setHint(null);
    sound.stop();
    setScreen("menu");
    setOverlay(null);
    setBattle(new Battle(settings.difficulty, testSeed));
  }
  const onKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!down) {
      held.current.delete(key);
      if (!held.current.size) battle.steerDrone(0, 0);
      return;
    }
    if (
      screen !== "battle" ||
      overlay ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (key === "Escape") {
      event.preventDefault();
      setOverlay("settings");
      return;
    }
    if (key === "r") {
      event.preventDefault();
      if (!event.repeat) tactic(() => battle.activateShield());
      return;
    }
    if (key === "e") {
      event.preventDefault();
      if (!event.repeat) emp();
      return;
    }
    const driving = battle.phase === "drone" && battle.turn === "player";
    if (
      driving &&
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
      ].includes(key)
    ) {
      event.preventDefault();
      held.current.add(key);
      return;
    }
    if (driving && key === " ") {
      event.preventDefault();
      if (!event.repeat) fire();
      return;
    }
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement
    )
      return;
    const step = event.shiftKey ? 0.25 : 1;
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        " ",
        "1",
        "2",
        "3",
        "4",
        "5",
      ].includes(key)
    )
      event.preventDefault();
    if (key === "ArrowUp") aim(battle.player.angle + step, battle.player.power);
    if (key === "ArrowDown")
      aim(battle.player.angle - step, battle.player.power);
    if (key === "ArrowRight")
      aim(battle.player.angle, battle.player.power + step);
    if (key === "ArrowLeft")
      aim(battle.player.angle, battle.player.power - step);
    if (["1", "2", "3", "4", "5"].includes(key))
      select(battle.allowedWeapons[Number(key) - 1] ?? "shell");
    if (key === " " && !event.repeat) fire();
  });
  useEffect(() => {
    const down = (e: KeyboardEvent) => onKey(e, true),
      up = (e: KeyboardEvent) => onKey(e, false);
    const clear = () => {
      held.current.clear();
      battle.steerDrone(0, 0);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [battle]);
  useEffect(() => {
    if (paused) {
      sound.stop();
      held.current.clear();
      battle.steerDrone(0, 0);
    }
  }, [paused, battle, sound]);
  function drag(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging.current || screen !== "battle" || paused) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const { x, y } = renderer.camera.toWorld({
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    });
    if (battle.airSelection) {
      battle.setAirTarget(x);
      refresh((n) => n + 1);
      return;
    }
    if (
      battle.weapon === "missile" &&
      Math.hypot(x - battle.ai.x, y - battle.ai.y) < 60
    ) {
      lock();
      return;
    }
    aim(
      (Math.atan2(battle.player.y - 15 - y, Math.max(1, x - battle.player.x)) *
        180) /
        Math.PI,
      battle.player.power,
    );
  }
  const ready = screen === "battle" && battle.phase === "aim" && !paused;
  const status =
    battle.phase === "action"
      ? battle.action?.kind === "repair"
        ? "긴급 정비 중 · 체력 회복"
        : battle.action?.kind === "shield"
          ? "에너지 방어막 전개"
          : "차량 이동 중"
      : battle.phase === "air"
        ? "항공 지원 작전 진행 중"
        : battle.phase === "deploy"
          ? "전자 무기 출격 · EMP 대응 시간"
          : battle.phase === "drone"
            ? battle.turn === "player"
              ? "WASD 이동 · Space 공격"
              : "상대 드론 접근 중"
            : battle.phase === "aim"
              ? "조준하고, 전장을 바꾸세요"
              : battle.phase === "ai-aim"
                ? "상대가 조준하고 있습니다"
                : battle.phase === "flight"
                  ? "포탄 비행 중"
                  : battle.phase === "over"
                    ? "대결 종료"
                    : "착탄 · 지형 변화 중";
  const result = battle.result;
  const records = useMemo(
    () => (overlay === "records" ? loadRecords() : []),
    [overlay],
  );
  return (
    <main className="app">
      <header className="topbar">
        <button
          className="wordmark"
          onClick={menu}
          aria-label="크레이터 캐논 메인 메뉴"
        >
          <span className="brand-icon">✦</span> CRATER CANNON{" "}
          <span className="edition">CHRONICLES OF WAR</span>
        </button>
        <div className="top-actions">
          <span className="local-badge">싱글 플레이 · 로컬 전투</span>
          <button
            className="icon-button"
            onClick={() => setSettings({ ...settings, muted: !settings.muted })}
            aria-label={settings.muted ? "음소거 해제" : "음소거"}
            title={settings.muted ? "음소거 해제" : "음소거"}
          >
            {settings.muted ? "♪̸" : "♫"}
          </button>
          <button
            className="icon-button"
            onClick={() => setOverlay("settings")}
            aria-label="설정"
          >
            ⚙
          </button>
        </div>
      </header>
      {saveFailed && (
        <p role="status" className="save-warning">
          브라우저 저장 공간을 사용할 수 없습니다. 현재 창에서는 진행을
          유지하지만 새로고침하면 사라질 수 있습니다.
        </p>
      )}
      {screen === "campaign" && (
        <CampaignSelect
          progress={progress}
          onMission={openMission}
          onBack={menu}
          onFree={start}
        />
      )}
      {screen === "briefing" && selectedMission && (
        <MissionBriefing
          mission={selectedMission}
          onStart={() => startMission(selectedMission)}
          onBack={() => setScreen("campaign")}
        />
      )}
      {screen === "transition" && <EraTransition onDone={finishTransition} />}
      {screen === "result" && result && selectedMission && (
        <MissionResult
          mission={selectedMission}
          result={result}
          progress={progress}
          reward={reward}
          onRetry={() => startMission(selectedMission)}
          onNext={openMission}
          onBack={() => setScreen("campaign")}
        />
      )}
      <section
        hidden={
          !["menu", "battle", "result"].includes(screen) ||
          (screen === "result" && !!selectedMission)
        }
        className={`game-shell ${screen === "menu" ? "is-menu" : ""}`}
        aria-label="그린 밸리 전장"
      >
        <div className="arena">
          <canvas
            ref={canvas}
            aria-label="포탄을 발사하면 실제로 파괴되는 그린 밸리. 마우스로 드래그하여 포신을 조준하세요."
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              e.currentTarget.focus();
              drag(e);
            }}
            onPointerMove={drag}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
            tabIndex={0}
          />
          {screen === "battle" && battle.config.missionId && (
            <div className="mission-objective">
              <b>{selectedMission?.title}</b>
              <span>
                {battle.config.fortified
                  ? battle.fortified
                    ? "진지 붕괴 " +
                      Math.round(battle.breachProgress * 100) +
                      "% · 철갑 직격 " +
                      battle.breachHits +
                      "/3"
                    : "진지 붕괴 완료 · 지휘 차량 격파"
                  : selectedMission?.objective}
              </span>
            </div>
          )}
          {screen === "battle" &&
            battle.config.era === "modern" &&
            battle.isReaction() &&
            battle.canShield() && (
              <button
                className="reaction-shield"
                onClick={() => tactic(() => battle.activateShield())}
              >
                반응 방어막 [R] · 피해 50% 감소 · 턴 소비 없음{" "}
                {battle.guardTime > 0 ? battle.guardTime.toFixed(1) + "초" : ""}
              </button>
            )}
          {screen === "battle" && battle.canEmp("player") && (
            <div className="emp-alert" role="status">
              <AmmoIcon kind="emp" />
              <div>
                <b>전자 위협 감지! EMP 방어 가능</b>
                <span>
                  {battle.drone ? "드론 공격 정지" : "유도탄 추적 해제"} ·{" "}
                  {(battle.defense?.remaining ?? 0).toFixed(1)}초 남음
                </span>
              </div>
              <button onClick={emp}>EMP 사용 [E]</button>
            </div>
          )}
          {screen === "battle" &&
            battle.phase === "deploy" &&
            battle.turn === "player" && (
              <div className="launch-notice">
                {battle.projectile?.guided === false
                  ? "추적 교란! 탄도 비행으로 전환"
                  : "출격 준비 · 상대 EMP 대응 중"}{" "}
                · {(battle.defense?.remaining ?? 0).toFixed(1)}초
              </div>
            )}
          {battle.pendingAir && screen === "battle" && (
            <div className="air-warning" role="status">
              <b>
                {AIR[battle.pendingAir.kind].callSign} ·{" "}
                {battle.pendingAir.owner === "ai"
                  ? "적 항공 지원 예고"
                  : "아군 지원 예약"}
              </b>
              <span>
                {battle.pendingAir.responseStarted
                  ? "대응 행동 1회 후 실행"
                  : "상대에게 대응 행동 1회 제공"}{" "}
                · 표시 구역을 피하거나 방어 행동을 사용하세요
              </span>
            </div>
          )}
          {hint && screen === "battle" && (
            <div className="weapon-hint">
              <span>
                {hint === "drone"
                  ? "방향키/WASD로 드론을 움직이고 Space로 공격하세요."
                  : hint === "missile"
                    ? "상대 차량 또는 목표 지정 버튼을 누르세요. 유도는 3.2초만 유지됩니다."
                    : "적 전자 공격 출격 중 E 또는 EMP 버튼으로 방어하세요. 설정에서 자동 방어도 가능합니다."}
              </span>
              <button onClick={dismissHint}>건너뛰기</button>
            </div>
          )}
          {screen === "menu" ? (
            <div className="title-screen">
              <div className="title-kicker">
                <span /> GREEN VALLEY · 첫 번째 전장 <span />
              </div>
              <h1>
                CRATER
                <br />
                <span>CANNON</span>
              </h1>
              <p className="slogan">한 발의 포탄이 전장을 바꾼다!</p>
              <div className="title-tag">조준의 긴장감. 명중의 짜릿함.</div>
              <div className="menu-actions">
                <button
                  className="primary campaign-start"
                  onClick={() => {
                    setSelectedMission(null);
                    setScreen("campaign");
                    sound.stop();
                  }}
                >
                  스토리 캠페인 <small>STORY CAMPAIGN</small>
                </button>
                <button
                  className="primary start"
                  onClick={start}
                  aria-label="게임 시작"
                >
                  <span>자유 전투</span>
                  <span className="key-hint">PLAY</span>
                </button>
                <div className="secondary-actions">
                  <button onClick={() => setOverlay("help")}>게임 방법</button>
                  <button onClick={() => setOverlay("records")}>
                    전투 기록
                  </button>
                  <button onClick={() => setOverlay("settings")}>설정</button>
                </div>
              </div>
              <div className="field-label player-label">
                BLUE COMET <b>블루 코멧</b>
              </div>
              <div className="field-label enemy-label">
                RED BADGER <b>레드 배저</b>
              </div>
            </div>
          ) : (
            <>
              <div className="hud">
                <div
                  className={`pilot-card ${battle.turn === "player" ? "active" : ""} ${battle.player.hp <= 25 ? "critical" : ""}`}
                >
                  <div className="pilot-heading">
                    <span className="pilot-avatar blue">01</span>
                    <div>
                      <small>PLAYER</small>
                      <strong>{battle.config.playerName}</strong>
                    </div>
                    <b>
                      {battle.player.hp}
                      <em>/100</em>
                    </b>
                  </div>
                  <div className="health-track">
                    <i style={{ width: `${battle.player.hp}%` }} />
                  </div>
                </div>
                <div className="wind-card">
                  <small>WIND / 바람</small>
                  <strong>
                    {battle.wind < 0 ? "←" : battle.wind > 0 ? "→" : "—"}{" "}
                    <span>{Math.abs(battle.wind)}</span>
                    <em>/ 5</em>
                  </strong>
                  <span className="round-label">
                    ROUND {String(battle.round).padStart(2, "0")}
                  </span>
                </div>
                <div
                  className={`pilot-card enemy ${battle.turn === "ai" ? "active" : ""}`}
                >
                  <div className="pilot-heading">
                    <span className="pilot-avatar red">02</span>
                    <div>
                      <small>AI · {difficultyNames[battle.difficulty]}</small>
                      <strong>{battle.config.enemyName}</strong>
                    </div>
                    <b>
                      {battle.ai.hp}
                      <em>/100</em>
                    </b>
                  </div>
                  <div className="health-track">
                    <i style={{ width: `${battle.ai.hp}%` }} />
                  </div>
                </div>
              </div>
              <div
                className={`turn-banner ${battle.phase === "flight" || battle.phase === "resolve" || battle.phase === "air" ? "in-flight" : ""} ${battle.turn === "ai" ? "enemy-turn" : ""}`}
                role="status"
              >
                <b>{battle.turn === "player" ? "내 차례" : "상대 차례"}</b>
                <span>{status}</span>
              </div>
              {tutorial && !hint && screen === "battle" && (
                <div className="tutorial">
                  <span>첫 포격 가이드</span> 각도 조절 <b>→</b> 세기 조절{" "}
                  <b>→</b> 바람 확인 <b>→</b> 발사
                </div>
              )}
              <div className="arena-footer">
                <span>
                  {battle.config.era === "ww2" ? "1944–1945" : "MODERN"}{" "}
                  <i>{selectedMission?.location ?? "그린 밸리"}</i>
                </span>
                <span>
                  {timeLabel(Math.round(battle.elapsed))} · {battle.stats.shots}{" "}
                  SHOTS
                </span>
              </div>
            </>
          )}
        </div>
        {screen === "menu" ? (
          <div className="menu-footer">
            <span>
              <b>01</b> 조준하고
            </span>
            <i />
            <span>
              <b>02</b> 발사하고
            </span>
            <i />
            <span>
              <b>03</b> 전장을 바꾸세요
            </span>
            <small>포격 · 긴급 정비 · 방어막 · 항공 지원</small>
          </div>
        ) : (
          <Arsenal
            key={battle.seed}
            battle={battle}
            ready={ready}
            onSelect={select}
            onAim={aim}
            onFire={fire}
            onEmp={emp}
            onLock={lock}
            onSteer={(x, y) => battle.steerDrone(x, y)}
            onFieldDefense={(kind) => tactic(() => battle.fieldDefense(kind))}
            onRepair={() => tactic(() => battle.repair())}
            onShield={() => tactic(() => battle.activateShield())}
            onMove={(direction) => tactic(() => battle.move(direction))}
            onAirSelect={(kind) => {
              battle.selectAir(kind);
              refresh((n) => n + 1);
            }}
            onAirTarget={(x) => {
              battle.setAirTarget(x);
              refresh((n) => n + 1);
            }}
          />
        )}
      </section>
      <footer className="page-footer">
        <span>한 발의 포탄이 전장의 운명을 바꾼다.</span>
        <div>
          <button onClick={() => setOverlay("help")}>조작 안내</button>
          <span>PHASE 5 / CHRONICLES OF WAR</span>
        </div>
      </footer>
      {screen === "result" && result && !selectedMission && (
        <div className="result-backdrop">
          <section
            className={`result-card ${result.outcome}`}
            aria-labelledby="result-title"
          >
            <div className="result-star">
              {result.outcome === "victory"
                ? "✦"
                : result.outcome === "draw"
                  ? "◇"
                  : "✧"}
            </div>
            <small>
              {result.hp > 0 && result.enemyHp > 0
                ? "라운드 한도 · 남은 HP 판정"
                : "전투 종료 · GREEN VALLEY"}
            </small>
            <h2 id="result-title">
              {result.outcome === "victory"
                ? "VICTORY!"
                : result.outcome === "defeat"
                  ? "DEFEAT"
                  : "DRAW"}
            </h2>
            <p>
              {result.hp > 0 && result.enemyHp > 0
                ? "40라운드 종료. 남은 체력으로 승부를 판정했습니다."
                : result.outcome === "victory"
                  ? "정확한 한 발, 멋진 승리입니다."
                  : result.outcome === "defeat"
                    ? "다음 한 발은 전장을 바꿀 수 있어요."
                    : "동시 격파! 두 차량이 함께 쓰러졌습니다."}
            </p>
            <div className="result-stats">
              <div>
                <span>남은 체력</span>
                <b>
                  {result.hp}
                  <small>/100</small>
                </b>
              </div>
              <div>
                <span>발사 횟수</span>
                <b>
                  {result.shots}
                  <small>발</small>
                </b>
              </div>
              <div>
                <span>직접 명중</span>
                <b>
                  {result.direct}
                  <small>회</small>
                </b>
              </div>
              <div>
                <span>명중률 · 범위 피해 포함</span>
                <b>
                  {result.shots
                    ? Math.round((result.hits / result.shots) * 100)
                    : 0}
                  <small>%</small>
                </b>
              </div>
              <div>
                <span>총 피해량</span>
                <b>{result.damage}</b>
              </div>
              <div>
                <span>경기 시간</span>
                <b>{timeLabel(result.seconds)}</b>
              </div>
            </div>
            <button className="primary" onClick={start}>
              다시 대결
            </button>
            <button className="text-button" onClick={menu}>
              메인 메뉴
            </button>
          </section>
        </div>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setOverlay(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOverlay(null);
        }}
      >
        <div className="dialog-inner">
          <button
            className="close-button"
            onClick={() => setOverlay(null)}
            aria-label="닫기"
          >
            ×
          </button>
          {overlay === "settings" && (
            <>
              <small className="eyebrow">FIELD SETTINGS</small>
              <h2>전투 설정</h2>
              <p>취향에 맞게 전장을 준비하세요.</p>
              <label className="setting-row">
                AI 난이도
                <select
                  aria-label="AI 난이도"
                  value={settings.difficulty}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      difficulty: e.target.value as Difficulty,
                    })
                  }
                >
                  {Object.entries(difficultyNames).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <small className="muted">
                자유 전투의 새 대결부터 적용됩니다. 캠페인 난이도는 임무별로
                고정됩니다.
              </small>
              <label className="setting-row">
                자동 EMP 방어
                <input
                  type="checkbox"
                  checked={settings.autoEmp}
                  onChange={(e) =>
                    setSettings({ ...settings, autoEmp: e.target.checked })
                  }
                />
              </label>
              <small className="muted">
                전자 위협 감지 0.9초 후 자동 사용 · 경기당 2회 · 대응 창 4초
              </small>
              <label className="setting-row">
                효과음 음소거
                <input
                  type="checkbox"
                  checked={settings.muted}
                  onChange={(e) => {
                    sound.unlock();
                    setSettings({ ...settings, muted: e.target.checked });
                  }}
                />
              </label>
              <label className="setting-row">
                볼륨 <span>{Math.round(settings.volume * 100)}%</span>
              </label>
              <input
                aria-label="볼륨"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(e) => {
                  sound.unlock();
                  setSettings({ ...settings, volume: Number(e.target.value) });
                }}
              />
              <label className="setting-row">
                화면 흔들림
                <input
                  type="checkbox"
                  checked={settings.shake}
                  onChange={(e) =>
                    setSettings({ ...settings, shake: e.target.checked })
                  }
                />
              </label>
              <button
                className="text-button"
                onClick={() => setSettings({ ...defaults })}
              >
                기본 설정으로 복원
              </button>
              <button className="primary" onClick={() => setOverlay(null)}>
                완료
              </button>
            </>
          )}
          {overlay === "help" && (
            <>
              <small className="eyebrow">HOW TO PLAY</small>
              <h2>한 발에 담는 전략</h2>
              <p className="modern-help">
                정비는 HP 28을 회복하며 연속 사용할 수 없습니다. 현대 방어막은
                적 공격 중 R로 반응하면 턴을 소비하지 않고 피해를 50% 줄입니다.
                사전 전개와 이동은 1턴입니다. 자유 전투의 헬기·폭격기는 합계
                1회이며, 요청 후 상대에게 대응 행동 1회를 제공합니다. EMP는
                드론·유도탄 출격 중 4초 안에 E로 사용합니다. 캠페인에서는 시대와
                임무에 맞는 장비만 사용할 수 있습니다. WWII의 연막은 다음 적
                포격 조준을 흔들고, 엄폐는 다음 공격 피해를 35% 줄입니다.
                캠페인은 40라운드 안에 적을 격파해야 하며, 자유 전투는 남은 HP로
                판정합니다.
              </p>
              <div className="help-steps">
                <p>
                  <b>01 · 각도 조절</b>
                  <span>
                    전장에서 드래그하거나 ↑ ↓ 키로 포신을 조준하세요. Shift를
                    함께 누르면 더 세밀하게 조절합니다.
                  </span>
                </p>
                <p>
                  <b>02 · 세기 조절</b>
                  <span>슬라이더 또는 ← → 키로 거리를 조절하세요.</span>
                </p>
                <p>
                  <b>03 · 바람 확인</b>
                  <span>
                    바람은 포탄을 옆으로 밀어요. 서로 한 발씩 쏘면 바람이
                    바뀝니다.
                  </span>
                </p>
                <p>
                  <b>04 · 발사!</b>
                  <span>
                    발사 버튼 또는 Space. 1·2·3 키로 포탄을 선택할 수 있어요.
                  </span>
                </p>
              </div>
              <p className="modern-help">
                자유 전투 드론: 4 선택 → 출격 → WASD/방향키 이동 → Space 공격.
                유도탄: 5 선택 → 목표 지정 → 발사. EMP: 상대 전자 공격 출격 중
                E. 각 전자 무기와 EMP는 경기당 2회입니다. 캠페인 단축키는 각
                장비 카드에 표시됩니다.
              </p>
              <div className="help-weapons">
                {weaponIds.map((id) => (
                  <p key={id}>
                    <AmmoIcon kind={id} />
                    <span>
                      <b>{WEAPONS[id].name}</b>
                      <small>{WEAPONS[id].description}</small>
                    </span>
                  </p>
                ))}
              </div>
              <button className="primary" onClick={() => setOverlay(null)}>
                알겠어요
              </button>
            </>
          )}
          {overlay === "records" && (
            <>
              <small className="eyebrow">BATTLE LOG</small>
              <h2>전투 기록</h2>
              <p>이 브라우저에 최근 20경기가 저장됩니다.</p>
              {records.length === 0 ? (
                <div className="empty-record">
                  <span>✦</span>
                  <b>첫 포격을 기다리고 있어요</b>
                  <p>대결을 마치면 여기에 기록이 남습니다.</p>
                </div>
              ) : (
                <div className="record-list">
                  {records.map((r) => (
                    <article key={r.id}>
                      <b className={r.outcome}>
                        {r.outcome === "victory"
                          ? "승리"
                          : r.outcome === "defeat"
                            ? "패배"
                            : "무승부"}
                      </b>
                      <span>
                        {difficultyNames[r.difficulty]} · {r.shots}발 · 직접
                        명중 {r.direct}회
                        <small>
                          {new Date(r.date).toLocaleDateString("ko-KR")} · 피해{" "}
                          {r.damage} · {timeLabel(r.seconds)}
                        </small>
                      </span>
                      <strong>
                        {r.hp}
                        <small> HP</small>
                      </strong>
                    </article>
                  ))}
                </div>
              )}
              <button className="primary" onClick={() => setOverlay(null)}>
                닫기
              </button>
            </>
          )}
        </div>
      </dialog>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
