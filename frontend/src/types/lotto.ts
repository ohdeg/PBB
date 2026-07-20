import type { HotColdWindowKey } from '../features/lotto/utils/lottoDrawStats';

export interface LottoDraw {
  round: number;
  mainNumbers: number[];
  bonusNumber?: number | null;
  drawDate?: string | null;
  firstPrizeAmount?: number | null;
  firstPrizeWinnerCount?: number | null;
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
