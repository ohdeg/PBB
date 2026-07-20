import { SCORE_MESSAGES_KO, type MessageTree, type TranslationKey, type TranslationParams } from './messages';

function getNestedValue(tree: MessageTree, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree as unknown);

  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = params[token];
    return value === undefined ? `{{${token}}}` : String(value);
  });
}

export type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

export function createTranslator(): TranslateFn {
  return (key, params) => {
    const localized = getNestedValue(SCORE_MESSAGES_KO, key);
    return interpolate(localized ?? key, params);
  };
}
