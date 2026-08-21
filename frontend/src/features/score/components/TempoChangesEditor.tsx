import { Button } from '../../../components/ui/Button';
import { useTranslation } from '../i18n/LanguageContext';
import {
  TIME_SIGNATURE_PRESETS,
  formatTimeSignature,
  type TimeSignature,
} from '../utils/measureTiming';
import { createTempoChange, type TempoChange } from '../types/tempoChange';
import ScoreNumberInput from './ScoreNumberInput';

interface TempoChangesEditorProps {
  tempoChanges: TempoChange[];
  totalMeasures: number;
  defaultBpm: number;
  defaultTimeSignature: TimeSignature;
  onChange: (changes: TempoChange[]) => void;
}

export default function TempoChangesEditor({
  tempoChanges,
  totalMeasures,
  defaultBpm,
  defaultTimeSignature,
  onChange,
}: TempoChangesEditorProps) {
  const t = useTranslation();
  const maxMeasure = Math.max(totalMeasures, 1);

  const handleAdd = () => {
    const nextStart =
      tempoChanges.length > 0
        ? Math.min(
            maxMeasure,
            Math.max(...tempoChanges.map((change) => change.endMeasure)) + 1,
          )
        : 1;
    const nextEnd = Math.min(maxMeasure, nextStart);
    onChange([
      ...tempoChanges,
      createTempoChange(nextStart, nextEnd, defaultBpm, defaultTimeSignature),
    ]);
  };

  const handleUpdate = (
    id: string,
    patch: Partial<
      Pick<
        TempoChange,
        'startMeasure' | 'endMeasure' | 'bpm' | 'beatsPerMeasure' | 'beatType'
      >
    >,
  ) => {
    onChange(
      tempoChanges.map((change) => (change.id === id ? { ...change, ...patch } : change)),
    );
  };

  const handleRemove = (id: string) => {
    onChange(tempoChanges.filter((change) => change.id !== id));
  };

  return (
    <div className="playback-tempo-changes">
      <div className="playback-tempo-changes-header">
        <span className="playback-presets-label">{t('playback.tempoChangesTitle')}</span>
        <Button type="button" variant="secondary" onClick={handleAdd}>
          {t('playback.addTempoChange')}
        </Button>
      </div>
      <p className="playback-tempo-changes-hint">{t('playback.tempoChangesHint')}</p>
      {tempoChanges.length === 0 ? (
        <p className="playback-tempo-changes-empty">{t('playback.tempoChangesEmpty')}</p>
      ) : (
        <ul className="playback-tempo-changes-list">
          {tempoChanges.map((change) => {
            const timeSignature = {
              beatsPerMeasure: change.beatsPerMeasure,
              beatType: change.beatType,
            };

            return (
              <li key={change.id} className="playback-tempo-change-row">
                <label className="playback-tempo-change-field">
                  <span>{t('playback.tempoStartMeasure')}</span>
                  <ScoreNumberInput
                    min={1}
                    max={maxMeasure}
                    value={change.startMeasure}
                    onChange={(startMeasure) => handleUpdate(change.id, { startMeasure })}
                  />
                </label>
                <label className="playback-tempo-change-field">
                  <span>{t('playback.tempoEndMeasure')}</span>
                  <ScoreNumberInput
                    min={1}
                    max={maxMeasure}
                    value={change.endMeasure}
                    onChange={(endMeasure) => handleUpdate(change.id, { endMeasure })}
                  />
                </label>
                <label className="playback-tempo-change-field">
                  <span>BPM</span>
                  <ScoreNumberInput
                    min={20}
                    max={300}
                    value={change.bpm}
                    onChange={(bpm) => handleUpdate(change.id, { bpm })}
                  />
                </label>
                <div className="playback-tempo-change-signature">
                  <span className="playback-tempo-change-signature-label">{t('playback.timeSignature')}</span>
                  <div className="playback-tempo-change-signature-inputs">
                    <ScoreNumberInput
                      min={1}
                      max={16}
                      value={change.beatsPerMeasure}
                      onChange={(beatsPerMeasure) => handleUpdate(change.id, { beatsPerMeasure })}
                      aria-label={t('playback.beatsPerMeasureAria')}
                    />
                    <span className="playback-slash">/</span>
                    <ScoreNumberInput
                      min={1}
                      max={16}
                      value={change.beatType}
                      onChange={(beatType) => handleUpdate(change.id, { beatType })}
                      aria-label={t('playback.beatUnitAria')}
                    />
                    <span className="playback-meta">({formatTimeSignature(timeSignature)})</span>
                  </div>
                  <div className="playback-tempo-change-presets">
                    {TIME_SIGNATURE_PRESETS.map((preset) => {
                      const label = formatTimeSignature(preset);
                      const isActive =
                        preset.beatsPerMeasure === change.beatsPerMeasure &&
                        preset.beatType === change.beatType;

                      return (
                        <button
                          key={label}
                          type="button"
                          className={`playback-preset-btn${isActive ? ' is-active' : ''}`}
                          onClick={() =>
                            handleUpdate(change.id, {
                              beatsPerMeasure: preset.beatsPerMeasure,
                              beatType: preset.beatType,
                            })
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={() => handleRemove(change.id)}>
                  {t('common.delete')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
