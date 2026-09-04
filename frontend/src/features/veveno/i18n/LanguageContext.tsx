import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  resolveVevenoLocale,
  saveVevenoLocale,
  VEVENO_DATE_LOCALES,
  type VevenoLocale,
} from './detect';
import { createTranslator, type TranslateFn } from './translate';

interface VevenoI18nValue {
  locale: VevenoLocale;
  dateLocale: string;
  setLocale: (locale: VevenoLocale) => void;
  t: TranslateFn;
}

const VevenoI18nContext = createContext<VevenoI18nValue | null>(null);

export function VevenoI18nProvider({
  children,
  locale: localeOverride,
}: {
  children: ReactNode;
  locale?: VevenoLocale;
}) {
  const [locale, setLocaleState] = useState<VevenoLocale>(
    () => localeOverride ?? resolveVevenoLocale(),
  );

  useEffect(() => {
    if (localeOverride) {
      setLocaleState(localeOverride);
    }
  }, [localeOverride]);

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);

  const setLocale = useCallback((next: VevenoLocale) => {
    saveVevenoLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<VevenoI18nValue>(
    () => ({
      locale,
      dateLocale: VEVENO_DATE_LOCALES[locale],
      setLocale,
      t: createTranslator(locale),
    }),
    [locale, setLocale],
  );

  return <VevenoI18nContext.Provider value={value}>{children}</VevenoI18nContext.Provider>;
}

export function useVevenoI18n(): VevenoI18nValue {
  const context = useContext(VevenoI18nContext);
  const fallbackLocale = resolveVevenoLocale();
  const fallback = useMemo<VevenoI18nValue>(
    () => ({
      locale: fallbackLocale,
      dateLocale: VEVENO_DATE_LOCALES[fallbackLocale],
      setLocale: saveVevenoLocale,
      t: createTranslator(fallbackLocale),
    }),
    [fallbackLocale],
  );
  return context ?? fallback;
}

export function useTranslation(): TranslateFn {
  return useVevenoI18n().t;
}
