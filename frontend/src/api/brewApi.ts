import { apiClient } from './axios';
import type {
  BrewCalendar,
  BrewCover,
  BrewCreateCoverInput,
  BrewJoinRequest,
  BrewMenu,
  BrewNotice,
  BrewNoticeInput,
  BrewRecipe,
  BrewSchedule,
  BrewScheduleSlotInput,
  BrewStock,
  BrewStockCategory,
  BrewStore,
  BrewSubscriber,
  BrewTimerPreset,
  BrewTimerPresetInput,
} from '../types/brew';
import type { ApiMessageResponse } from '../types/auth';

export const brewApi = {
  myStores() {
    return apiClient.get<BrewStore[]>('/api/v1/brew/stores/mine');
  },

  publicStores() {
    return apiClient.get<BrewStore[]>('/api/v1/brew/stores/public');
  },

  searchStores(q: string) {
    return apiClient.get<BrewStore[]>('/api/v1/brew/stores/search', {
      params: { q },
    });
  },

  subscriptions() {
    return apiClient.get<BrewStore[]>('/api/v1/brew/subscriptions');
  },

  createStore(payload: { name: string; isPublic: boolean }) {
    return apiClient.post<BrewStore>('/api/v1/brew/stores', payload);
  },

  getStore(storeId: string) {
    return apiClient.get<BrewStore>(`/api/v1/brew/stores/${storeId}`);
  },

  updateStore(storeId: string, payload: { name: string; isPublic: boolean }) {
    return apiClient.patch<BrewStore>(`/api/v1/brew/stores/${storeId}`, payload);
  },

  regenerateInviteCode(storeId: string) {
    return apiClient.post<BrewStore>(
      `/api/v1/brew/stores/${storeId}/invite-code/regenerate`,
    );
  },

  deleteStore(storeId: string) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/brew/stores/${storeId}`);
  },

  listMenus(storeId: string) {
    return apiClient.get<BrewMenu[]>(`/api/v1/brew/stores/${storeId}/menus`);
  },

  createMenu(storeId: string, name: string) {
    return apiClient.post<BrewMenu>(`/api/v1/brew/stores/${storeId}/menus`, { name });
  },

  updateMenu(menuId: string, name: string) {
    return apiClient.patch<BrewMenu>(`/api/v1/brew/menus/${menuId}`, { name });
  },

  deleteMenu(menuId: string) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/brew/menus/${menuId}`);
  },

  listNotices(storeId: string) {
    return apiClient.get<BrewNotice[]>(`/api/v1/brew/stores/${storeId}/notices`);
  },

  createNotice(storeId: string, payload: BrewNoticeInput) {
    return apiClient.post<BrewNotice>(`/api/v1/brew/stores/${storeId}/notices`, payload);
  },

  updateNotice(noticeId: string, payload: BrewNoticeInput) {
    return apiClient.patch<BrewNotice>(`/api/v1/brew/notices/${noticeId}`, payload);
  },

  deleteNotice(noticeId: string) {
    return apiClient.delete(`/api/v1/brew/notices/${noticeId}`);
  },

  listRecipes(menuId: string) {
    return apiClient.get<BrewRecipe[]>(`/api/v1/brew/menus/${menuId}/recipes`);
  },

  createRecipe(menuId: string, contents: string) {
    return apiClient.post<BrewRecipe>(`/api/v1/brew/menus/${menuId}/recipes`, {
      contents,
    });
  },

  updateRecipe(recipeId: string, contents: string) {
    return apiClient.patch<BrewRecipe>(`/api/v1/brew/recipes/${recipeId}`, {
      contents,
    });
  },

  deleteRecipe(recipeId: string) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/brew/recipes/${recipeId}`);
  },

  listStocks(storeId: string) {
    return apiClient.get<BrewStockCategory[]>(`/api/v1/brew/stores/${storeId}/stocks`);
  },

  createStockCategory(storeId: string, name: string) {
    return apiClient.post<BrewStockCategory>(
      `/api/v1/brew/stores/${storeId}/stock-categories`,
      { name },
    );
  },

  updateStockCategory(categoryId: number, name: string) {
    return apiClient.patch<BrewStockCategory>(
      `/api/v1/brew/stock-categories/${categoryId}`,
      { name },
    );
  },

  deleteStockCategory(categoryId: number) {
    return apiClient.delete<ApiMessageResponse>(
      `/api/v1/brew/stock-categories/${categoryId}`,
    );
  },

  createStock(
    categoryId: number,
    payload: { stockName: string; stockNum: number; stockMinNum: number | null },
  ) {
    return apiClient.post<BrewStock>(
      `/api/v1/brew/stock-categories/${categoryId}/stocks`,
      payload,
    );
  },

  updateStock(
    stockId: number,
    payload: { stockName: string; stockNum: number; stockMinNum: number | null },
  ) {
    return apiClient.patch<BrewStock>(`/api/v1/brew/stocks/${stockId}`, payload);
  },

  deleteStock(stockId: number) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/brew/stocks/${stockId}`);
  },

  requestJoin(storeId: string) {
    return apiClient.post<ApiMessageResponse>(`/api/v1/brew/stores/${storeId}/join`);
  },

  listJoinRequests(storeId: string) {
    return apiClient.get<BrewJoinRequest[]>(
      `/api/v1/brew/stores/${storeId}/join-requests`,
    );
  },

  listSubscribers(storeId: string) {
    return apiClient.get<BrewSubscriber[]>(
      `/api/v1/brew/stores/${storeId}/subscribers`,
    );
  },

  updateStockPermission(storeId: string, userId: string, canEditStock: boolean) {
    return apiClient.patch<BrewSubscriber>(
      `/api/v1/brew/stores/${storeId}/subscribers/${userId}/stock-permission`,
      { canEditStock },
    );
  },

  approveJoin(
    storeId: string,
    userId: string,
    body: {
      canEditStock: boolean;
      workStartDate: string | null;
      slots: BrewScheduleSlotInput[];
    },
  ) {
    return apiClient.post<ApiMessageResponse>(
      `/api/v1/brew/stores/${storeId}/join-requests/${userId}/approve`,
      body,
    );
  },

  rejectJoin(storeId: string, userId: string) {
    return apiClient.post<ApiMessageResponse>(
      `/api/v1/brew/stores/${storeId}/join-requests/${userId}/reject`,
    );
  },

  unsubscribe(storeId: string, leaveDate: string) {
    return apiClient.delete<ApiMessageResponse>(
      `/api/v1/brew/subscriptions/${storeId}`,
      { data: { leaveDate } },
    );
  },

  resignSubscriber(storeId: string, userId: string, leaveDate: string) {
    return apiClient.post<BrewSubscriber | ApiMessageResponse>(
      `/api/v1/brew/stores/${storeId}/subscribers/${userId}/resign`,
      { leaveDate },
    );
  },

  clearSubscriberLeave(storeId: string, userId: string) {
    return apiClient.delete<BrewSubscriber>(
      `/api/v1/brew/stores/${storeId}/subscribers/${userId}/leave`,
    );
  },

  clearMyLeave(storeId: string) {
    return apiClient.delete<ApiMessageResponse>(
      `/api/v1/brew/subscriptions/${storeId}/leave`,
    );
  },

  countCoversAfterLeave(storeId: string, userId: string, leaveDate: string) {
    return apiClient.get<{ count: number }>(
      `/api/v1/brew/stores/${storeId}/subscribers/${userId}/covers-after-leave`,
      { params: { leaveDate } },
    );
  },

  listSchedules(storeId: string) {
    return apiClient.get<BrewSchedule[]>(`/api/v1/brew/stores/${storeId}/schedules`);
  },

  listStaff(storeId: string) {
    return apiClient.get<{ userId: string; nickname: string }[]>(
      `/api/v1/brew/stores/${storeId}/staff`,
    );
  },

  replaceSchedules(storeId: string, userId: string, slots: BrewScheduleSlotInput[]) {
    return apiClient.put<BrewSchedule[]>(
      `/api/v1/brew/stores/${storeId}/schedules/${userId}`,
      { slots },
    );
  },

  getCalendar(storeId: string, from: string, to: string) {
    return apiClient.get<BrewCalendar>(`/api/v1/brew/stores/${storeId}/calendar`, {
      params: { from, to },
    });
  },

  listPendingCovers(storeId: string) {
    return apiClient.get<BrewCover[]>(`/api/v1/brew/stores/${storeId}/covers/pending`);
  },

  createCover(storeId: string, payload: BrewCreateCoverInput) {
    return apiClient.post<BrewCover>(`/api/v1/brew/stores/${storeId}/covers`, payload);
  },

  assignCover(coverId: string, coverUserId: string) {
    return apiClient.post<BrewCover>(`/api/v1/brew/covers/${coverId}/assign`, {
      coverUserId,
    });
  },

  acceptCover(coverId: string) {
    return apiClient.post<BrewCover>(`/api/v1/brew/covers/${coverId}/accept`);
  },

  rejectCover(coverId: string) {
    return apiClient.post<BrewCover>(`/api/v1/brew/covers/${coverId}/reject`);
  },

  cancelCover(coverId: string) {
    return apiClient.post<BrewCover>(`/api/v1/brew/covers/${coverId}/cancel`);
  },

  listPersonalTimerPresets() {
    return apiClient.get<BrewTimerPreset[]>('/api/v1/brew/timer-presets');
  },

  createPersonalTimerPreset(payload: BrewTimerPresetInput) {
    return apiClient.post<BrewTimerPreset>('/api/v1/brew/timer-presets', payload);
  },

  updatePersonalTimerPreset(presetId: string, payload: BrewTimerPresetInput) {
    return apiClient.put<BrewTimerPreset>(
      `/api/v1/brew/timer-presets/${presetId}`,
      payload,
    );
  },

  deletePersonalTimerPreset(presetId: string) {
    return apiClient.delete(`/api/v1/brew/timer-presets/${presetId}`);
  },

  listStoreTimerPresets(storeId: string) {
    return apiClient.get<BrewTimerPreset[]>(
      `/api/v1/brew/stores/${storeId}/timer-presets`,
    );
  },

  createStoreTimerPreset(storeId: string, payload: BrewTimerPresetInput) {
    return apiClient.post<BrewTimerPreset>(
      `/api/v1/brew/stores/${storeId}/timer-presets`,
      payload,
    );
  },

  updateStoreTimerPreset(
    storeId: string,
    presetId: string,
    payload: BrewTimerPresetInput,
  ) {
    return apiClient.put<BrewTimerPreset>(
      `/api/v1/brew/stores/${storeId}/timer-presets/${presetId}`,
      payload,
    );
  },

  deleteStoreTimerPreset(storeId: string, presetId: string) {
    return apiClient.delete(
      `/api/v1/brew/stores/${storeId}/timer-presets/${presetId}`,
    );
  },
};
