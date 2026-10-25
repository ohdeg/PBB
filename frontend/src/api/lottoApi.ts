import { apiClient } from './axios';
import type {
  LottoDraw,
  LottoHistoryItem,
  LottoPatternProfilesDto,
} from '../types/lotto';
import type { ApiMessageResponse } from '../types/auth';

interface LottoUserPicksApiResponse {
  targetRound: number | null;
  itemsJson: string;
}

function parseItems(itemsJson: string): LottoHistoryItem[] {
  const parsed: unknown = JSON.parse(itemsJson);
  if (!Array.isArray(parsed) || !parsed.every((item) =>
    item && typeof item === 'object' && Number.isSafeInteger(item.id) &&
    ['name', 'category', 'reviews', 'icon', 'color'].every((key) => typeof item[key] === 'string') &&
    (item.numbers === undefined || (Array.isArray(item.numbers) && item.numbers.every(Number.isInteger)))
  )) {
    throw new Error('저장된 추첨 내역을 읽을 수 없습니다.');
  }
  return parsed as LottoHistoryItem[];
}

export const lottoApi = {
  listDraws() {
    return apiClient.get<LottoDraw[]>('/api/v1/lotto/draws');
  },

  latestDraw() {
    return apiClient.get<LottoDraw>('/api/v1/lotto/draws/latest');
  },

  patternProfiles() {
    return apiClient.get<LottoPatternProfilesDto>(
      '/api/v1/lotto/pattern-profiles',
    );
  },

  upsertDraw(payload: {
    round: number;
    mainNumbers: number[];
    bonusNumber?: number | null;
    drawDate?: string | null;
    firstPrizeAmount?: number | null;
    firstPrizeWinnerCount?: number | null;
  }) {
    return apiClient.put<LottoDraw>('/api/v1/lotto/draws', payload);
  },

  deleteDraw(round: number) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/lotto/draws/${round}`);
  },

  replaceDraws(
    draws: Array<{
      round: number;
      mainNumbers: number[];
      bonusNumber?: number | null;
      drawDate?: string | null;
      firstPrizeAmount?: number | null;
      firstPrizeWinnerCount?: number | null;
    }>,
  ) {
    return apiClient.put<LottoDraw[]>('/api/v1/lotto/draws/replace', { draws });
  },

  async getPicks(signal?: AbortSignal): Promise<{
    targetRound: number | null;
    items: LottoHistoryItem[];
  }> {
    const { data } = await apiClient.get<LottoUserPicksApiResponse>(
      '/api/v1/lotto/picks',
      { signal },
    );
    return {
      targetRound: data.targetRound,
      items: parseItems(data.itemsJson),
    };
  },

  async savePicks(targetRound: number | null, items: LottoHistoryItem[], signal?: AbortSignal) {
    const { data } = await apiClient.put<LottoUserPicksApiResponse>(
      '/api/v1/lotto/picks',
      {
        targetRound,
        itemsJson: JSON.stringify(items),
      },
      { signal },
    );
    return {
      targetRound: data.targetRound,
      items: parseItems(data.itemsJson),
    };
  },

  clearPicks() {
    return apiClient.post<ApiMessageResponse>('/api/v1/lotto/picks/clear');
  },
};
