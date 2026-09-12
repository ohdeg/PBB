import { useEffect, useRef, useState } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import { playCallBellChime } from '../../features/veveno/callbell/chime';
import {
  callBellSpoken,
  callBellSpeech,
  clampCallBellPitch,
  clampCallBellRate,
  clampCallBellVolume,
  DEFAULT_CALL_BELL_PITCH,
  DEFAULT_CALL_BELL_RATE,
  DEFAULT_CALL_BELL_VOLUME,
} from '../../features/veveno/callbell/speech';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useVevenoI18n } from '../../features/veveno/i18n/LanguageContext';
import { VEVENO_DATE_LOCALES } from '../../features/veveno/i18n/detect';
import type { VevenoStore } from '../../types/veveno';
import { VevenoButton } from './VevenoButton';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';

export type VevenoCallBellSaved = Pick<
  VevenoStore,
  | 'callBellPhrase'
  | 'callBellRate'
  | 'callBellPitch'
  | 'callBellChimeVolume'
  | 'callBellSpeechVolume'
>;

interface VevenoCallBellProps {
  storeId: string;
  phrase: string | null;
  rate: number | null;
  pitch: number | null;
  chimeVolume: number | null;
  speechVolume: number | null;
  onSaved: (next: VevenoCallBellSaved) => void;
}

function speak(
  text: string,
  lang: string,
  rate: number,
  pitch: number,
  volume: number,
): void {
  if (!window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  window.speechSynthesis.speak(utterance);
}

export function VevenoCallBell({
  storeId,
  phrase,
  rate,
  pitch,
  chimeVolume,
  speechVolume,
  onSaved,
}: VevenoCallBellProps) {
  const { t, locale } = useVevenoI18n();
  const slotRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState('');
  const [draft, setDraft] = useState(phrase?.trim() ?? '');
  const [rateValue, setRateValue] = useState(rate ?? DEFAULT_CALL_BELL_RATE);
  const [pitchValue, setPitchValue] = useState(pitch ?? DEFAULT_CALL_BELL_PITCH);
  const [chimeVolumeValue, setChimeVolumeValue] = useState(
    chimeVolume ?? DEFAULT_CALL_BELL_VOLUME,
  );
  const [speechVolumeValue, setSpeechVolumeValue] = useState(
    speechVolume ?? DEFAULT_CALL_BELL_VOLUME,
  );
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const sliderTimer = useRef(0);
  const savedPhraseRef = useRef(phrase);
  const slidersRef = useRef({
    rate: rate ?? DEFAULT_CALL_BELL_RATE,
    pitch: pitch ?? DEFAULT_CALL_BELL_PITCH,
    chimeVolume: chimeVolume ?? DEFAULT_CALL_BELL_VOLUME,
    speechVolume: speechVolume ?? DEFAULT_CALL_BELL_VOLUME,
  });

  useEffect(() => {
    savedPhraseRef.current = phrase;
    setDraft(phrase?.trim() ?? '');
  }, [phrase]);

  useEffect(() => {
    const next = rate ?? DEFAULT_CALL_BELL_RATE;
    slidersRef.current.rate = next;
    setRateValue(next);
  }, [rate]);

  useEffect(() => {
    const next = pitch ?? DEFAULT_CALL_BELL_PITCH;
    slidersRef.current.pitch = next;
    setPitchValue(next);
  }, [pitch]);

  useEffect(() => {
    const next = chimeVolume ?? DEFAULT_CALL_BELL_VOLUME;
    slidersRef.current.chimeVolume = next;
    setChimeVolumeValue(next);
  }, [chimeVolume]);

  useEffect(() => {
    const next = speechVolume ?? DEFAULT_CALL_BELL_VOLUME;
    slidersRef.current.speechVolume = next;
    setSpeechVolumeValue(next);
  }, [speechVolume]);

  useEffect(() => () => window.clearTimeout(sliderTimer.current), []);

  const lang = VEVENO_DATE_LOCALES[locale];

  const putCallBell = (nextPhrase: string | null) => {
    const sliders = slidersRef.current;
    return vevenoApi.updateCallBellPhrase(storeId, {
      phrase: nextPhrase,
      rate: clampCallBellRate(sliders.rate),
      pitch: clampCallBellPitch(sliders.pitch),
      chimeVolume: clampCallBellVolume(sliders.chimeVolume),
      speechVolume: clampCallBellVolume(sliders.speechVolume),
    });
  };

  const saveSliders = async () => {
    try {
      const { data } = await putCallBell(savedPhraseRef.current?.trim() || null);
      onSaved({
        callBellPhrase: savedPhraseRef.current ?? data.callBellPhrase,
        callBellRate: data.callBellRate,
        callBellPitch: data.callBellPitch,
        callBellChimeVolume: data.callBellChimeVolume,
        callBellSpeechVolume: data.callBellSpeechVolume,
      });
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('callbell.saveFailed'), t));
    }
  };

  const queueSliderSave = () => {
    window.clearTimeout(sliderTimer.current);
    sliderTimer.current = window.setTimeout(() => {
      void saveSliders();
    }, 400);
  };

  const changeSlider = (
    key: 'rate' | 'pitch' | 'chimeVolume' | 'speechVolume',
    next: number,
    setValue: (value: number) => void,
  ) => {
    slidersRef.current[key] = next;
    setValue(next);
    queueSliderSave();
  };

  const call = () => {
    setError('');
    const line = callBellSpoken(slot, draft, locale);
    if (!line) {
      setError(t('callbell.needNumber'));
      return;
    }
    const rateClamped = clampCallBellRate(rateValue);
    const pitchClamped = clampCallBellPitch(pitchValue);
    const chimeClamped = clampCallBellVolume(chimeVolumeValue);
    const speechClamped = clampCallBellVolume(speechVolumeValue);
    playCallBellChime(() => {
      speak(line, lang, rateClamped, pitchClamped, speechClamped);
    }, chimeClamped);
    slotRef.current?.select();
  };

  const save = async () => {
    window.clearTimeout(sliderTimer.current);
    setSaving(true);
    setError('');
    try {
      const { data } = await putCallBell(draft.trim() || null);
      savedPhraseRef.current = data.callBellPhrase;
      onSaved({
        callBellPhrase: data.callBellPhrase,
        callBellRate: slidersRef.current.rate,
        callBellPitch: slidersRef.current.pitch,
        callBellChimeVolume: slidersRef.current.chimeVolume,
        callBellSpeechVolume: slidersRef.current.speechVolume,
      });
      setDraft(data.callBellPhrase?.trim() ?? '');
    } catch (err: unknown) {
      setError(getVevenoErrorMessage(err, t('callbell.saveFailed'), t));
    } finally {
      setSaving(false);
    }
  };

  const preview = callBellSpeech(slot || '000', draft) ?? '';

  return (
    <div className="veveno-tools-block">
      <h3 className="veveno-tools-block__title">{t('callbell.title')}</h3>
      <p className="veveno-tools-block__lead">{t('callbell.lead')}</p>
      <form
        className="veveno-callbell-call"
        onSubmit={(event) => {
          event.preventDefault();
          call();
        }}
      >
        <VevenoInput
          ref={slotRef}
          label={t('callbell.number')}
          value={slot}
          onChange={(event) => setSlot(event.target.value)}
          placeholder={t('callbell.numberPh')}
          autoComplete="off"
        />
        <VevenoButton type="submit">{t('callbell.call')}</VevenoButton>
      </form>
      <p className="veveno-callbell-preview">{preview}</p>
      <label className="veveno-field">
        <span className="veveno-field__label">{t('callbell.phrase')}</span>
        <textarea
          className="veveno-field__input veveno-callbell-phrase"
          value={draft}
          maxLength={200}
          rows={2}
          placeholder={t('callbell.phrasePh')}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <div className="veveno-btn-row">
        <VevenoButton
          type="button"
          variant="secondary"
          onClick={() => setSettingsOpen(true)}
        >
          {t('callbell.settings')}
        </VevenoButton>
        <VevenoButton
          type="button"
          variant="secondary"
          loading={saving}
          onClick={() => {
            void save();
          }}
        >
          {t('callbell.save')}
        </VevenoButton>
      </div>
      {error ? <p className="veveno-error">{error}</p> : null}
      <VevenoModal
        open={settingsOpen}
        title={t('callbell.settings')}
        onClose={() => setSettingsOpen(false)}
      >
        <label className="veveno-field veveno-callbell-range">
          <span className="veveno-field__label">
            {t('callbell.rate')} {clampCallBellRate(rateValue).toFixed(1)}
          </span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={rateValue}
            onChange={(event) =>
              changeSlider('rate', Number(event.target.value), setRateValue)
            }
          />
        </label>
        <label className="veveno-field veveno-callbell-range">
          <span className="veveno-field__label">
            {t('callbell.pitch')} {clampCallBellPitch(pitchValue).toFixed(1)}
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={pitchValue}
            onChange={(event) =>
              changeSlider('pitch', Number(event.target.value), setPitchValue)
            }
          />
        </label>
        <label className="veveno-field veveno-callbell-range">
          <span className="veveno-field__label">
            {t('callbell.chimeVolume')} {Math.round(clampCallBellVolume(chimeVolumeValue) * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={chimeVolumeValue}
            onChange={(event) =>
              changeSlider('chimeVolume', Number(event.target.value), setChimeVolumeValue)
            }
          />
        </label>
        <label className="veveno-field veveno-callbell-range">
          <span className="veveno-field__label">
            {t('callbell.speechVolume')} {Math.round(clampCallBellVolume(speechVolumeValue) * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={speechVolumeValue}
            onChange={(event) =>
              changeSlider('speechVolume', Number(event.target.value), setSpeechVolumeValue)
            }
          />
        </label>
      </VevenoModal>
    </div>
  );
}
