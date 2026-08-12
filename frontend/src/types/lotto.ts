import type { HotColdWindowKey } from '../features/lotto/utils/lottoDrawStats';

export interface LottoDraw {
  round: number;
  mainNumbers: number[];
  bonusNumber?: number | null;
  drawDate?: string | null;
  firstPrizeAmount?: number | null;
  firstPrizeWinnerCount?: number | null;
}

export interface LottoDiscretePreferenceDto {
  counts: Record<string, number>;
  mode: number;
  sampleSize: number;
}

export interface LottoContinuousPreferenceDto {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sampleSize: number;
}

export interface LottoPatternProfileDto {
  window: string;
  sampleSize: number;
  learnStrength: number;
  oddCount: LottoDiscretePreferenceDto;
  lowCount: LottoDiscretePreferenceDto;
  primeCount: LottoDiscretePreferenceDto;
  multipleOf3Count: LottoDiscretePreferenceDto;
  decadeEmpty: LottoDiscretePreferenceDto;
  carryOver: LottoDiscretePreferenceDto;
  hasSameEnding: LottoDiscretePreferenceDto;
  hasConsecutive: LottoDiscretePreferenceDto;
  sum: LottoContinuousPreferenceDto;
  span: LottoContinuousPreferenceDto;
  ac: LottoContinuousPreferenceDto;
}

export interface LottoPatternProfilesDto {
  profiles: Record<string, LottoPatternProfileDto>;
}

export function hotColdWindowToApiKey(window: HotColdWindowKey): string {
  return window === 'all' ? 'all' : String(window);
}

export interface LottoHistoryItem {
  id: number;
  name: string;
  category: string;
  reviews: string;
  icon: string;
  color: string;
  numbers?: number[];
  hotColdApplied?: boolean;
  hotColdWindow?: HotColdWindowKey;
  drawnAt?: string;
  isNumberPoolResetStart?: boolean;
  isSetBlockStart?: boolean;
  sixSetOrdinal?: number;
  sixSetGameIndex?: number;
  isSixSetComplementGame?: boolean;
}

export interface LottoUserPicksPayload {
  targetRound: number | null;
  items: LottoHistoryItem[];
}
