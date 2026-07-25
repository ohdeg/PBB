import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { BrewJoinRequest, BrewScheduleSlotInput } from '../../types/brew';
import { BrewButton } from './BrewButton';
import { BrewInput } from './BrewInput';
import { BrewModal } from './BrewModal';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

interface DaySlot {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function emptySlot(): DaySlot {
  return { enabled: false, startTime: '09:00', endTime: '18:00' };
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initialSlots(): Record<number, DaySlot> {
  const slots: Record<number, DaySlot> = {};
  for (let d = 1; d <= 7; d += 1) {
    slots[d] = emptySlot();
  }
  return slots;
}

export interface BrewJoinApprovePayload {
  canEditStock: boolean;
  workStartDate: string | null;
  slots: BrewScheduleSlotInput[];
}

interface BrewJoinApproveModalProps {
  open: boolean;
  request: BrewJoinRequest | null;
  loading: boolean;
  onClose: () => void;
  onSave: (payload: BrewJoinApprovePayload) => void;
}

export function BrewJoinApproveModal({
  open,
  request,
  loading,
  onClose,
  onSave,
}: BrewJoinApproveModalProps) {
  const [canEditStock, setCanEditStock] = useState(false);
  const [workStartDate, setWorkStartDate] = useState(todayKey);
  const [bulkStartTime, setBulkStartTime] = useState('09:00');
  const [bulkEndTime, setBulkEndTime] = useState('18:00');
  const [slots, setSlots] = useState<Record<number, DaySlot>>(initialSlots);
  const [bulkHint, setBulkHint] = useState('');

  useEffect(() => {
    if (!open || !request) {
      return;
    }
    setCanEditStock(false);
    setWorkStartDate(todayKey());
    setBulkStartTime('09:00');
    setBulkEndTime('18:00');
    setSlots(initialSlots());
    setBulkHint('');
  }, [open, request?.userId]);

  const applyBulkTimesToSelectedDays = () => {
    const selected = Object.values(slots).some((slot) => slot.enabled);
    if (!selected) {
      setBulkHint('시간을 적용할 요일을 먼저 선택해 주세요.');
      return;
    }
    setBulkHint('');
    setSlots((prev) => {
      const next = { ...prev };
      for (let d = 1; d <= 7; d += 1) {
        const slot = next[d] ?? emptySlot();
        if (slot.enabled) {
          next[d] = {
            ...slot,
            startTime: bulkStartTime,
            endTime: bulkEndTime,
          };
        }
      }
      return next;
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payloadSlots: BrewScheduleSlotInput[] = [];
    for (let d = 1; d <= 7; d += 1) {
      const slot = slots[d];
      if (slot?.enabled) {
        payloadSlots.push({
          dayOfWeek: d,
          startTime: slot.startTime.length === 5 ? `${slot.startTime}:00` : slot.startTime,
          endTime: slot.endTime.length === 5 ? `${slot.endTime}:00` : slot.endTime,
        });
      }
    }
    onSave({
      canEditStock,
      workStartDate: workStartDate.trim() || null,
      slots: payloadSlots,
    });
  };

  return (
    <BrewModal
      open={open}
      title="가입 승인"
      onClose={() => {
        if (!loading) {
          onClose();
        }
      }}
    >
      {request ? (
        <form className="brew-form-stack" onSubmit={handleSubmit}>
          <p className="brew-card-lead">
            {request.nickname} ({request.email}) 승인 시 근무·재고 권한을 함께 저장합니다.
          </p>
          <BrewInput
            label="근무 시작일"
            id="join-work-start"
            type="date"
            required
            value={workStartDate}
            onChange={(e) => setWorkStartDate(e.target.value)}
            hint="이 날짜부터 정규 근무가 달력에 표시됩니다."
          />
          <label className="brew-check">
            <input
              type="checkbox"
              checked={canEditStock}
              onChange={(e) => setCanEditStock(e.target.checked)}
            />
            재고 수정 가능
          </label>
          <div className="brew-stack">
            <p className="brew-field__label">정규 근무 (선택)</p>
            <div className="brew-schedule-bulk">
              <p className="brew-field__label">선택 요일 일괄 시간</p>
              <div className="brew-schedule-slot-row brew-schedule-bulk__row">
                <input
                  type="time"
                  className="brew-field__input brew-schedule-time"
                  value={bulkStartTime}
                  onChange={(e) => setBulkStartTime(e.target.value)}
                  aria-label="일괄 시작 시각"
                />
                <span>~</span>
                <input
                  type="time"
                  className="brew-field__input brew-schedule-time"
                  value={bulkEndTime}
                  onChange={(e) => setBulkEndTime(e.target.value)}
                  aria-label="일괄 종료 시각"
                />
                <BrewButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={applyBulkTimesToSelectedDays}
                >
                  선택 요일에 적용
                </BrewButton>
              </div>
              <p className="brew-field__hint">
                요일을 체크한 뒤 적용하면 같은 시간이 들어갑니다.
              </p>
              {bulkHint ? (
                <p className="brew-field__error" role="alert">
                  {bulkHint}
                </p>
              ) : null}
            </div>
            {DAY_LABELS.map((label, i) => {
              const dow = i + 1;
              const slot = slots[dow] ?? emptySlot();
              return (
                <div key={dow} className="brew-schedule-slot-row">
                  <label className="brew-check">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      onChange={(e) => {
                        setBulkHint('');
                        setSlots((prev) => ({
                          ...prev,
                          [dow]: {
                            ...(prev[dow] ?? emptySlot()),
                            enabled: e.target.checked,
                          },
                        }));
                      }}
                    />
                    {label}
                  </label>
                  <input
                    type="time"
                    className="brew-field__input brew-schedule-time"
                    value={slot.startTime}
                    disabled={!slot.enabled}
                    onChange={(e) =>
                      setSlots((prev) => ({
                        ...prev,
                        [dow]: {
                          ...(prev[dow] ?? emptySlot()),
                          startTime: e.target.value,
                        },
                      }))
                    }
                  />
                  <span>~</span>
                  <input
                    type="time"
                    className="brew-field__input brew-schedule-time"
                    value={slot.endTime}
                    disabled={!slot.enabled}
                    onChange={(e) =>
                      setSlots((prev) => ({
                        ...prev,
                        [dow]: {
                          ...(prev[dow] ?? emptySlot()),
                          endTime: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
          <p className="brew-card-lead">
            종료 시각이 시작보다 이르면 자정 넘김으로 저장됩니다. 요일을 비워 두면 나중에
            근무 탭에서 지정할 수 있습니다.
          </p>
          <div className="brew-btn-row">
            <BrewButton
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={onClose}
            >
              취소
            </BrewButton>
            <BrewButton type="submit" loading={loading}>
              저장 · 승인
            </BrewButton>
          </div>
        </form>
      ) : null}
    </BrewModal>
  );
}

