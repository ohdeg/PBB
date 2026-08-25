import { VEVENO_LOCALES, VEVENO_LOCALE_LABELS, type VevenoLocale } from '../../features/veveno/i18n/detect';
import { useVevenoI18n } from '../../features/veveno/i18n/LanguageContext';

export function VevenoLangSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useVevenoI18n();
  return (
    <div className={`veveno-lang ${className}`.trim()} role="group" aria-label={t('lang.label')}>
      {VEVENO_LOCALES.map((item: VevenoLocale) => (
        <button
          key={item}
          type="button"
          className="veveno-lang__btn"
          aria-pressed={locale === item}
          onClick={() => setLocale(item)}
        >
          {VEVENO_LOCALE_LABELS[item]}
        </button>
      ))}
    </div>
  );
}
