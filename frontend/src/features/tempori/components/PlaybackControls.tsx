import { useId } from 'react';
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
import TemporiNumberInput from './TemporiNumberInput';
import TempoChangesEditor from './TempoChangesEditor';
import { MAX_MEASURES_PER_LINE, MIN_MEASURES_PER_LINE } from '../constants/temporiLayout';
import type { TempoChange } from '../types/tempoChange';

type PlaybackControlsMode = 'tempori' | 'metronome';

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
  onApplyAndPlay?: () => void;
  onCancelSettings?: () => void;
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
  mode = 'tempori',
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
  onApplyAndPlay,
  onCancelSettings,
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
  const id = useId();
  const isMetronomeMode = mode === 'metronome';
  const beatCount = Math.max(timeSignature.beatsPerMeasure, 1);
  const highlightActive = isBeatHighlightActive ?? (isPlaying || isCountingIn);
  const highlightElapsedMs = beatHighlightElapsedMs ?? elapsedMs;
  const playButtonLabel = isCountingIn
    ? t('playback.stopCountIn')
    : isPlaying
      ? t('playback.pause')
      : t('playback.play');

  const advancedControls = (<>
      <div className="playback-field playback-field-wide">
        <label>{t('playback.timeSignature')}</label>
        <TemporiNumberInput
          min={1}
          max={16}
          value={timeSignature.beatsPerMeasure}
          onChange={onBeatsPerMeasureChange}
          aria-label={t('playback.beatsPerMeasureAria')}
        />
        <span className="playback-slash">/</span>
        <TemporiNumberInput
          min={1}
          max={16}
          value={timeSignature.beatType}
          onChange={onBeatTypeChange}
          aria-label={t('playback.beatUnitAria')}
        />
        <span className="playback-meta">({formatTimeSignature(timeSignature)})</span>
      </div>

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

  </>);

  return (
    <div className="playback-controls">
      {isMetronomeMode && <Button onClick={onTogglePlay}>{playButtonLabel}</Button>}

      <div className="playback-field">
        <label htmlFor={`${id}-bpm`}>BPM</label>
        <TemporiNumberInput
          id={`${id}-bpm`}
          name="bpm"
          inputMode="numeric"
          min={20}
          max={300}
          value={bpm}
          onChange={onBpmChange}
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

      {!isMetronomeMode && onMeasuresPerLineChange && (
        <div className="playback-field">
          <label>{t('playback.measuresPerLine')}</label>
          <TemporiNumberInput
            min={MIN_MEASURES_PER_LINE}
            max={MAX_MEASURES_PER_LINE}
            value={measuresPerLine}
            onChange={onMeasuresPerLineChange}
            aria-label={t('playback.measuresPerLineAria')}
          />
        </div>
      )}

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
            <label className="playback-inline-label" htmlFor={`${id}-start-measure`}>
              {t('playback.startMeasure')}
            </label>
            <TemporiNumberInput
              id={`${id}-start-measure`}
              min={1}
              max={Math.max(totalMeasures, 1)}
              value={startMeasure}
              onChange={onStartMeasureChange}
              className="playback-measure-input"
            />
            <label className="playback-inline-label" htmlFor={`${id}-end-measure`}>
              {t('playback.endMeasure')}
            </label>
            <TemporiNumberInput
              id={`${id}-end-measure`}
              min={1}
              max={Math.max(totalMeasures, 1)}
              value={endMeasure}
              onChange={onEndMeasureChange}
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

      {isMetronomeMode ? advancedControls : <details className="practice-advanced-settings"><summary>{t('playback.advancedSettings')}</summary>{advancedControls}</details>}

      {!isMetronomeMode && savePrefsEnabled && <p className="practice-settings-hint">{t('playback.saveDefaultsHint')}</p>}
      {savePrefsEnabled && (
        <div className="playback-settings-actions">
          <Button
            type="button"
            onClick={onSavePrefs}
            disabled={isSavingPrefs}
            variant="secondary"
            className="playback-settings-action-btn"
          >
            {isSavingPrefs ? t('playback.savingPrefs') : t(isMetronomeMode ? 'playback.saveBpmPrefs' : 'playback.saveDefaults')}
          </Button>
        </div>
      )}
      {(onApplySettings || onApplyAndPlay || onCancelSettings) && <div className="playback-settings-actions">
          {onCancelSettings && <Button variant="outline" onClick={onCancelSettings}>{t('common.cancel')}</Button>}
          {onApplyAndPlay && <Button onClick={onApplyAndPlay}>{t('playback.applyAndPlay')}</Button>}
          {onApplySettings && (
            <Button
              type="button"
              onClick={onApplySettings}
              className="playback-settings-action-btn"
            >
              {t('playback.applySettings')}
            </Button>
          )}
        </div>}
    </div>
  );
}
