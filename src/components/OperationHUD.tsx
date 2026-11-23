import type { Battle } from "../game/engine";
export function OperationHUD({
  battle: b,
  ready,
  onChoose,
  onReinforce,
}: {
  battle: Battle;
  ready: boolean;
  onChoose: (id: "ai" | "objective") => void;
  onReinforce: () => void;
}) {
  const f = b.facility,
    o = b.config.objective;
  if (!f || !o || b.convoy) return null;
  const defend = o.type === "defend",
    left = Math.max(0, o.rounds - b.completedRounds);
  const stage = defend
    ? b.completedRounds >= 4
      ? "마지막 방어"
      : b.completedRounds > 0
        ? "집중 공격"
        : b.turn === "ai"
          ? "적의 첫 공격"
          : "방어 준비"
    : f.hp < f.maxHp
      ? "시설 공격"
      : "목표 탐색";
  return (
    <section className="operation-panel" aria-label="작전 목표 HUD">
      <div className="operation-status">
        <small>
          {defend ? "DEFEND / 시설 방어" : "DESTROY / 시설 파괴"} · {stage}
        </small>
        <strong>
          {f.name}{" "}
          <span data-testid="facility-hp">
            {f.hp} / {f.maxHp}
          </span>
        </strong>
        <progress aria-label="목표 시설 체력" max={f.maxHp} value={f.hp} />
        <span>
          {defend ? "남은 방어" : "남은 제한"} 라운드{" "}
          <b data-testid="objective-rounds">
            {left} / {o.rounds}
          </b>
          {!defend &&
            " · 파괴 진행 " + Math.round((1 - f.hp / f.maxHp) * 100) + "%"}
        </span>
      </div>
      <div className="operation-actions">
        <div className="objective-targets">
          <button
            disabled={!ready || f.hp <= 0}
            aria-pressed={b.selectedTarget === "objective"}
            onClick={() => onChoose("objective")}
          >
            {defend ? "통신시설 확인" : "레이더 시설 목표 선택"}
          </button>
          <button
            disabled={!ready || b.ai.hp <= 0}
            aria-pressed={b.selectedTarget === "ai"}
            onClick={() => onChoose("ai")}
          >
            {b.ai.hp <= 0 ? "방어 전차 격파됨" : "적 전차 목표 선택"}
          </button>
        </div>
        {defend ? (
          <button
            className="reinforce-button"
            disabled={!ready || !b.canReinforce()}
            onClick={onReinforce}
          >
            시설 긴급 보강 +15 · {b.reinforcement}/1 · 공격 턴 사용
          </button>
        ) : (
          <small>
            전차 격파만으로 성공하지 않습니다 · 시설 클릭 또는 목표 버튼
          </small>
        )}
      </div>
      <p role="status" className={b.turn === "ai" ? "objective-warning" : ""}>
        {defend
          ? b.turn === "ai"
            ? b.aiAttackTarget === "objective"
              ? "⚠ 적 공격 표적: 통신시설 · 포격에 대비하세요"
              : "⚠ 적 공격 표적: 플레이어 차량"
            : "시설과 차량 모두 생존해야 합니다 · 차량 방어막은 시설에 적용되지 않습니다"
          : b.ai.hp <= 0
            ? "적 차량 행동 중지 · 남은 라운드 안에 레이더를 파괴하세요"
            : "적 차량과 레이더 중 공격 목표를 선택하세요"}
      </p>
    </section>
  );
}
