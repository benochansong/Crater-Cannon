import { useState } from "react";
import type { Battle } from "../game/engine";
import { weaponHintSeen, markWeaponHint } from "../game/storage";
export function Mobility({
  battle,
  ready,
  onDrive,
}: {
  battle: Battle;
  ready: boolean;
  onDrive: (direction: number) => void;
}) {
  const [hint, setHint] = useState(() => !weaponHintSeen("mobility"));
  const m = battle.player.mobility;
  const unavailable = battle.adjustmentReason();
  const dismiss = () => {
    markWeaponHint("mobility");
    setHint(false);
  };
  return (
    <div className="mobility-panel">
      <div className="mobility-summary">
        <strong>
          전술 이동 <kbd>A</kbd> / <kbd>D</kbd>
        </strong>
        <progress aria-label="남은 단거리 이동" max={60} value={m.remaining} />
        <b data-testid="mobility-budget">{Math.ceil(m.remaining)} / 60</b>
        <span role="status">
          {!ready
            ? "공격 턴 대기"
            : unavailable ||
              m.reason ||
              (m.input
                ? "이동 중 · 정지 후 발사"
                : m.used
                  ? "정지 후 발사 · 장거리 기동 잠김"
                  : "정지 후 발사 가능")}
        </span>
      </div>
      <div className="mobility-buttons">
        {([-1, 1] as const).map((direction) => (
          <button
            key={direction}
            aria-label={
              direction < 0 ? "단거리 왼쪽 이동" : "단거리 오른쪽 이동"
            }
            disabled={!ready || !!unavailable}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              dismiss();
              onDrive(direction);
            }}
            onPointerUp={() => onDrive(0)}
            onPointerCancel={() => onDrive(0)}
            onLostPointerCapture={() => onDrive(0)}
            onBlur={() => onDrive(0)}
            onKeyDown={(e) => {
              if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                e.preventDefault();
                dismiss();
                onDrive(direction);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onDrive(0);
              }
            }}
          >
            {direction < 0 ? "← A" : "D →"}
            <small>길게 누르기</small>
          </button>
        ))}
      </div>
      {hint && !m.used && (
        <div className="mobility-hint">
          A/D로 최대 60 이동한 뒤 발사하세요. 왕복 거리도 합산됩니다.
          방어·기동의 장거리 이동은 최대 145, 공격 턴을 사용하며 단거리 이동과
          같은 턴에 함께 쓸 수 없습니다.
          <button onClick={dismiss} aria-label="이동 안내 닫기">
            확인
          </button>
        </div>
      )}
    </div>
  );
}
