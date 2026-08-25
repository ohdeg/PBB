import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { FormEvent, ReactNode } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import type { VevenoTimerPreset, VevenoTimerPresetStep } from '../../types/veveno';
import { VevenoButton } from './VevenoButton';
import { VevenoInput } from './VevenoInput';
import { VevenoActionMenu } from './VevenoActionMenu';
import type { VevenoTimer } from './vevenoTimerStore';
import {
  acknowledgeVevenoTimer,
  addVevenoTimer,
  duplicateVevenoTimer,
  formatTimerMs,
  getVevenoTimerState,
  pauseVevenoTimer,
  removeVevenoTimer,
  resetVevenoTimer,
  startVevenoTimer,
  subscribeVevenoTimers,
  updateVevenoTimer,
} from './vevenoTimerStore';

function parseDurationToMs(minutes: string, seconds: string): number {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  const s = Math.max(0, Math.min(59, Math.floor(Number(seconds) || 0)));
  return (m * 60 + s) * 1000;
}

function msToDraftParts(ms: number): { minutes: string; seconds: string } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return {
    minutes: String(Math.floor(totalSec / 60)),
    seconds: String(totalSec % 60),
  };
}

interface DraftStep {
  id: string;
  name: string;
  minutes: string;
  seconds: string;
}

type SaveTarget = 'personal' | 'store';

interface VevenoTimersProps {
  storeId: string;
}

interface VevenoIconButtonProps {
  label: string;
  onClick: () => void;
  primary?: boolean;
  children: ReactNode;
}

function VevenoIconButton({ label, onClick, primary, children }: VevenoIconButtonProps) {
  return (
    <button
      type="button"
      className={`veveno-icon-btn${primary ? ' veveno-icon-btn--primary' : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5 3.2v9.6a.6.6 0 0 0 .92.5l7.2-4.8a.6.6 0 0 0 0-1l-7.2-4.8a.6.6 0 0 0-.92.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3.6" y="3" width="3.2" height="10" rx="1" />
      <rect x="9.2" y="3" width="3.2" height="10" rx="1" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.4" />
    </svg>
  );
}

function newDraftStep(name = '', minutes = '15', seconds = '0'): DraftStep {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    minutes,
    seconds,
  };
}

function stepsToDraft(steps: VevenoTimerPresetStep[]): DraftStep[] {
  return steps.map((step, index) => {
    const parts = msToDraftParts(step.durationMs);
    return {
      id: `preset-step-${index}-${Date.now()}`,
      name: step.name,
      minutes: parts.minutes,
      seconds: parts.seconds,
    };
  });
}

function timerToDraftSteps(timer: VevenoTimer): DraftStep[] {
  return timer.steps.map((step) => {
    const parts = msToDraftParts(step.durationMs);
    return {
      id: `${step.id}-draft`,
      name: step.name,
      minutes: parts.minutes,
      seconds: parts.seconds,
    };
  });
}

function collectStepsFromDraft(draftSteps: DraftStep[]): VevenoTimerPresetStep[] {
  return draftSteps
    .map((step) => ({
      name: step.name,
      durationMs: parseDurationToMs(step.minutes, step.seconds),
    }))
    .filter((step) => step.durationMs >= 1000);
}

export function VevenoTimers({ storeId }: VevenoTimersProps) {
  const t = useTranslation();
  const snapshot = useSyncExternalStore(
    subscribeVevenoTimers,
    getVevenoTimerState,
    getVevenoTimerState,
  );

  const [timerName, setTimerName] = useState('');
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([
    newDraftStep('', '15', '0'),
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('personal');
  const [personalPresets, setPersonalPresets] = useState<VevenoTimerPreset[]>([]);
  const [storePresets, setStorePresets] = useState<VevenoTimerPreset[]>([]);
  const [presetError, setPresetError] = useState('');
  const [presetBusy, setPresetBusy] = useState(false);
  const [editingPreset, setEditingPreset] = useState<{
    id: string;
    scope: SaveTarget;
  } | null>(null);

  const loadPresets = useCallback(async () => {
    try {
      const [personal, store] = await Promise.all([
        vevenoApi.listPersonalTimerPresets(),
        vevenoApi.listStoreTimerPresets(storeId),
      ]);
      setPersonalPresets(personal.data);
      setStorePresets(store.data);
      setPresetError('');
    } catch (err: unknown) {
      setPresetError(getVevenoErrorMessage(err, t('errors.failLoadPresets'), t));
    }
  }, [storeId, t]);

  useEffect(() => {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditingPreset(null);
  };

  const beginEdit = (timer: VevenoTimer) => {
    setEditingId(timer.id);
    setEditingPreset(null);
    setTimerName(timer.name);
    const drafts = timerToDraftSteps(timer);
    setDraftSteps(
      drafts.length > 0 ? drafts : [newDraftStep('', '15', '0')],
    );
  };

  const loadPresetIntoForm = (preset: VevenoTimerPreset) => {
    setEditingId(null);
    setEditingPreset({
      id: preset.id,
      scope: preset.scope === 'STORE' ? 'store' : 'personal',
    });
    setSaveTarget(preset.scope === 'STORE' ? 'store' : 'personal');
    setTimerName(preset.name);
    const drafts = stepsToDraft(preset.steps);
    setDraftSteps(
      drafts.length > 0 ? drafts : [newDraftStep('', '15', '0')],
    );
  };

  const applyPresetAsTimer = (preset: VevenoTimerPreset) => {
    addVevenoTimer(preset.name, preset.steps);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const steps = collectStepsFromDraft(draftSteps);
    if (steps.length === 0) return;

    if (editingId) {
      updateVevenoTimer(editingId, timerName, steps);
      setEditingId(null);
      return;
    }

    addVevenoTimer(timerName, steps);
    setTimerName('');
    setDraftSteps([newDraftStep('', '15', '0')]);
    setEditingPreset(null);
  };

  const handleSavePreset = async () => {
    const steps = collectStepsFromDraft(draftSteps);
    if (steps.length === 0) return;
    const payload = {
      name: timerName.trim() || t('timers.defaultName'),
      steps,
    };
    setPresetBusy(true);
    try {
      if (editingPreset) {
        if (editingPreset.scope === 'personal') {
          await vevenoApi.updatePersonalTimerPreset(editingPreset.id, payload);
        } else {
          await vevenoApi.updateStoreTimerPreset(
            storeId,
            editingPreset.id,
            payload,
          );
        }
      } else if (saveTarget === 'personal') {
        await vevenoApi.createPersonalTimerPreset(payload);
      } else {
        await vevenoApi.createStoreTimerPreset(storeId, payload);
      }
      setEditingPreset(null);
      await loadPresets();
    } catch (err: unknown) {
      setPresetError(getVevenoErrorMessage(err, t('errors.failSavePreset'), t));
    } finally {
      setPresetBusy(false);
    }
  };

  const handleSaveTimerAsPreset = async (
    timer: VevenoTimer,
    target: SaveTarget,
  ) => {
    setPresetBusy(true);
    try {
      const payload = {
        name: timer.name,
        steps: timer.steps.map((step) => ({
          name: step.name,
          durationMs: step.durationMs,
        })),
      };
      if (target === 'personal') {
        await vevenoApi.createPersonalTimerPreset(payload);
      } else {
        await vevenoApi.createStoreTimerPreset(storeId, payload);
      }
      await loadPresets();
    } catch (err: unknown) {
      setPresetError(getVevenoErrorMessage(err, t('errors.failSavePreset'), t));
    } finally {
      setPresetBusy(false);
    }
  };

  const handleDeletePreset = async (preset: VevenoTimerPreset) => {
    setPresetBusy(true);
    try {
      if (preset.scope === 'PERSONAL') {
        await vevenoApi.deletePersonalTimerPreset(preset.id);
      } else {
        await vevenoApi.deleteStoreTimerPreset(storeId, preset.id);
      }
      if (editingPreset?.id === preset.id) {
        setEditingPreset(null);
      }
      await loadPresets();
    } catch (err: unknown) {
      setPresetError(getVevenoErrorMessage(err, t('errors.failDeletePreset'), t));
    } finally {
      setPresetBusy(false);
    }
  };

  const renderPresetList = (
    title: string,
    presets: VevenoTimerPreset[],
    emptyText: string,
  ) => (
    <div className="veveno-preset-block">
      <h4 className="veveno-preset-block__title">{title}</h4>
      {presets.length === 0 ? (
        <p className="veveno-empty">{emptyText}</p>
      ) : (
        <ul className="veveno-preset-list">
          {presets.map((preset) => (
            <li key={preset.id} className="veveno-preset-card">
              <div>
                <p className="veveno-preset-card__name">{preset.name}</p>
                <p className="veveno-preset-card__meta">
                  {t('timers.stepCount', { count: preset.steps.length })} ·{' '}
                  {preset.steps.map((s) => formatTimerMs(s.durationMs)).join(' → ')}
                </p>
              </div>
              <div className="veveno-preset-card__actions">
                <VevenoButton
                  size="sm"
                  onClick={() => applyPresetAsTimer(preset)}
                >
                  {t('timers.addTimer')}
                </VevenoButton>
                <VevenoActionMenu
                  actions={[
                    {
                      label: t('timers.loadForm'),
                      onSelect: () => loadPresetIntoForm(preset),
                    },
                    {
                      label: t('common.delete'),
                      danger: true,
                      disabled: presetBusy,
                      onSelect: () => {
                        void handleDeletePreset(preset);
                      },
                    },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="veveno-timers">
      <section className="veveno-tools-block">
        <h3 className="veveno-tools-block__title">
          {editingId
            ? t('timers.editTimer')
            : editingPreset
              ? t('timers.editPreset')
              : t('timers.title')}
        </h3>
        <p className="veveno-tools-block__lead">
          {t('timers.lead')}
        </p>
        {presetError ? (
          <p className="veveno-notice veveno-notice--error" role="alert">
            {presetError}
          </p>
        ) : null}
        <form className="veveno-timer-form" onSubmit={handleSubmit}>
          <VevenoInput
            id="veveno-timer-name"
            label={t('common.name')}
            value={timerName}
            onChange={(e) => setTimerName(e.target.value)}
            placeholder={t('timers.namePh')}
          />
          <div className="veveno-chain-drafts">
            {draftSteps.map((step, index) => (
              <div key={step.id} className="veveno-chain-draft">
                <VevenoInput
                  id={`timer-step-name-${step.id}`}
                  label={
                    draftSteps.length === 1
                      ? t('timers.stepName')
                      : t('timers.stepNameN', { n: index + 1 })
                  }
                  value={step.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDraftSteps((prev) =>
                      prev.map((s) =>
                        s.id === step.id ? { ...s, name: value } : s,
                      ),
                    );
                  }}
                  placeholder={draftSteps.length === 1 ? t('timers.stepNamePh') : undefined}
                />
                <div className="veveno-timer-duration">
                  <VevenoInput
                    id={`timer-step-min-${step.id}`}
                    label={t('timers.minutes')}
                    inputMode="numeric"
                    value={step.minutes}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraftSteps((prev) =>
                        prev.map((s) =>
                          s.id === step.id ? { ...s, minutes: value } : s,
                        ),
                      );
                    }}
                  />
                  <VevenoInput
                    id={`timer-step-sec-${step.id}`}
                    label={t('timers.seconds')}
                    inputMode="numeric"
                    value={step.seconds}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraftSteps((prev) =>
                        prev.map((s) =>
                          s.id === step.id ? { ...s, seconds: value } : s,
                        ),
                      );
                    }}
                  />
                </div>
                {draftSteps.length > 1 ? (
                  <VevenoButton
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraftSteps((prev) =>
                        prev.filter((s) => s.id !== step.id),
                      )
                    }
                  >
                    {t('timers.deleteStep')}
                  </VevenoButton>
                ) : null}
              </div>
            ))}
          </div>
          <div className="veveno-timer-form__row">
            <VevenoButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setDraftSteps((prev) => [
                  ...prev,
                  newDraftStep(t('timers.stepN', { n: prev.length + 1 }), '5', '0'),
                ])
              }
            >
              {t('timers.addStep')}
            </VevenoButton>
            <div className="veveno-timer-form__row-end">
              {editingId || editingPreset ? (
                <VevenoButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelEdit}
                >
                  {t('common.cancel')}
                </VevenoButton>
              ) : null}
              {!editingPreset ? (
                <select
                  className="veveno-select-inline"
                  aria-label={t('timers.saveLocation')}
                  value={saveTarget}
                  onChange={(e) =>
                    setSaveTarget(
                      e.target.value === 'store' ? 'store' : 'personal',
                    )
                  }
                >
                  <option value="personal">{t('timers.personal')}</option>
                  <option value="store">{t('timers.store')}</option>
                </select>
              ) : null}
              <VevenoButton
                type="button"
                variant="secondary"
                loading={presetBusy}
                onClick={() => {
                  void handleSavePreset();
                }}
              >
                {editingPreset ? t('timers.savePreset') : t('timers.saveAsPreset')}
              </VevenoButton>
              {!editingPreset ? (
                <VevenoButton type="submit">
                  {editingId ? t('timers.saveTimer') : t('timers.addTimer')}
                </VevenoButton>
              ) : null}
            </div>
          </div>
        </form>

        {snapshot.timers.length === 0 ? (
          <p className="veveno-empty">{t('timers.empty')}</p>
        ) : (
          <ul className="veveno-timer-list">
            {snapshot.timers.map((timer) => {
              const current = timer.steps[timer.currentStepIndex];
              const isMultiStep = timer.steps.length > 1;
              const isEditing = editingId === timer.id;
              const visibleStart = Math.min(
                Math.max(timer.currentStepIndex, 0),
                Math.max(0, timer.steps.length - 3),
              );
              const visibleSteps = timer.steps.slice(
                visibleStart,
                visibleStart + 3,
              );
              const hiddenBefore = visibleStart;
              const hiddenAfter =
                timer.steps.length - (visibleStart + visibleSteps.length);
              return (
                <li
                  key={timer.id}
                  className={`veveno-timer-card${timer.status === 'done' ? ' is-done' : ''}${timer.status === 'running' ? ' is-running' : ''}${isEditing ? ' is-editing' : ''}`}
                >
                  <div className="veveno-timer-card__head">
                    <p className="veveno-timer-card__name">{timer.name}</p>
                    <VevenoActionMenu
                      actions={[
                        {
                          label: t('common.edit'),
                          onSelect: () => beginEdit(timer),
                        },
                        {
                          label: t('timers.duplicate'),
                          onSelect: () => duplicateVevenoTimer(timer.id),
                        },
                        {
                          label: t('timers.savePersonal'),
                          disabled: presetBusy,
                          onSelect: () => {
                            void handleSaveTimerAsPreset(timer, 'personal');
                          },
                        },
                        {
                          label: t('timers.saveStore'),
                          disabled: presetBusy,
                          onSelect: () => {
                            void handleSaveTimerAsPreset(timer, 'store');
                          },
                        },
                        {
                          label: t('common.delete'),
                          danger: true,
                          onSelect: () => {
                            if (editingId === timer.id) {
                              cancelEdit();
                            }
                            removeVevenoTimer(timer.id);
                          },
                        },
                      ]}
                    />
                  </div>
                  <p className="veveno-timer-card__time">
                    {formatTimerMs(timer.remainingMs)}
                  </p>
                  <p className="veveno-timer-card__meta">
                    {timer.status === 'done'
                      ? t('timers.done')
                      : isMultiStep
                        ? t('timers.stepProgress', {
                            current: timer.currentStepIndex + 1,
                            total: timer.steps.length,
                            name: current?.name ?? t('timers.stepFallback'),
                          })
                        : current?.name
                          ? current.name
                          : t('timers.setDuration', {
                              duration: formatTimerMs(current?.durationMs ?? 0),
                            })}
                    {timer.status === 'paused' ? t('timers.paused') : ''}
                    {timer.status === 'running' ? t('timers.running') : ''}
                    {isEditing ? t('timers.editing') : ''}
                  </p>
                  {isMultiStep ? (
                    <ol className="veveno-chain-steps">
                      {hiddenBefore > 0 ? (
                        <li className="is-more">
                          {t('timers.hiddenBefore', { count: hiddenBefore })}
                        </li>
                      ) : null}
                      {visibleSteps.map((step, offset) => {
                        const index = visibleStart + offset;
                        return (
                          <li
                            key={step.id}
                            className={
                              index === timer.currentStepIndex &&
                              timer.status !== 'done'
                                ? 'is-current'
                                : index < timer.currentStepIndex ||
                                    timer.status === 'done'
                                  ? 'is-past'
                                  : ''
                            }
                          >
                            <span>{step.name}</span>
                            <span>{formatTimerMs(step.durationMs)}</span>
                          </li>
                        );
                      })}
                      {hiddenAfter > 0 ? (
                        <li className="is-more">
                          {t('timers.hiddenAfter', { count: hiddenAfter })}
                        </li>
                      ) : null}
                    </ol>
                  ) : null}
                  <div className="veveno-timer-card__actions">
                    {timer.status === 'done' && !timer.acknowledged ? (
                      <VevenoButton
                        size="sm"
                        onClick={() => acknowledgeVevenoTimer(timer.id)}
                      >
                        {t('timers.done')}
                      </VevenoButton>
                    ) : timer.status === 'running' ? (
                      <VevenoIconButton
                        label={t('timers.pause')}
                        primary
                        onClick={() => pauseVevenoTimer(timer.id)}
                      >
                        <PauseIcon />
                      </VevenoIconButton>
                    ) : (
                      <VevenoIconButton
                        label={
                          timer.status === 'done' ? t('timers.restart') : t('timers.start')
                        }
                        primary
                        onClick={() => startVevenoTimer(timer.id)}
                      >
                        <PlayIcon />
                      </VevenoIconButton>
                    )}
                    <VevenoIconButton
                      label={t('timers.stop')}
                      onClick={() => resetVevenoTimer(timer.id)}
                    >
                      <StopIcon />
                    </VevenoIconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="veveno-tools-block">
        <h3 className="veveno-tools-block__title">{t('timers.presets')}</h3>
        {renderPresetList(
          t('timers.myPresets'),
          personalPresets,
          t('timers.myPresetsEmpty'),
        )}
        {renderPresetList(
          t('timers.storePresets'),
          storePresets,
          t('timers.storePresetsEmpty'),
        )}
      </section>
    </div>
  );
}
