export const VEVENO_LANG_KEY = 'veveno:lang';

export const VEVENO_LOCALES = ['ko', 'en', 'ja'] as const;
export type VevenoLocale = (typeof VEVENO_LOCALES)[number];

export const VEVENO_LOCALE_LABELS: Record<VevenoLocale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
};

export const VEVENO_DATE_LOCALES: Record<VevenoLocale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
};

export function parseVevenoLocale(raw: string | null | undefined): VevenoLocale | null {
  if (!raw) {
    return null;
  }
  const base = raw.trim().toLowerCase().split('-')[0];
  if (base === 'ko' || base === 'en' || base === 'ja') {
    return base;
  }
  return null;
}

export function detectBrowserLocale(
  languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages,
  language: string | undefined = typeof navigator === 'undefined' ? undefined : navigator.language,
): VevenoLocale {
  for (const lang of languages) {
    const parsed = parseVevenoLocale(lang);
    if (parsed) {
      return parsed;
    }
  }
  return parseVevenoLocale(language) ?? 'ko';
}

export function readSavedLocale(): VevenoLocale | null {
  try {
    return parseVevenoLocale(localStorage.getItem(VEVENO_LANG_KEY));
  } catch {
    return null;
  }
}

export function resolveVevenoLocale(): VevenoLocale {
  return readSavedLocale() ?? detectBrowserLocale();
}

export function saveVevenoLocale(locale: VevenoLocale): void {
  localStorage.setItem(VEVENO_LANG_KEY, locale);
}
