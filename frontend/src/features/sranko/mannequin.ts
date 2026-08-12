import type { SrankoUserPrefs } from './types';

const MALE_MANNEQUIN = '/sranko/fit-mannequin-right25.webp';
const FEMALE_MANNEQUIN = '/sranko/fit-mannequin-right25-female.webp';

/** Default fit-map / try-on preview mannequin for prefs sex (null → male). */
export function defaultMannequinSrc(
  sex: SrankoUserPrefs['sex'] | string | null | undefined,
): string {
  return sex != null && String(sex).trim().toUpperCase() === 'F'
    ? FEMALE_MANNEQUIN
    : MALE_MANNEQUIN;
}
