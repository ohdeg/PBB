import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { vevenoWeekdayLabels } from '../../features/veveno/i18n/translate';
import type { VevenoJoinRequest, VevenoScheduleSlotInput } from '../../types/veveno';
import { VevenoButton } from './VevenoButton';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';
import { VevenoTimeInput } from './VevenoTimeInput';

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

export interface VevenoJoinApprovePayload {
  canEditStock: boolean;
  workStartDate: string | null;
  slots: VevenoScheduleSlotInput[];
}

interface VevenoJoinApproveModalProps {
  open: boolean;
  request: VevenoJoinRequest | null;
  loading: boolean;
  onClose: () => void;
  onSave: (payload: VevenoJoinApprovePayload) => void;
}

export function VevenoJoinApproveModal({
  open,
  request,
  loading,
  onClose,
  onSave,
}: VevenoJoinApproveModalProps) {
  const t = useTranslation();
  const dayLabels = vevenoWeekdayLabels(t);
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
      setBulkHint(t('joinApprove.pickDaysFirst'));
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
    const payloadSlots: VevenoScheduleSlotInput[] = [];
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
    <VevenoModal
      open={open}
      title={t('joinApprove.title')}
      onClose={() => {
        if (!loading) {
          onClose();
        }
      }}
    >
      {request ? (
        <form className="veveno-form-stack" onSubmit={handleSubmit}>
          <p className="veveno-card-lead">
            {t('joinApprove.lead', { nickname: request.nickname, email: request.email })}
          </p>
          <VevenoInput
            label={t('joinApprove.workStart')}
            id="join-work-start"
            type="date"
            required
            value={workStartDate}
            onChange={(e) => setWorkStartDate(e.target.value)}
            hint={t('joinApprove.workStartHint')}
          />
          <label className="veveno-check">
            <input
              type="checkbox"
              checked={canEditStock}
              onChange={(e) => setCanEditStock(e.target.checked)}
            />
            {t('joinApprove.stockEdit')}
          </label>
          <div className="veveno-stack">
            <p className="veveno-field__label">{t('joinApprove.regularOptional')}</p>
            <div className="veveno-schedule-bulk">
              <p className="veveno-field__label">{t('joinApprove.bulkTime')}</p>
              <div className="veveno-schedule-slot-row veveno-schedule-bulk__row">
                <VevenoTimeInput
                  value={bulkStartTime}
                  onChange={setBulkStartTime}
                  aria-label={t('joinApprove.bulkStart')}
                />
                <span>~</span>
                <VevenoTimeInput
                  value={bulkEndTime}
                  onChange={setBulkEndTime}
                  aria-label={t('joinApprove.bulkEnd')}
                />
                <VevenoButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={applyBulkTimesToSelectedDays}
                >
                  {t('joinApprove.applySelectedDays')}
                </VevenoButton>
              </div>
              <p className="veveno-field__hint">
                {t('joinApprove.bulkHint')}
              </p>
              {bulkHint ? (
                <p className="veveno-field__error" role="alert">
                  {bulkHint}
                </p>
              ) : null}
            </div>
            {dayLabels.map((label, i) => {
              const dow = i + 1;
              const slot = slots[dow] ?? emptySlot();
              return (
                <div key={dow} className="veveno-schedule-slot-row">
                  <label className="veveno-check">
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
                  <VevenoTimeInput
                    value={slot.startTime}
                    disabled={!slot.enabled}
                    aria-label={t('joinApprove.dayStart', { day: label })}
                    onChange={(startTime) =>
                      setSlots((prev) => ({
                        ...prev,
                        [dow]: {
                          ...(prev[dow] ?? emptySlot()),
                          startTime,
                        },
                      }))
                    }
                  />
                  <span>~</span>
                  <VevenoTimeInput
                    value={slot.endTime}
                    disabled={!slot.enabled}
                    aria-label={t('joinApprove.dayEnd', { day: label })}
                    onChange={(endTime) =>
                      setSlots((prev) => ({
                        ...prev,
                        [dow]: {
                          ...(prev[dow] ?? emptySlot()),
                          endTime,
                        },
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
          <p className="veveno-card-lead">
            {t('joinApprove.overnightHint')}
          </p>
          <div className="veveno-btn-row">
            <VevenoButton
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={onClose}
            >
              {t('common.cancel')}
            </VevenoButton>
            <VevenoButton type="submit" loading={loading}>
              {t('joinApprove.saveApprove')}
            </VevenoButton>
          </div>
        </form>
      ) : null}
    </VevenoModal>
  );
}

