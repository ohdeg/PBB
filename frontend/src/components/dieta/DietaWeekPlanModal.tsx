import {
  activityFromExtraKcal,
  type DietaPlateauChoice,
  type DietaWeekProposal,
} from '../../features/dieta/utils/dietaMath';
import type { DietaProfile } from '../../features/dieta/types';

interface DietaWeekPlanModalProps {
  open: boolean;
  profile: DietaProfile;
  proposal: DietaWeekProposal;
  plateauChoice: DietaPlateauChoice;
  onPlateauChoice: (choice: DietaPlateauChoice) => void;
  weightKg: number | null;
  busy?: boolean;
  onClose: () => void;
  /** keepTargets true = 유지, false = 체중 기준 조정 */
  onConfirm: (keepTargets: boolean) => void;
}

export function DietaWeekPlanModal({
  open,
  profile,
  proposal,
  plateauChoice,
  onPlateauChoice,
  weightKg,
  busy = false,
  onClose,
  onConfirm,
}: DietaWeekPlanModalProps) {
  if (!open) {
    return null;
  }

  const canCut = profile.dailyKcal - profile.lossCutKcal >= profile.bmrKcal;
  const activity =
    proposal.proposedActivityExtraKcal > 0
      ? activityFromExtraKcal({
          extraKcal: proposal.proposedActivityExtraKcal,
          weightKg,
          heightCm: profile.heightCm,
        })
      : null;

  const sourceLabel =
    proposal.source === 'FAT'
      ? '체지방'
      : proposal.source === 'MUSCLE'
        ? '근육'
        : proposal.source === 'WEIGHT'
          ? '체중÷1.2'
          : null;

  return (
    <div className="dieta-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dieta-modal"
        role="dialog"
        aria-modal
        aria-labelledby="dieta-week-plan-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dieta-week-plan-title">다음 주 계획</h2>
        <p className="dieta-muted">
          한 주 섭취와 변화를 바탕으로 식사·활동을 제안했어요. 확인해야 적용됩니다.
        </p>

        <section>
          <h3>
            평가 · {proposal.eval}
            {sourceLabel ? ` (${sourceLabel})` : ''}
          </h3>
          {proposal.x != null ? (
            <p>
              X = {proposal.x.toFixed(2)}
              {proposal.weightDeltaKg != null
                ? ` · 체중 ${proposal.weightDeltaKg > 0 ? '+' : ''}${proposal.weightDeltaKg.toFixed(2)} kg`
                : ''}
            </p>
          ) : null}
          <p>
            평균 섭취{' '}
            {proposal.intakeDays > 0
              ? `${proposal.avgIntakeKcal} kcal (${proposal.intakeDays}일)`
              : '기록 없음'}
          </p>
          <p>{proposal.summary}</p>
        </section>

        <section>
          <h3>제안 요약</h3>
          <div className="dieta-list-row">
            <span>일일 식사</span>
            <strong>
              {profile.dailyKcal} → {proposal.proposedDailyKcal} kcal
            </strong>
          </div>
          <div className="dieta-list-row">
            <span>TDEE</span>
            <strong>
              {profile.tdeeKcal} → {proposal.proposedTdee} kcal
            </strong>
          </div>
          <div className="dieta-list-row">
            <span>활동</span>
            <strong>
              {proposal.proposedActivityExtraKcal > 0
                ? `+${proposal.proposedActivityExtraKcal} kcal`
                : '추가 없음'}
            </strong>
          </div>
          {activity ? (
            <p className="dieta-muted">
              ≈ {activity.steps.toLocaleString()}보 · 걷기 {activity.minutesBrisk}분 ·
              중강도 {activity.minutesMod}분
            </p>
          ) : null}
        </section>

        {profile.goalType === 'LOSS' && proposal.eval === 'PLATEAU' ? (
          <section>
            <h3>정체 시 선택</h3>
            <div className="dieta-chip-row">
              <button
                type="button"
                className={`dieta-chip ${plateauChoice === 'CUT_KCAL' ? 'is-active' : ''}`}
                disabled={!canCut}
                onClick={() => onPlateauChoice('CUT_KCAL')}
              >
                식사 감소{canCut ? '' : ' (하한)'}
              </button>
              <button
                type="button"
                className={`dieta-chip ${plateauChoice === 'ADD_ACTIVITY' ? 'is-active' : ''}`}
                onClick={() => onPlateauChoice('ADD_ACTIVITY')}
              >
                활동 증가
              </button>
            </div>
          </section>
        ) : null}

        <section>
          <h3>다음 주 목표</h3>
          <p className="dieta-muted dieta-helper-copy">
            체중은 그대로여도 비체중 신호에 변동이 있으면 유지를 선택하셔도됩니다.
          </p>
          <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.35rem' }}>
            <button
              type="button"
              className="dieta-btn dieta-btn--primary dieta-btn--block"
              disabled={busy}
              onClick={() => onConfirm(false)}
            >
              체중 기준 조정 · 다음 주 시작
            </button>
            <button
              type="button"
              className="dieta-btn dieta-btn--soft dieta-btn--block"
              disabled={busy}
              onClick={() => onConfirm(true)}
            >
              유지 · 다음 주 시작
            </button>
            <button
              type="button"
              className="dieta-btn dieta-btn--ghost dieta-btn--block"
              disabled={busy}
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
