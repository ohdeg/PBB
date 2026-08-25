import {
  VEVENO_MESSAGES,
  type TranslationKey,
  type TranslationParams,
  type VevenoMessageTree,
} from './messages';
import type { VevenoLocale } from './detect';

function getNestedValue(tree: VevenoMessageTree, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree as unknown);
  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = params[token];
    return value === undefined ? `{{${token}}}` : String(value);
  });
}

export type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

export const VEVENO_WEEKDAY_KEYS = [
  'weekdays.mon',
  'weekdays.tue',
  'weekdays.wed',
  'weekdays.thu',
  'weekdays.fri',
  'weekdays.sat',
  'weekdays.sun',
] as const;

export function vevenoWeekdayLabels(t: TranslateFn): string[] {
  return VEVENO_WEEKDAY_KEYS.map((key) => t(key));
}

export function createTranslator(locale: VevenoLocale): TranslateFn {
  const tree = VEVENO_MESSAGES[locale];
  const fallback = VEVENO_MESSAGES.ko;
  return (key, params) => {
    const localized = getNestedValue(tree, key) ?? getNestedValue(fallback, key);
    return interpolate(localized ?? key, params);
  };
}
