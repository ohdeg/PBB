import type { TranslationKey } from '../i18n/messages';
import type { TranslateFn } from '../i18n/translate';
import { AppError } from './appError';

export function resolveErrorMessage(
  t: TranslateFn,
  error: unknown,
  fallbackKey: TranslationKey,
): string {
  if (error instanceof AppError) {
    return t(error.messageKey, error.params);
  }

  return t(fallbackKey);
}
