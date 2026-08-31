import { useEffect, useRef, useState } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import {
  callBellSpeech,
  DEFAULT_CALL_BELL_PHRASE,
} from '../../features/veveno/callbell/speech';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import {
  useVevenoI18n,
} from '../../features/veveno/i18n/LanguageContext';
import { VEVENO_DATE_LOCALES } from '../../features/veveno/i18n/detect';
import { VevenoButton } from './VevenoButton';
import { VevenoInput } from './VevenoInput';

interface VevenoCallBellProps {
  storeId: string;
  phrase: string | null;
  onPhraseChange: (phrase: string | null) => void;
}

function speak(text: string, lang: string): void {
  if (!window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

export function VevenoCallBell({
  storeId,
  phrase,
  onPhraseChange,
}: VevenoCallBellProps) {
  const { t, locale } = useVevenoI18n();
  const slotRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState('');
  const [draft, setDraft] = useState(phrase?.trim() || DEFAULT_CALL_BELL_PHRASE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(phrase?.trim() || DEFAULT_CALL_BELL_PHRASE);
  }, [phrase]);

  const call = () => {
    setError('');
    const line = callBellSpeech(slot, draft);
    if (!line) {
      setError(t('callbell.needNumber'));
      return;
    }
    speak(line, VEVENO_DATE_LOCALES[locale]);
    slotRef.current?.select();
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await vevenoApi.updateCallBellPhrase(storeId, draft);
      onPhraseChange(data.callBellPhrase);
      setDraft(data.callBellPhrase?.trim() || DEFAULT_CALL_BELL_PHRASE);
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
