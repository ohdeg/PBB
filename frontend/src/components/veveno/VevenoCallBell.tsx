import { useEffect, useRef, useState } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import {
  callBellSpeech,
  clampCallBellPitch,
  clampCallBellRate,
  DEFAULT_CALL_BELL_PHRASE,
  DEFAULT_CALL_BELL_PITCH,
  DEFAULT_CALL_BELL_RATE,
} from '../../features/veveno/callbell/speech';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useVevenoI18n } from '../../features/veveno/i18n/LanguageContext';
import { VEVENO_DATE_LOCALES } from '../../features/veveno/i18n/detect';
import type { VevenoStore } from '../../types/veveno';
import { VevenoButton } from './VevenoButton';
import { VevenoInput } from './VevenoInput';

export type VevenoCallBellSaved = Pick<
  VevenoStore,
  'callBellPhrase' | 'callBellRate' | 'callBellPitch'
>;

interface VevenoCallBellProps {
  storeId: string;
  phrase: string | null;
  rate: number | null;
  pitch: number | null;
  onSaved: (next: VevenoCallBellSaved) => void;
}

function speak(text: string, lang: string, rate: number, pitch: number): void {
  if (!window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;
  window.speechSynthesis.speak(utterance);
}

export function VevenoCallBell({ storeId, phrase, rate, pitch, onSaved }: VevenoCallBellProps) {
  const { t, locale } = useVevenoI18n();
  const slotRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState('');
  const [draft, setDraft] = useState(phrase?.trim() || DEFAULT_CALL_BELL_PHRASE);
  const [rateValue, setRateValue] = useState(rate ?? DEFAULT_CALL_BELL_RATE);
  const [pitchValue, setPitchValue] = useState(pitch ?? DEFAULT_CALL_BELL_PITCH);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(phrase?.trim() || DEFAULT_CALL_BELL_PHRASE);
  }, [phrase]);

  useEffect(() => {
    setRateValue(rate ?? DEFAULT_CALL_BELL_RATE);
  }, [rate]);

  useEffect(() => {
    setPitchValue(pitch ?? DEFAULT_CALL_BELL_PITCH);
  }, [pitch]);

  const lang = VEVENO_DATE_LOCALES[locale];

  const call = () => {
    setError('');
    const line = callBellSpeech(slot, draft);
    if (!line) {
      setError(t('callbell.needNumber'));
      return;
    }
    speak(line, lang, clampCallBellRate(rateValue), clampCallBellPitch(pitchValue));
    slotRef.current?.select();
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await vevenoApi.updateCallBellPhrase(storeId, {
        phrase: draft,
        rate: clampCallBellRate(rateValue),
        pitch: clampCallBellPitch(pitchValue),
      });
      onSaved({
        callBellPhrase: data.callBellPhrase,
        callBellRate: data.callBellRate,
        callBellPitch: data.callBellPitch,
      });
      setDraft(data.callBellPhrase?.trim() || DEFAULT_CALL_BELL_PHRASE);
      setRateValue(data.callBellRate ?? DEFAULT_CALL_BELL_RATE);
      setPitchValue(data.callBellPitch ?? DEFAULT_CALL_BELL_PITCH);
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
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
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
          onChange={(event) => setRateValue(Number(event.target.value))}
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
          onChange={(event) => setPitchValue(Number(event.target.value))}
        />
      </label>
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
      {error ? <p className="veveno-error">{error}</p> : null}
    </div>
  );
}
