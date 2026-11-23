import type { Battle } from "../game/engine";
import { CONVOY_ROUTE, WAVES } from "../game/operations";
export function BreakthroughHUD({
  battle: b,
  ready,
  onProtect,
}: {
  battle: Battle;
  ready: boolean;
  onProtect: () => void;
}) {
  if (b.convoy && b.facility) {
    const v = b.convoy,
      f = b.facility;
    return (
      <section
        className="operation-panel convoy-panel"
        aria-label="호송 작전 HUD"
      >
        <div className="operation-status">
          <small>
            CONVOY / WAVE {v.wave + 1} / {WAVES.length}
          </small>
          <strong>
            보급 차량 <span data-testid="convoy-hp">{f.hp} / 80</span>
          </strong>
          <progress aria-label="보급 차량 체력" value={f.hp} max={80} />
          <span>
            호송 <b data-testid="convoy-progress">{v.checkpoint} / 5</b> · 남은
            라운드 {Math.max(0, 18 - b.completedRounds)}
          </span>
          <span>
            현재 x {Math.round(f.x)} · 목적지까지{" "}
            {Math.max(0, Math.round(CONVOY_ROUTE[5] - f.x))} · 격파 {v.kills}/3
          </span>
        </div>
        <div className="operation-actions">
          <strong>{b.enemyName}</strong>
          <span>
            현재 적 표적:{" "}
            {b.aiAttackTarget === "objective" ? "보급 차량" : "플레이어 전차"}
          </span>
          <button
            disabled={!ready || !b.canProtectConvoy()}
            onClick={onProtect}
          >
            호송 보호 · 방어막 1개 · 공격 턴 사용
          </button>
          <small>
            {v.shield
              ? "호송 방어막 전개됨 · 다음 적 공격 50% 감소"
              : b.convoyCovered
                ? "전방 차폐 활성 · 적의 트럭 피해 25% 감소"
                : "트럭 앞 180 이내로 이동하면 차폐·호송 보호 가능"}
          </small>
        </div>
        <p className={f.hurt > 0 ? "objective-warning" : ""} role="status">
          {v.moving
            ? "보강된 호송 차선 주행 중 · 포격에도 통행 유지"
            : v.warning}
        </p>
      </section>
    );
  }
  if (b.boss) {
    const x = b.boss;
    return (
      <section
        className={"operation-panel boss-panel phase-" + x.phase}
        aria-label="보스 작전 HUD"
      >
        <div className="operation-status">
          <small>IRON CITADEL / ARMORED COMMANDER</small>
          <strong data-testid="boss-phase">
            PHASE {x.phase} ·{" "}
            {["강철 장갑", "방어선 붕괴", "최후의 반격"][x.phase - 1]}
          </strong>
          <progress aria-label="보스 체력" value={b.ai.hp} max={100} />
          <span>
            보스 HP {b.ai.hp}/100 · 남은 라운드 {Math.max(0, 19 - b.round)}
          </span>
          <span>
            방어 상태:{" "}
            {x.phase === 1
              ? "장갑 " + x.plates + "/3 · 피해 45% 감소"
              : "장갑 해제 · 정상 피해"}{" "}
            · 방어막 {b.ai.shields}/1
          </span>
        </div>
        <div className="operation-actions">
          <strong>
            {x.phase === 1
              ? "약점: 유효 공격 3회 / 기초 지형 15 / x≥550 전진"
              : x.phase === 2
                ? "특수탄 예고 → EMP 또는 방어막"
                : "폭격 구역 예고 → 이동 또는 방어막"}
          </strong>
          <small>
            내 자원 · 정비 {b.player.repairs} · 방어막 {b.player.shields} · EMP{" "}
            {b.player.emp} · 항공 {b.player.airRemaining}
          </small>
        </div>
        <p role="status" className="objective-warning">
          {x.warning}
        </p>
      </section>
    );
  }
  return null;
}
