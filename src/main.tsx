import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Battle, WEAPONS, WIDTH, HEIGHT } from "./game/engine";
import type { Difficulty, WeaponId } from "./game/engine";
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
} from "./game/storage";
import "./style.css";
import { attachQA } from "./game/qa";
const difficultyNames: Record<Difficulty, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};
const weaponIds: WeaponId[] = ["shell", "crater", "shock"];
const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
function AmmoIcon({ kind }: { kind: WeaponId }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <g transform="rotate(35 20 20)">
        <path
          d="M13 28V14Q20 0 27 14v14z"
          fill={WEAPONS[kind].color}
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M11 28h18v6H11z" fill="currentColor" />
        <path d="M14 20h12" stroke="currentColor" strokeWidth="3" />
        {kind === "shock" && (
          <path
            d="m21 12-4 7h6l-4 6"
            fill="none"
            stroke="white"
            strokeWidth="2"
          />
        )}
      </g>
    </svg>
  );
}
function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [battle, setBattle] = useState(() => new Battle(settings.difficulty));
  const [screen, setScreen] = useState<"menu" | "battle" | "result">("menu");
  const [overlay, setOverlay] = useState<
    "help" | "records" | "settings" | null
  >(null);
  const [tutorial, setTutorial] = useState(() => !tutorialSeen());
  const [, refresh] = useState(0);
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
    saveSettings(settings);
    sound.configure(settings.volume, settings.muted);
  }, [settings, sound]);
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
        battle.update(renderer.simulationDelta(dt));
        for (const event of battle.drainEvents()) {
          renderer.event(event);
          sound.event(event);
        }
        if (battle.result && recorded.current !== battle.result.id) {
          recorded.current = battle.result.id;
          saveRecord(battle.result);
          setScreen("result");
        }
      }
      sound.flight(screen === "battle" && !stopped ? battle.projectile : null);
      const ctx = canvas.current?.getContext("2d");
      if (ctx)
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
  }, [battle, renderer, sound, screen, paused, settings.shake]);
  function aim(angle: number, power: number) {
    battle.aim(angle, power);
    refresh((n) => n + 1);
  }
  function select(weapon: WeaponId) {
    battle.select(weapon);
    refresh((n) => n + 1);
  }
  function fire() {
    sound.unlock();
    if (battle.fire()) {
      finishTutorial();
      setTutorial(false);
      refresh((n) => n + 1);
    }
  }
  function start() {
    sound.unlock();
    sound.stop();
    setBattle(new Battle(settings.difficulty));
    recorded.current = null;
    setScreen("battle");
    setOverlay(null);
    setTutorial(!tutorialSeen());
  }
  function menu() {
    sound.stop();
    setScreen("menu");
    setOverlay(null);
    setBattle(new Battle(settings.difficulty));
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        screen !== "battle" ||
        overlay ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const target = event.target as HTMLElement;
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
        ].includes(event.key)
      )
        event.preventDefault();
      if (event.key === "ArrowUp")
        aim(battle.player.angle + step, battle.player.power);
      if (event.key === "ArrowDown")
        aim(battle.player.angle - step, battle.player.power);
      if (event.key === "ArrowRight")
        aim(battle.player.angle, battle.player.power + step);
      if (event.key === "ArrowLeft")
        aim(battle.player.angle, battle.player.power - step);
      if (["1", "2", "3"].includes(event.key))
        select(weaponIds[Number(event.key) - 1]);
      if (event.key === " " && !event.repeat) fire();
      if (event.key === "Escape") setOverlay("settings");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function drag(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging.current || screen !== "battle" || paused) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const { x, y } = renderer.camera.toWorld({
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    });
    aim(
      (Math.atan2(battle.player.y - 15 - y, Math.max(1, x - battle.player.x)) *
        180) /
        Math.PI,
      battle.player.power,
    );
  }
  const ready = screen === "battle" && battle.phase === "aim" && !paused;
  const status =
    battle.phase === "aim"
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
          <span className="edition">EXPLOSIVE BATTLE</span>
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
      <section
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
                <button className="primary start" onClick={start}>
                  <span>게임 시작</span>
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
                      <strong>블루 코멧</strong>
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
                      <strong>레드 배저</strong>
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
                className={`turn-banner ${battle.phase === "flight" || battle.phase === "resolve" ? "in-flight" : ""} ${battle.turn === "ai" ? "enemy-turn" : ""}`}
                role="status"
              >
                <b>{battle.turn === "player" ? "내 차례" : "상대 차례"}</b>
                <span>{status}</span>
              </div>
              {tutorial && screen === "battle" && (
                <div className="tutorial">
                  <span>첫 포격 가이드</span> 각도 조절 <b>→</b> 세기 조절{" "}
                  <b>→</b> 바람 확인 <b>→</b> 발사
                </div>
              )}
              <div className="arena-footer">
                <span>
                  GREEN VALLEY <i>그린 밸리</i>
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
            <small>2D 포격 대전 · 지형 파괴 · 3종의 포탄</small>
          </div>
        ) : (
          <section className="controls" aria-label="포격 조작 패널">
            <div className="weapon-select">
              <div className="control-label">
                탄약 선택 <span>1 / 2 / 3</span>
              </div>
              <div className="weapons">
                {weaponIds.map((id, i) => (
                  <button
                    key={id}
                    className={`weapon ${battle.weapon === id ? "selected" : ""}`}
                    disabled={!ready || battle.player.ammo[id] === 0}
                    onClick={() => select(id)}
                    aria-pressed={battle.weapon === id}
                    title={WEAPONS[id].description}
                    aria-label={`${WEAPONS[id].name} 선택`}
                  >
                    <AmmoIcon kind={id} />
                    <span>
                      {WEAPONS[id].short}
                      <small>
                        {i === 0
                          ? "무제한"
                          : `${battle.player.ammo[id]}발 남음`}
                      </small>
                    </span>
                    <kbd>{i + 1}</kbd>
                  </button>
                ))}
              </div>
            </div>
            <div className="slider-group">
              <label htmlFor="angle">
                포신 각도{" "}
                <b>
                  {battle.player.angle.toFixed(battle.player.angle % 1 ? 1 : 0)}
                  <em>°</em>
                </b>
              </label>
              <input
                id="angle"
                type="range"
                min="10"
                max="80"
                step="0.25"
                value={battle.player.angle}
                disabled={!ready}
                onChange={(e) =>
                  aim(Number(e.target.value), battle.player.power)
                }
              />
              <div className="range-label">
                <span>10°</span>
                <span>↑ ↓ / 드래그</span>
                <span>80°</span>
              </div>
            </div>
            <div className="slider-group power">
              <label htmlFor="power">
                발사 세기{" "}
                <b>
                  {Math.round(battle.player.power)}
                  <em>%</em>
                </b>
              </label>
              <input
                id="power"
                type="range"
                min="20"
                max="100"
                value={battle.player.power}
                disabled={!ready}
                onChange={(e) =>
                  aim(battle.player.angle, Number(e.target.value))
                }
              />
              <div className="range-label">
                <span>20</span>
                <span>← →</span>
                <span>100</span>
              </div>
            </div>
            <button className="primary fire" disabled={!ready} onClick={fire}>
              <span className="crosshair">⊕</span>
              <strong>{ready ? "발사!" : "대기 중"}</strong>
              <small>SPACE</small>
            </button>
          </section>
        )}
      </section>
      <footer className="page-footer">
        <span>한 발의 포탄이 전장의 운명을 바꾼다.</span>
        <div>
          <button onClick={() => setOverlay("help")}>조작 안내</button>
          <span>PHASE 2 / EXPLOSIVE BATTLE</span>
        </div>
      </footer>
      {screen === "result" && result && (
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
            <small>전투 종료 · GREEN VALLEY</small>
            <h2 id="result-title">
              {result.outcome === "victory"
                ? "VICTORY!"
                : result.outcome === "defeat"
                  ? "DEFEAT"
                  : "DRAW"}
            </h2>
            <p>
              {result.outcome === "victory"
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
              <small className="muted">난이도는 새 대결부터 적용됩니다.</small>
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
