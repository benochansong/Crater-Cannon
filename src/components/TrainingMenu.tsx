import type { Battle } from "../game/engine";
import { TRAINING_TARGETS, loadTraining } from "../game/training";
import type { TrainingTarget } from "../game/training";
export function TrainingMenu({
  onStart,
  onBack,
}: {
  onStart: (id: TrainingTarget) => void;
  onBack: () => void;
}) {
  const records = loadTraining();
  return (
    <section className="training-menu">
      <small>FIRING RANGE</small>
      <h1>사격 훈련</h1>
      <p>반격 없이 각도 · 세기 · 바람을 익히세요. 포탄은 무제한입니다.</p>
      <div className="training-targets">
        {TRAINING_TARGETS.map((t) => (
          <button key={t.id} onClick={() => onStart(t.id)}>
            <span className="target-symbol">◎</span>
            <small>TARGET {t.id}</small>
            <strong>{t.name}</strong>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
      <p>목표를 바꾸면 지형이 복원됩니다. 세션 통계는 이어집니다.</p>
      {records[0] && (
        <p>
          최근 훈련: {records[0].shots}발 · 명중 {records[0].hits} · 직격{" "}
          {records[0].direct} · 최고 연속 {records[0].bestStreak}
        </p>
      )}
      <button className="primary" onClick={onBack}>
        메인 메뉴
      </button>
    </section>
  );
}
export function TrainingHUD({
  battle: b,
  onTarget,
  onRestart,
  onLesson,
  onUpdate,
}: {
  battle: Battle;
  onTarget: (id: TrainingTarget) => void;
  onRestart: () => void;
  onLesson: (n: number) => void;
  onUpdate: () => void;
}) {
  const s = b.trainingStats;
  if (!s) return null;
  const ready = b.phase === "aim",
    lesson = b.trainingLesson;
  return (
    <section className="training-hud" aria-label="사격 훈련 통계">
      <div className="training-controls">
        <b>FIRING RANGE · 반격 없음</b>
        <label>
          훈련 목표{" "}
          <select
            aria-label="훈련 목표"
            value={b.config.training}
            disabled={!ready}
            onChange={(e) => onTarget(e.target.value as TrainingTarget)}
          >
            {TRAINING_TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                TARGET {t.id} · {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          훈련 바람{" "}
          <input
            aria-label="훈련 바람"
            type="range"
            min="-5"
            max="5"
            value={b.wind}
            disabled={!ready}
            onChange={(e) => {
              b.setTrainingWind(Number(e.target.value));
              onUpdate();
            }}
          />
          {b.wind}
        </label>
        <button onClick={onRestart}>훈련 다시 시작</button>
      </div>
      <div className="training-stats">
        <span>
          발사 <b>{s.shots}</b>
        </span>
        <span>
          명중 <b>{s.hits}</b>
        </span>
        <span>
          직접 명중 <b>{s.direct}</b>
        </span>
        <span>
          연속 명중 <b>{s.streak}</b>
        </span>
        <span>
          평균 착탄 오차{" "}
          <b>{s.errorCount ? Math.round(s.errorTotal / s.errorCount) : "—"}</b>
        </span>
      </div>
      <small>
        거리: 게임 월드 단위 · 오차는 목표 중심까지의 거리, 전장 이탈 제외 ·
        캠페인 보상과 별도 기록
      </small>
      {lesson > 0 && (
        <div className="training-lesson">
          <b>LESSON {lesson} / 3</b>
          <p>
            {lesson === 1
              ? "각도를 고정했습니다. 세기를 바꾸며 궤적의 길이를 살펴보세요."
              : lesson === 2
                ? "세기를 고정했습니다. 각도를 높인다고 항상 더 멀리 날아가지는 않습니다."
                : "바람이 부는 상태에서 궤적을 비교하세요. TARGET C를 선택해 높이 차이도 살펴보세요."}
          </p>
          <button
            disabled={!ready}
            onClick={() => onLesson(lesson === 3 ? 0 : lesson + 1)}
          >
            {lesson === 3 ? "자유 훈련 시작" : "다음 학습"}
          </button>
          <button disabled={!ready} onClick={() => onLesson(0)}>
            학습 건너뛰기
          </button>
        </div>
      )}
    </section>
  );
}
