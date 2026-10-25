import type { TranslationKey, TranslationParams } from '../i18n/messages';

export class AppError extends Error {
  readonly messageKey: TranslationKey;
  readonly params?: TranslationParams;

  constructor(messageKey: TranslationKey, params?: TranslationParams) {
    super(messageKey);
    this.name = 'AppError';
    this.messageKey = messageKey;
    this.params = params;
  }
}
