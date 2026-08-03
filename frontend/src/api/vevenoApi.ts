import { apiClient } from './axios';
import type {
  VevenoCalendar,
  VevenoCover,
  VevenoCreateCoverInput,
  VevenoJoinRequest,
  VevenoMenu,
  VevenoNotice,
  VevenoNoticeInput,
  VevenoRecipe,
  VevenoSchedule,
  VevenoScheduleSlotInput,
  VevenoStock,
  VevenoStockCategory,
  VevenoStore,
  VevenoSubscriber,
  VevenoTimerPreset,
  VevenoTimerPresetInput,
} from '../types/veveno';
import type { ApiMessageResponse } from '../types/auth';

export const vevenoApi = {
  myStores() {
    return apiClient.get<VevenoStore[]>('/api/v1/veveno/stores/mine');
  },

  publicStores() {
    return apiClient.get<VevenoStore[]>('/api/v1/veveno/stores/public');
  },

  searchStores(q: string) {
    return apiClient.get<VevenoStore[]>('/api/v1/veveno/stores/search', {
      params: { q },
    });
  },

  subscriptions() {
    return apiClient.get<VevenoStore[]>('/api/v1/veveno/subscriptions');
  },

  createStore(payload: { name: string; isPublic: boolean }) {
    return apiClient.post<VevenoStore>('/api/v1/veveno/stores', payload);
  },

  getStore(storeId: string) {
    return apiClient.get<VevenoStore>(`/api/v1/veveno/stores/${storeId}`);
  },

  updateStore(storeId: string, payload: { name: string; isPublic: boolean }) {
    return apiClient.patch<VevenoStore>(`/api/v1/veveno/stores/${storeId}`, payload);
  },

  regenerateInviteCode(storeId: string) {
    return apiClient.post<VevenoStore>(
      `/api/v1/veveno/stores/${storeId}/invite-code/regenerate`,
    );
  },

  deleteStore(storeId: string) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/veveno/stores/${storeId}`);
  },

  listMenus(storeId: string) {
    return apiClient.get<VevenoMenu[]>(`/api/v1/veveno/stores/${storeId}/menus`);
  },

  createMenu(storeId: string, name: string) {
    return apiClient.post<VevenoMenu>(`/api/v1/veveno/stores/${storeId}/menus`, { name });
  },

  updateMenu(menuId: string, name: string) {
    return apiClient.patch<VevenoMenu>(`/api/v1/veveno/menus/${menuId}`, { name });
  },

  deleteMenu(menuId: string) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/veveno/menus/${menuId}`);
  },

  listNotices(storeId: string) {
    return apiClient.get<VevenoNotice[]>(`/api/v1/veveno/stores/${storeId}/notices`);
  },

  createNotice(storeId: string, payload: VevenoNoticeInput) {
    return apiClient.post<VevenoNotice>(`/api/v1/veveno/stores/${storeId}/notices`, payload);
  },

  updateNotice(noticeId: string, payload: VevenoNoticeInput) {
    return apiClient.patch<VevenoNotice>(`/api/v1/veveno/notices/${noticeId}`, payload);
  },

  deleteNotice(noticeId: string) {
    return apiClient.delete(`/api/v1/veveno/notices/${noticeId}`);
  },

  listRecipes(menuId: string) {
    return apiClient.get<VevenoRecipe[]>(`/api/v1/veveno/menus/${menuId}/recipes`);
  },

  createRecipe(menuId: string, contents: string) {
    return apiClient.post<VevenoRecipe>(`/api/v1/veveno/menus/${menuId}/recipes`, {
      contents,
    });
  },

  updateRecipe(recipeId: string, contents: string) {
    return apiClient.patch<VevenoRecipe>(`/api/v1/veveno/recipes/${recipeId}`, {
      contents,
    });
  },

  deleteRecipe(recipeId: string) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/veveno/recipes/${recipeId}`);
  },

  listStocks(storeId: string) {
    return apiClient.get<VevenoStockCategory[]>(`/api/v1/veveno/stores/${storeId}/stocks`);
  },

  createStockCategory(storeId: string, name: string) {
    return apiClient.post<VevenoStockCategory>(
      `/api/v1/veveno/stores/${storeId}/stock-categories`,
      { name },
    );
  },

  updateStockCategory(categoryId: number, name: string) {
    return apiClient.patch<VevenoStockCategory>(
      `/api/v1/veveno/stock-categories/${categoryId}`,
      { name },
    );
  },

  deleteStockCategory(categoryId: number) {
    return apiClient.delete<ApiMessageResponse>(
      `/api/v1/veveno/stock-categories/${categoryId}`,
    );
  },

  createStock(
    categoryId: number,
    payload: { stockName: string; stockNum: number; stockMinNum: number | null },
  ) {
    return apiClient.post<VevenoStock>(
      `/api/v1/veveno/stock-categories/${categoryId}/stocks`,
      payload,
    );
  },

  updateStock(
    stockId: number,
    payload: {
      stockName: string;
      stockNum: number;
      stockMinNum: number | null;
      version: number;
    },
  ) {
    return apiClient.patch<VevenoStock>(`/api/v1/veveno/stocks/${stockId}`, payload);
  },

  deleteStock(stockId: number) {
    return apiClient.delete<ApiMessageResponse>(`/api/v1/veveno/stocks/${stockId}`);
  },

  requestJoin(storeId: string) {
    return apiClient.post<ApiMessageResponse>(`/api/v1/veveno/stores/${storeId}/join`);
  },

  listJoinRequests(storeId: string) {
    return apiClient.get<VevenoJoinRequest[]>(
      `/api/v1/veveno/stores/${storeId}/join-requests`,
    );
  },

  listSubscribers(storeId: string) {
    return apiClient.get<VevenoSubscriber[]>(
      `/api/v1/veveno/stores/${storeId}/subscribers`,
    );
  },

  updateStockPermission(storeId: string, userId: string, canEditStock: boolean) {
    return apiClient.patch<VevenoSubscriber>(
      `/api/v1/veveno/stores/${storeId}/subscribers/${userId}/stock-permission`,
      { canEditStock },
    );
  },

  approveJoin(
    storeId: string,
    userId: string,
    body: {
      canEditStock: boolean;
      workStartDate: string | null;
      slots: VevenoScheduleSlotInput[];
    },
  ) {
    return apiClient.post<ApiMessageResponse>(
      `/api/v1/veveno/stores/${storeId}/join-requests/${userId}/approve`,
      body,
    );
  },

  rejectJoin(storeId: string, userId: string) {
    return apiClient.post<ApiMessageResponse>(
      `/api/v1/veveno/stores/${storeId}/join-requests/${userId}/reject`,
    );
  },

  unsubscribe(storeId: string, leaveDate: string) {
    return apiClient.delete<ApiMessageResponse>(
      `/api/v1/veveno/subscriptions/${storeId}`,
      { data: { leaveDate } },
    );
  },

  resignSubscriber(storeId: string, userId: string, leaveDate: string) {
    return apiClient.post<VevenoSubscriber | ApiMessageResponse>(
      `/api/v1/veveno/stores/${storeId}/subscribers/${userId}/resign`,
      { leaveDate },
    );
  },

  clearSubscriberLeave(storeId: string, userId: string) {
    return apiClient.delete<VevenoSubscriber>(
      `/api/v1/veveno/stores/${storeId}/subscribers/${userId}/leave`,
    );
  },

  clearMyLeave(storeId: string) {
    return apiClient.delete<ApiMessageResponse>(
      `/api/v1/veveno/subscriptions/${storeId}/leave`,
    );
  },

  countCoversAfterLeave(storeId: string, userId: string, leaveDate: string) {
    return apiClient.get<{ count: number }>(
      `/api/v1/veveno/stores/${storeId}/subscribers/${userId}/covers-after-leave`,
      { params: { leaveDate } },
    );
  },

  listSchedules(storeId: string) {
    return apiClient.get<VevenoSchedule[]>(`/api/v1/veveno/stores/${storeId}/schedules`);
  },

  listStaff(storeId: string) {
    return apiClient.get<{ userId: string; nickname: string }[]>(
      `/api/v1/veveno/stores/${storeId}/staff`,
    );
  },

  replaceSchedules(storeId: string, userId: string, slots: VevenoScheduleSlotInput[]) {
    return apiClient.put<VevenoSchedule[]>(
      `/api/v1/veveno/stores/${storeId}/schedules/${userId}`,
      { slots },
    );
  },

  getCalendar(storeId: string, from: string, to: string) {
    return apiClient.get<VevenoCalendar>(`/api/v1/veveno/stores/${storeId}/calendar`, {
      params: { from, to },
    });
  },

  listPendingCovers(storeId: string) {
    return apiClient.get<VevenoCover[]>(`/api/v1/veveno/stores/${storeId}/covers/pending`);
  },

  createCover(storeId: string, payload: VevenoCreateCoverInput) {
    return apiClient.post<VevenoCover>(`/api/v1/veveno/stores/${storeId}/covers`, payload);
  },

  assignCover(coverId: string, coverUserId: string) {
    return apiClient.post<VevenoCover>(`/api/v1/veveno/covers/${coverId}/assign`, {
      coverUserId,
    });
  },

  acceptCover(coverId: string) {
    return apiClient.post<VevenoCover>(`/api/v1/veveno/covers/${coverId}/accept`);
  },

  rejectCover(coverId: string) {
    return apiClient.post<VevenoCover>(`/api/v1/veveno/covers/${coverId}/reject`);
  },

  cancelCover(coverId: string) {
    return apiClient.post<VevenoCover>(`/api/v1/veveno/covers/${coverId}/cancel`);
  },

  listPersonalTimerPresets() {
    return apiClient.get<VevenoTimerPreset[]>('/api/v1/veveno/timer-presets');
  },

  createPersonalTimerPreset(payload: VevenoTimerPresetInput) {
    return apiClient.post<VevenoTimerPreset>('/api/v1/veveno/timer-presets', payload);
  },

  updatePersonalTimerPreset(presetId: string, payload: VevenoTimerPresetInput) {
    return apiClient.put<VevenoTimerPreset>(
      `/api/v1/veveno/timer-presets/${presetId}`,
      payload,
    );
  },

  deletePersonalTimerPreset(presetId: string) {
    return apiClient.delete(`/api/v1/veveno/timer-presets/${presetId}`);
  },

  listStoreTimerPresets(storeId: string) {
    return apiClient.get<VevenoTimerPreset[]>(
      `/api/v1/veveno/stores/${storeId}/timer-presets`,
    );
  },

  createStoreTimerPreset(storeId: string, payload: VevenoTimerPresetInput) {
    return apiClient.post<VevenoTimerPreset>(
      `/api/v1/veveno/stores/${storeId}/timer-presets`,
      payload,
    );
  },

  updateStoreTimerPreset(
    storeId: string,
    presetId: string,
    payload: VevenoTimerPresetInput,
  ) {
    return apiClient.put<VevenoTimerPreset>(
      `/api/v1/veveno/stores/${storeId}/timer-presets/${presetId}`,
      payload,
    );
  },

  deleteStoreTimerPreset(storeId: string, presetId: string) {
    return apiClient.delete(
      `/api/v1/veveno/stores/${storeId}/timer-presets/${presetId}`,
    );
  },
};
