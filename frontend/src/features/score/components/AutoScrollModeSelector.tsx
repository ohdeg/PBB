import type { AutoScrollMode } from '../constants/userPreferences';
import { useTranslation } from '../i18n/LanguageContext';
import { useScorePlaybackStore } from '../store/scorePlaybackStore';

export function AutoScrollModeSelector() {
  const t = useTranslation();
  const autoScrollMode = useScorePlaybackStore((state) => state.autoScrollMode);
  const setAutoScrollMode = useScorePlaybackStore((state) => state.setAutoScrollMode);

  const handleChange = (mode: AutoScrollMode) => {
    setAutoScrollMode(mode);
  };

  return (
    <>
      <p className="account-settings-desc-inline">{t('librarySettings.description')}</p>
      <fieldset className="library-settings-fieldset">
        <legend>{t('librarySettings.autoScrollLegend')}</legend>
        <label className="library-settings-option">
          <input
            type="radio"
            name="auto-scroll-mode"
            value="line"
            checked={autoScrollMode === 'line'}
            onChange={() => handleChange('line')}
          />
          <span className="library-settings-option-body">
            <strong>{t('librarySettings.lineTitle')}</strong>
            <span>{t('librarySettings.lineDesc')}</span>
          </span>
        </label>
        <label className="library-settings-option">
          <input
            type="radio"
            name="auto-scroll-mode"
            value="page"
            checked={autoScrollMode === 'page'}
            onChange={() => handleChange('page')}
          />
          <span className="library-settings-option-body">
            <strong>{t('librarySettings.pageTitle')}</strong>
            <span>{t('librarySettings.pageDesc')}</span>
          </span>
        </label>
      </fieldset>
    </>
  );
}
