import type { BeatStrengthLevel } from '../utils/beatStrength';
import type { TranslateFn } from './translate';

export function getBeatStrengthLabel(t: TranslateFn, level: BeatStrengthLevel): string {
  switch (level) {
    case 'silent':
      return t('beatStrength.silent');
    case 'weak':
      return t('beatStrength.weak');
    case 'medium':
      return t('beatStrength.medium');
    case 'strong':
      return t('beatStrength.strong');
    default:
      return t('beatStrength.strong');
  }
}
