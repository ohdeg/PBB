import { apiClient } from './axios';
import type { LottoDraw, LottoHistoryItem } from '../types/lotto';
import type { ApiMessageResponse } from '../types/auth';

interface LottoUserPicksApiResponse {
  targetRound: number | null;
  itemsJson: string;
}

function parseItems(itemsJson: string): LottoHistoryItem[] {
  try {
    const parsed: unknown = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as LottoHistoryItem[];
  } catch {
    return [];
  }
}

export const lottoApi = {
  listDraws() {
    return apiClient.get<LottoDraw[]>('/api/v1/lotto/draws');
  },

  latestDraw() {
    return apiClient.get<LottoDraw>('/api/v1/lotto/draws/latest');
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

  replaceDraws(draws: Array<{
    round: number;
    mainNumbers: number[];
    bonusNumber?: number | null;
    drawDate?: string | null;
    firstPrizeAmount?: number | null;
    firstPrizeWinnerCount?: number | null;
  }>) {
    return apiClient.put<LottoDraw[]>('/api/v1/lotto/draws/replace', { draws });
  },

  async getPicks(): Promise<{ targetRound: number | null; items: LottoHistoryItem[] }> {
    const { data } = await apiClient.get<LottoUserPicksApiResponse>('/api/v1/lotto/picks');
    return {
      targetRound: data.targetRound,
      items: parseItems(data.itemsJson),
    };
  },

  async savePicks(targetRound: number | null, items: LottoHistoryItem[]) {
    const trimmed = items.slice(0, 200);
    const { data } = await apiClient.put<LottoUserPicksApiResponse>('/api/v1/lotto/picks', {
      targetRound,
      itemsJson: JSON.stringify(trimmed),
    });
    return {
      targetRound: data.targetRound,
      items: parseItems(data.itemsJson),
    };
  },

  clearPicks() {
    return apiClient.post<ApiMessageResponse>('/api/v1/lotto/picks/clear');
  },
};
