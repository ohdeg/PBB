import { Button } from '../../../components/ui/Button';
import { useTranslation } from '../i18n/LanguageContext';
import {
  TIME_SIGNATURE_PRESETS,
  formatTimeSignature,
  type TimeSignature,
} from '../utils/measureTiming';
import type { BeatStrengthLevel } from '../utils/beatStrength';
import type { BeatSubdivisionId } from '../utils/beatSubdivision';
import { formatTransposeLabel } from '../utils/transpose';
import BeatStrengthBarGrid from './BeatStrengthBarGrid';
import TempoChangesEditor from './TempoChangesEditor';
import { MAX_MEASURES_PER_LINE, MIN_MEASURES_PER_LINE } from '../constants/scoreLayout';
import type { TempoChange } from '../types/tempoChange';

type PlaybackControlsMode = 'score' | 'metronome';

interface PlaybackControlsProps {
  mode?: PlaybackControlsMode;
  bpm: number;
  timeSignature: TimeSignature;
  isPlaying: boolean;
  isCountingIn: boolean;
  isAutoScroll: boolean;
  isMetronomeEnabled: boolean;
  isMeasureHighlightEnabled: boolean;
  elapsedMs: number;
  currentMeasureIndex: number;
  totalMeasures: number;
  isSavingPrefs: boolean;
  savePrefsEnabled?: boolean;
  onBpmChange: (bpm: number) => void;
  onTimeSignatureChange: (signature: TimeSignature) => void;
  onBeatsPerMeasureChange: (beats: number) => void;
  onBeatTypeChange: (beatType: number) => void;
  onTogglePlay: () => void;
  onAutoScrollChange: (enabled: boolean) => void;
  onMetronomeChange: (enabled: boolean) => void;
  onMeasureHighlightChange: (enabled: boolean) => void;
  measuresPerLine?: number;
  onMeasuresPerLineChange?: (measuresPerLine: number) => void;
  startMeasure: number;
  endMeasure: number;
  isRepeatMode: boolean;
  onStartMeasureChange: (measure: number) => void;
  onEndMeasureChange: (measure: number) => void;
  onRepeatModeChange: (enabled: boolean) => void;
  onSeekToStartMeasure: () => void;
  onResetPracticeRange: () => void;
  onSavePrefs: () => void;
  onApplySettings?: () => void;
  tempoChanges?: TempoChange[];
  onTempoChangesChange?: (changes: TempoChange[]) => void;
  transposeSemitones: number;
  onTransposeDown: () => void;
  onTransposeUp: () => void;
  onTransposeReset: () => void;
  beatStrengths: BeatStrengthLevel[];
  beatSubdivisions: BeatSubdivisionId[];
  onBeatStrengthChange: (beatIndex: number, strength: BeatStrengthLevel) => void;
  onBeatSubdivisionChange: (beatIndex: number, subdivisionId: BeatSubdivisionId) => void;
  beatHighlightElapsedMs?: number;
  isBeatHighlightActive?: boolean;
  activeBeatIndexOverride?: number | null;
}

export default function PlaybackControls({
  mode = 'score',
  bpm,
  timeSignature,
  isPlaying,
  isCountingIn,
  isAutoScroll,
  isMetronomeEnabled,
  isMeasureHighlightEnabled,
  elapsedMs,
  currentMeasureIndex,
  totalMeasures,
  isSavingPrefs,
  savePrefsEnabled = true,
  onBpmChange,
  onTimeSignatureChange,
  onBeatsPerMeasureChange,
  onBeatTypeChange,
  onTogglePlay,
  onAutoScrollChange,
  onMetronomeChange,
  onMeasureHighlightChange,
  measuresPerLine = 4,
  onMeasuresPerLineChange,
  startMeasure,
  endMeasure,
  isRepeatMode,
  onStartMeasureChange,
  onEndMeasureChange,
  onRepeatModeChange,
  onSeekToStartMeasure,
  onResetPracticeRange,
  onSavePrefs,
  onApplySettings,
  tempoChanges = [],
  onTempoChangesChange,
  transposeSemitones,
  onTransposeDown,
  onTransposeUp,
  onTransposeReset,
  beatStrengths,
  beatSubdivisions,
  onBeatStrengthChange,
  onBeatSubdivisionChange,
  beatHighlightElapsedMs,
  isBeatHighlightActive,
  activeBeatIndexOverride,
}: PlaybackControlsProps) {
  const t = useTranslation();
  const isMetronomeMode = mode === 'metronome';
  const beatCount = Math.max(timeSignature.beatsPerMeasure, 1);
  const highlightActive = isBeatHighlightActive ?? (isPlaying || isCountingIn);
  const highlightElapsedMs = beatHighlightElapsedMs ?? elapsedMs;
  const playButtonLabel = isCountingIn
    ? t('playback.stopCountIn')
    : isPlaying
      ? t('playback.pause')
      : t('playback.play');

  return (
    <div className="playback-controls">
      <Button onClick={onTogglePlay}>{playButtonLabel}</Button>

      <div className="playback-field">
        <label>BPM</label>
        <input
          type="number"
          min={20}
          max={300}
          value={bpm}
          onChange={(event) => onBpmChange(Number(event.target.value))}
        />
      </div>

      {!isMetronomeMode && (
        <div className="playback-row playback-transpose">
          <span className="playback-inline-label">{t('playback.transpose')}</span>
          <Button variant="secondary" onClick={onTransposeDown} aria-label={t('playback.keyDownAria')}>
            {t('playback.keyDown')}
          </Button>
          <span className="playback-transpose-value">{formatTransposeLabel(transposeSemitones)}</span>
          <Button variant="secondary" onClick={onTransposeUp} aria-label={t('playback.keyUpAria')}>
            {t('playback.keyUp')}
          </Button>
          {transposeSemitones !== 0 && (
            <Button variant="outline" onClick={onTransposeReset}>
              {t('playback.resetKey')}
            </Button>
          )}
        </div>
      )}

      <div className="playback-field playback-field-wide">
        <label>{t('playback.timeSignature')}</label>
        <input
          type="number"
          min={1}
          max={16}
          value={timeSignature.beatsPerMeasure}
          onChange={(event) => onBeatsPerMeasureChange(Number(event.target.value))}
          aria-label={t('playback.beatsPerMeasureAria')}
        />
        <span className="playback-slash">/</span>
        <input
          type="number"
          min={1}
          max={16}
          value={timeSignature.beatType}
          onChange={(event) => onBeatTypeChange(Number(event.target.value))}
          aria-label={t('playback.beatUnitAria')}
        />
        <span className="playback-meta">({formatTimeSignature(timeSignature)})</span>
      </div>

      {!isMetronomeMode && onMeasuresPerLineChange && (
        <div className="playback-field">
          <label>{t('playback.measuresPerLine')}</label>
          <input
            type="number"
            min={MIN_MEASURES_PER_LINE}
            max={MAX_MEASURES_PER_LINE}
            value={measuresPerLine}
            onChange={(event) => onMeasuresPerLineChange(Number(event.target.value))}
            aria-label={t('playback.measuresPerLineAria')}
          />
        </div>
      )}

      <div className="playback-presets">
        <span className="playback-presets-label">{t('playback.presetLabel')}</span>
        {TIME_SIGNATURE_PRESETS.map((preset) => {
          const label = formatTimeSignature(preset);
          const isActive =
            preset.beatsPerMeasure === timeSignature.beatsPerMeasure &&
            preset.beatType === timeSignature.beatType;

          return (
            <button
              key={label}
              type="button"
              className={`playback-preset ${isActive ? 'active' : ''}`}
              onClick={() => onTimeSignatureChange(preset)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="playback-meta">
        {t('playback.elapsedTime', { seconds: (elapsedMs / 1000).toFixed(2) })}
        {!isMetronomeMode &&
          t('playback.currentMeasure', {
            current: currentMeasureIndex + 1,
            total: Math.max(totalMeasures, 1),
          })}
      </p>

      {!isMetronomeMode && (
        <div className="playback-practice-range">
          <p className="playback-practice-range-hint">{t('playback.practiceRangeHint')}</p>
          <div className="playback-row playback-practice-range-inputs">
            <label className="playback-inline-label" htmlFor="playback-start-measure">
              {t('playback.startMeasure')}
            </label>
            <input
              id="playback-start-measure"
              type="number"
              min={1}
              max={Math.max(totalMeasures, 1)}
              value={startMeasure}
              onChange={(event) => onStartMeasureChange(Number(event.target.value))}
              className="playback-measure-input"
            />
            <label className="playback-inline-label" htmlFor="playback-end-measure">
              {t('playback.endMeasure')}
            </label>
            <input
              id="playback-end-measure"
              type="number"
              min={1}
              max={Math.max(totalMeasures, 1)}
              value={endMeasure}
              onChange={(event) => onEndMeasureChange(Number(event.target.value))}
              className="playback-measure-input"
            />
          </div>
          <div className="playback-row">
            <label className="playback-checkbox">
              <input
                type="checkbox"
                checked={isRepeatMode}
                onChange={(event) => onRepeatModeChange(event.target.checked)}
              />
              {t('playback.repeatMode')}
            </label>
          </div>
          <div className="playback-row">
            <Button variant="secondary" onClick={onSeekToStartMeasure}>
              {t('playback.seekToStart')}
            </Button>
            <Button variant="outline" onClick={onResetPracticeRange}>
              {t('playback.resetRange')}
            </Button>
          </div>
        </div>
      )}

      {!isMetronomeMode && onTempoChangesChange && (
        <TempoChangesEditor
          tempoChanges={tempoChanges}
          totalMeasures={totalMeasures}
          defaultBpm={bpm}
          defaultTimeSignature={timeSignature}
          onChange={onTempoChangesChange}
        />
      )}

      <div className="playback-strength-section">
        <span className="playback-presets-label">{t('playback.beatStrengthLabel')}</span>
        <p className="playback-strength-hint">{t('playback.beatStrengthHint')}</p>
        <BeatStrengthBarGrid
          beatCount={beatCount}
          beatStrengths={beatStrengths}
          beatSubdivisions={beatSubdivisions}
          onBeatStrengthChange={onBeatStrengthChange}
          onBeatSubdivisionChange={onBeatSubdivisionChange}
          isHighlightActive={highlightActive}
          highlightElapsedMs={highlightElapsedMs}
          bpm={bpm}
          activeBeatIndexOverride={activeBeatIndexOverride}
        />
      </div>

      <div className="playback-toggles">
        {!isMetronomeMode && (
          <label className="playback-checkbox">
            <input type="checkbox" checked={isAutoScroll} onChange={(e) => onAutoScrollChange(e.target.checked)} />
            {t('playback.autoScroll')}
          </label>
        )}
        <label className="playback-checkbox">
          <input
            type="checkbox"
            checked={isMetronomeEnabled}
            onChange={(e) => onMetronomeChange(e.target.checked)}
          />
          {t('playback.metronomeSound')}
        </label>
        {!isMetronomeMode && (
          <label className="playback-checkbox">
            <input
              type="checkbox"
              checked={isMeasureHighlightEnabled}
              onChange={(e) => onMeasureHighlightChange(e.target.checked)}
            />
            {t('playback.measureHighlight')}
          </label>
        )}
      </div>

      {savePrefsEnabled && (
        <div className="playback-settings-actions">
          <Button
            type="button"
            onClick={onSavePrefs}
            disabled={isSavingPrefs}
            variant="secondary"
            className="playback-settings-action-btn"
          >
            {isSavingPrefs ? t('playback.savingPrefs') : t('playback.saveBpmPrefs')}
          </Button>
          {onApplySettings && (
            <Button
              type="button"
              onClick={onApplySettings}
              className="playback-settings-action-btn"
            >
              {t('playback.applySettings')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
