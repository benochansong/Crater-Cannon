import { useState } from "react";
import { AIR } from "../game/airSupport";
import type { AirKind } from "../game/airSupport";
import { Battle, DRONE_TIME, WEAPONS, weaponInfo } from "../game/engine";
import type { WeaponId } from "../game/engine";
export function TacticalIcon({
  kind,
}: {
  kind: "repair" | "shield" | "move" | AirKind;
}) {
  const shapes = {
    artillery: (
      <path
        d="M4 29H36M9 28l5-12 22-9 2 5-18 10v6M12 30v5M30 30v5"
        stroke="#716e51"
        strokeWidth="5"
      />
    ),
    propeller: (
      <path
        d="M20 4v32M4 18h32M11 31h18M11 5h18"
        stroke="#778463"
        strokeWidth="6"
      />
    ),
    repair: (
      <>
        <path d="M10 6h20v28H10z" fill="#b6d693" />
        <path d="M20 12v16M12 20h16" stroke="#38664a" strokeWidth="5" />
      </>
    ),
    shield: (
      <>
        <path d="M20 4 34 10v10c0 9-14 16-14 16S6 29 6 20V10z" fill="#a4dfe5" />
        <path
          d="m13 19 5 5 10-12"
          fill="none"
          stroke="#337c9d"
          strokeWidth="3"
        />
      </>
    ),
    move: (
      <>
        <rect x="6" y="17" width="28" height="13" rx="5" fill="#8baa84" />
        <path
          d="M3 12h34m-7-5 7 5-7 5M10 7l-7 5 7 5"
          fill="none"
          stroke="#48654c"
          strokeWidth="3"
        />
      </>
    ),
    helicopter: (
      <>
        <path d="M5 23h8l7-9h13l4 9-4 6H17l-4-5H5z" fill="#679e94" />
        <path
          d="M12 9h26M24 9v7M3 17v12M15 33h20"
          stroke="#344e49"
          strokeWidth="2.5"
        />
      </>
    ),
    bomber: (
      <path
        d="m20 3 5 13 13 12-2 4-13-6-3 11-3-11-13 6-2-4 13-12z"
        fill="#547787"
        stroke="#30494c"
        strokeWidth="1.5"
      />
    ),
  };
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      {shapes[kind]}
    </svg>
  );
}
export function AmmoIcon({ kind }: { kind: WeaponId | "emp" }) {
  if (kind === "emp")
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M20 3 34 9v11c0 9-14 17-14 17S6 29 6 20V9z"
          fill="#bceef0"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="m23 9-9 13h7l-4 10 10-15h-7z" fill="#3c91a4" />
      </svg>
    );
  if (kind === "drone")
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="m10 13 10 9 10-9M10 29l10-7 10 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        {[
          [9, 11],
          [31, 11],
          [9, 30],
          [31, 30],
        ].map(([x, y]) => (
          <ellipse
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            rx="8"
            ry="3"
            fill="#a2e7b6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        ))}
        <rect
          x="13"
          y="15"
          width="14"
          height="13"
          rx="5"
          fill="#65b78c"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="20" cy="24" r="3" fill="#efffd9" />
      </svg>
    );
  if (kind === "missile")
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <g transform="rotate(35 20 20)">
          <path d="m16 28 4 10 4-10" fill="#ffb63d" />
          <path
            d="M15 28V14L20 3l5 11v14z"
            fill="#f4eed6"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="m15 20-5 10 5-2m10-8 5 10-5-2M15 14h10"
            fill="#f08f64"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </g>
      </svg>
    );
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
interface Props {
  battle: Battle;
  ready: boolean;
  onSelect: (id: WeaponId) => void;
  onAim: (angle: number, power: number) => void;
  onFire: () => void;
  onEmp: () => void;
  onLock: () => void;
  onSteer: (x: number, y: number) => void;
  onFieldDefense: (kind: "smoke" | "cover") => void;
  onRepair: () => void;
  onShield: () => void;
  onMove: (direction: number) => void;
  onAirSelect: (kind: AirKind) => void;
  onAirTarget: (x: number) => void;
}
export function Arsenal({
  battle: b,
  ready,
  onSelect,
  onAim,
  onFire,
  onEmp,
  onLock,
  onSteer,
  onFieldDefense,
  onRepair,
  onShield,
  onMove,
  onAirSelect,
  onAirTarget,
}: Props) {
  const [category, setCategory] = useState<"attack" | "defense" | "air">(
    "attack",
  );
  const flying = b.phase === "drone" && b.turn === "player";
  const selected = weaponInfo(b.weapon, b.config.era);
  function group(ids: WeaponId[], name: string, _start: number) {
    return (
      <div className="arsenal-group">
        <div className="control-label">{name}</div>
        <div className="weapons">
          {ids
            .filter((id) => b.allowedWeapons.includes(id))
            .map((id) => (
              <button
                key={id}
                className={`weapon ${b.weapon === id ? "selected" : ""}`}
                disabled={!ready || b.player.ammo[id] === 0}
                onClick={() => onSelect(id)}
                aria-pressed={b.weapon === id}
                aria-label={`${weaponInfo(id, b.config.era).name} 선택`}
                title={`${weaponInfo(id, b.config.era).description} · 직격 ${weaponInfo(id, b.config.era).directDamage} · ${weaponInfo(id, b.config.era).counter}`}
              >
                <AmmoIcon kind={id} />
                <span>
                  {weaponInfo(id, b.config.era).short}
                  <small>
                    {id === "shell" ? "무제한" : `${b.player.ammo[id]}회 남음`}
                  </small>
                </span>
                <kbd>{b.allowedWeapons.indexOf(id) + 1}</kbd>
              </button>
            ))}
        </div>
      </div>
    );
  }
  return (
    <section className="arsenal-panel" aria-label="포격 조작 패널">
      <div className="arsenal-navigation">
        <div className="category-tabs" aria-label="행동 분류">
          {(
            [
              ["attack", "공격 무기"],
              ["defense", "방어 · 이동"],
              ["air", "항공 지원"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={category === id}
              onClick={() => {
                setCategory(id);
                if (id !== "air") onSelect(b.weapon);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {b.config.era === "modern" && (
          <button
            className={"emp-always " + (b.canEmp("player") ? "available" : "")}
            disabled={!b.canEmp("player")}
            onClick={onEmp}
            aria-label="EMP 방어"
            title="반응 방어 · 턴 소비 없음 · 적 드론/유도탄 출격 중 E"
          >
            <AmmoIcon kind="emp" />
            <span>
              EMP <b>{b.player.emp}/2</b>
              <small>반응 방어 · E · 턴 소비 없음</small>
            </span>
          </button>
        )}
      </div>
      {category === "attack" && (
        <div className="arsenal-rack attack-rack">
          {group(
            b.config.era === "ww2"
              ? ["shell", "ap", "crater"]
              : ["shell", "crater", "shock"],
            "포격 무기",
            1,
          )}
          {b.config.era === "modern" &&
            group(["drone", "missile"], "현대전 무기", 4)}
        </div>
      )}
      {category === "defense" && (
        <div className="tactic-grid">
          <button
            className="tactic-card"
            disabled={!ready || !b.canRepair()}
            onClick={onRepair}
          >
            <TacticalIcon kind="repair" />
            <span>
              <b>
                {b.config.era === "ww2" ? "야전 수리" : "긴급 정비"} ·{" "}
                {b.player.repairs}/{b.config.repairs}
              </b>
              <small>HP +28 · 연속 사용 불가 · 1턴</small>
            </span>
          </button>
          {b.config.era === "modern" && (
            <button
              className="tactic-card"
              disabled={!b.canShield()}
              onClick={onShield}
            >
              <TacticalIcon kind="shield" />
              <span>
                <b>에너지 방어막 · {b.player.shields}/2</b>
                <small>
                  {b.player.shield
                    ? "방어막 유지 중"
                    : "피해 50% 감소 · 반응 R: 무료 / 사전: 1턴"}
                </small>
              </span>
            </button>
          )}
          {b.config.era === "ww2" &&
            (["smoke", "cover"] as const)
              .filter((k) => b.config[k])
              .map((k) => (
                <button
                  key={k}
                  className="tactic-card"
                  disabled={!ready || !b.canFieldDefense(k)}
                  onClick={() => onFieldDefense(k)}
                >
                  <TacticalIcon kind={k === "cover" ? "move" : "artillery"} />
                  <span>
                    <b>
                      {k === "smoke" ? "연막" : "엄폐"} ·{" "}
                      {k === "smoke" ? b.player.smokes : b.player.covers}/2
                    </b>
                    <small>
                      {k === "smoke"
                        ? "다음 적 포격 조준 오차 · 1턴"
                        : "다음 공격 피해 35% 감소 · 1턴"}
                    </small>
                  </span>
                </button>
              ))}
          <button
            className="tactic-card"
            disabled={!ready || !b.canMove(-1)}
            onClick={() => onMove(-1)}
          >
            <TacticalIcon kind="move" />
            <span>
              <b>← 왼쪽 이동</b>
              <small>최대 145 · 급경사 정지 · 1턴</small>
            </span>
          </button>
          <button
            className="tactic-card"
            disabled={!ready || !b.canMove(1)}
            onClick={() => onMove(1)}
          >
            <TacticalIcon kind="move" />
            <span>
              <b>오른쪽 이동 →</b>
              <small>최대 145 · 급경사 정지 · 1턴</small>
            </span>
          </button>
        </div>
      )}
      {category === "air" && (
        <div className="air-cards">
          <small className="air-budget">
            지원 총 {b.player.airRemaining}회 남음
            {b.config.era === "modern" ? " · 헬기/폭격기 공유" : ""}
            {!b.allowedSupports.length ? " · 이 임무에서 지원 없음" : ""}
          </small>
          {b.allowedSupports.map((kind) => (
            <button
              key={kind}
              className={
                "tactic-card " + (b.airSelection === kind ? "selected" : "")
              }
              disabled={!ready || !b.canRequestAir(kind)}
              aria-pressed={b.airSelection === kind}
              aria-label={AIR[kind].name + " 선택"}
              onClick={() => onAirSelect(kind)}
            >
              <TacticalIcon kind={kind} />
              <span>
                <b>
                  {AIR[kind].name} · {b.player.support[kind]}/1
                </b>
                <small>{AIR[kind].callSign} · 요청 1턴 / 상대 대응 1회</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="weapon-intel">
        <b>
          {b.airSelection
            ? AIR[b.airSelection].name + " · 최대 " + AIR[b.airSelection].damage
            : selected.name + " · 직격 " + selected.directDamage}
        </b>
        <span>
          {b.airSelection
            ? AIR[b.airSelection].description
            : selected.description}
        </span>
        <span>
          {b.airSelection ? "대응: 이동 · 방어막 (EMP 무효)" : selected.counter}
        </span>
        {b.config.era === "modern" ? (
          <small>
            상대 EMP {b.ai.emp}/2 · 드론 {b.ai.ammo.drone} · 유도탄{" "}
            {b.ai.ammo.missile}
          </small>
        ) : (
          <small>
            적 장갑 {Math.round((b.fortified ? 0.55 : b.config.armor) * 100)}% ·
            철갑탄 관통 · 연막 {b.ai.smoke ? "활성" : "없음"} · 엄폐{" "}
            {b.ai.cover ? "활성" : "없음"}
          </small>
        )}
      </div>
      <div className="fire-controls">
        {b.airSelection && ready ? (
          <>
            <div className="air-target-control">
              <label htmlFor="air-target">
                지원 구역{" "}
                <b>
                  {b.airTarget === null ? "미지정" : Math.round(b.airTarget)}
                </b>
              </label>
              <input
                id="air-target"
                aria-label="항공 지원 목표 구역"
                type="range"
                min="35"
                max="1245"
                value={b.airTarget ?? 640}
                onChange={(e) => onAirTarget(Number(e.target.value))}
              />
            </div>
            <button
              className="target-button"
              onClick={() => onAirTarget(b.ai.x)}
            >
              적 위치에 구역 지정
            </button>
          </>
        ) : flying ? (
          <>
            <div className="drone-clock">
              <b>
                드론 직접 조작{" "}
                <strong>
                  {Math.max(0, DRONE_TIME - (b.drone?.age ?? 0)).toFixed(1)}초
                </strong>
              </b>
              <span>WASD / 방향키 이동 · Space 공격</span>
              <progress
                max={DRONE_TIME}
                value={Math.max(0, DRONE_TIME - (b.drone?.age ?? 0))}
              />
            </div>
            <div className="drone-pad" aria-label="드론 이동">
              {[
                [0, -1, "↑"],
                [-1, 0, "←"],
                [0, 1, "↓"],
                [1, 0, "→"],
              ].map(([x, y, label]) => (
                <button
                  key={label}
                  aria-label={`드론 ${label} 이동`}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    onSteer(Number(x), Number(y));
                  }}
                  onPointerUp={() => onSteer(0, 0)}
                  onPointerCancel={() => onSteer(0, 0)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSteer(Number(x), Number(y));
                  }}
                  onKeyUp={() => onSteer(0, 0)}
                  onBlur={() => onSteer(0, 0)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="slider-group">
              <label htmlFor="angle">
                포신 각도{" "}
                <b>
                  {b.player.angle.toFixed(b.player.angle % 1 ? 1 : 0)}
                  <em>°</em>
                </b>
              </label>
              <input
                id="angle"
                type="range"
                min="10"
                max="80"
                step=".25"
                value={b.player.angle}
                disabled={!ready || b.weapon === "drone"}
                onChange={(e) => onAim(Number(e.target.value), b.player.power)}
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
                  {Math.round(b.player.power)}
                  <em>%</em>
                </b>
              </label>
              <input
                id="power"
                type="range"
                min="20"
                max="100"
                value={b.player.power}
                disabled={!ready || b.weapon === "drone"}
                onChange={(e) => onAim(b.player.angle, Number(e.target.value))}
              />
              <div className="range-label">
                <span>20</span>
                <span>← →</span>
                <span>100</span>
              </div>
            </div>
          </>
        )}
        <div className="attack-context">
          {b.airSelection ? (
            <span>전장 클릭으로 구역 지정 · 상대 1회 행동 후 실행</span>
          ) : b.weapon === "missile" && ready ? (
            <button
              className={`target-button ${b.target ? "locked" : ""}`}
              onClick={onLock}
            >
              {b.target ? "◎ 목표 지정 완료" : "⊕ 레드 배저 목표 지정"}
            </button>
          ) : (
            <span>
              {flying
                ? "위치를 고른 뒤 폭발시키세요"
                : b.phase === "deploy"
                  ? `전자 무기 출격 준비 ${(b.defense?.remaining ?? 0).toFixed(1)}초`
                  : b.weapon === "drone"
                    ? "출격 후 5초 동안 직접 비행"
                    : selected.control}
            </span>
          )}
        </div>
        <button
          className="primary fire"
          disabled={
            !(
              flying ||
              (ready &&
                (b.airSelection
                  ? b.airTarget !== null && b.canRequestAir(b.airSelection)
                  : b.weapon !== "missile" || b.target !== null))
            )
          }
          onClick={onFire}
        >
          <span className="crosshair">⊕</span>
          <strong>
            {b.airSelection && ready
              ? "지원 요청"
              : flying
                ? "드론 공격"
                : ready
                  ? b.weapon === "drone"
                    ? "드론 출격"
                    : "발사!"
                  : "대기 중"}
          </strong>
          <small>SPACE</small>
        </button>
      </div>
    </section>
  );
}
