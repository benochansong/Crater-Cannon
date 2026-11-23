import type { Battle } from "../game/engine";
import { guideLevel } from "../game/aimPrediction";
import type { AimGuideMode, PredictionCache } from "../game/aimPrediction";
import { shotMessage } from "../game/shotHistory";
export function AimingHUD({
  battle: b,
  cache,
  mode,
}: {
  battle: Battle;
  cache: PredictionCache;
  mode: AimGuideMode;
}) {
  const aiming = b.phase === "aim",
    p = aiming ? cache.get(b, mode) : null,
    level = guideLevel(b, mode);
  const previous = b.shotHistory[0],
    exact = p && level === "full" && !p.uncertain && !p.special;
  return (
    <section className="aiming-hud" aria-label="조준 분석">
      <div className="aim-heading">
        <b>
          SMART AIM{" "}
          <small>
            {
              {
                full: b.config.training
                  ? "훈련 · 전체 예측"
                  : "초보자 · BEGINNER",
                partial: "일반 · BALANCED AIM",
                short: "숙련자 · EXPERT",
                off: "가이드 꺼짐",
              }[level]
            }
          </small>
        </b>
        <span>
          {b.assisted ? "초보자 보조 사용 · " : ""}현재 상태 기준 예상 · 월드
          거리
        </span>
      </div>
      <div className="aim-metrics">
        <span>
          각도 <b>{Math.round(b.player.angle)}°</b>
        </span>
        <span>
          세기 <b>{Math.round(b.player.power)}</b>
        </span>
        <span>
          바람{" "}
          <b>
            {b.wind < 0 ? "←" : b.wind > 0 ? "→" : "—"} {Math.abs(b.wind)}
          </b>
        </span>
        <span>
          목표 거리 <b>{Math.round(Math.abs(b.targetBody.x - b.player.x))}</b>
        </span>
        <span>
          예상 비행 거리{" "}
          <b>{exact && p.range !== null ? Math.round(p.range) : "—"}</b>
        </span>
      </div>
      <div
        className="power-meter"
        role="meter"
        aria-label="발사 세기 게이지"
        aria-valuemin={20}
        aria-valuemax={100}
        aria-valuenow={b.player.power}
      >
        <i style={{ width: b.player.power + "%" }} />
      </div>
      <p className="aim-forecast">
        {!aiming
          ? "사격 처리 중 · 다음 조준을 준비하세요."
          : b.weapon === "drone"
            ? "드론은 수동 조종 · 포물선 예측 없음"
            : p?.special
              ? "유도탄 초기 방향만 표시 · 목표 이동 및 EMP에 따라 변화"
              : p?.uncertain
                ? "⚠ 연막 교란 · 발사 순간 조준 오차 발생, 정확한 수치 숨김"
                : exact && p.impact
                  ? p.reason === "direct"
                    ? "예상 직접 명중 · 목표가 움직이면 결과가 달라집니다."
                    : "예상 · " +
                      shotMessage(p.reason!, p.impact.x - p.setup.target.x)
                  : level === "partial"
                    ? "약 67% 방향 궤적 · 끝부분은 흐리게, 실제 사격 후 오차 분석"
                    : level === "short"
                      ? "방향과 바람을 읽고 이전 착탄으로 보정하세요."
                      : "조준 가이드가 꺼져 있습니다."}
        {b.weapon === "ap" ? " · 철갑탄은 직격이 중요합니다." : ""}
      </p>
      <div className="shot-history">
        <strong>이전 실제 사격</strong>
        {previous ? (
          <>
            <span>
              {shotMessage(
                previous.reason,
                previous.impact
                  ? previous.impact.x - previous.target.x
                  : undefined,
              )}
            </span>
            <small>
              #{previous.sequence} · {previous.angle.toFixed(1)}° / 세기{" "}
              {previous.power.toFixed(1)} / 바람 {previous.wind} · 발사 당시
              목표 기준 · 착탄 오차{" "}
              {previous.error === null ? "—" : Math.round(previous.error)}
            </small>
          </>
        ) : (
          <span>첫 포탄을 발사하면 착탄 분석이 표시됩니다.</span>
        )}
        {b.specialHistory[0] && (
          <small>
            특수 공격 ·{" "}
            {b.specialHistory[0].kind === "drone" ? "드론" : "유도탄"}:{" "}
            {shotMessage(b.specialHistory[0].reason)}
          </small>
        )}
      </div>
    </section>
  );
}
