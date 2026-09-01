import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAppStatusStore } from '../stores/appStatusStore';
import { useAuthStore } from '../stores/authStore';
import type { ApiErrorBody, RefreshResponse } from '../types/auth';
import {
  clearVevenoPosToken,
  getVevenoPosToken,
  isVevenoPosKiosk,
} from '../features/veveno/pos/session';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const posToken = isVevenoPosKiosk() ? getVevenoPosToken() : null;
  const token = posToken ?? useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Default JSON Content-Type breaks multipart boundaries — let the runtime set it.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;
let lastRefreshOkAt = 0;
const AUTH_RESUME_OK_WITHIN_MS = 10_000;

/** RT가 거절된 경우만 세션을 버린다. 네트워크·5xx는 쿠키가 살아 있을 수 있다. */
export function shouldClearAuthOnRefreshFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<RefreshResponse>('/api/v1/auth/refresh')
      .then((response) => {
        const token = response.data.accessToken;
        useAuthStore.getState().setAccessToken(token);
        lastRefreshOkAt = Date.now();
        return token;
      })
      .catch((error: unknown) => {
        if (shouldClearAuthOnRefreshFailure(error)) {
          useAuthStore.getState().clearAuth();
        }
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;

    if (error.response?.status === 503) {
      const body = error.response.data as ApiErrorBody | undefined;
      const message =
        body && typeof body.message === 'string' ? body.message : null;
      const url = originalRequest?.url ?? '';
      // Feature-level outages (sranko R2/ML) must not trip global maintenance UI.
      if (!url.includes('/sranko/')) {
        useAppStatusStore.getState().setMaintenance(true, message);
      }
      return Promise.reject(error);
    }

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    if (isVevenoPosKiosk()) {
      clearVevenoPosToken();
      return Promise.reject(error);
    }

    const isRefreshCall = originalRequest.url?.includes('/api/v1/auth/refresh');
    if (isRefreshCall) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const newToken = await refreshAccessToken();

    if (!newToken) {
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(originalRequest);
  },
);

/** 앱 시작 시 HttpOnly refresh cookie로 Access Token 복구 */
export async function bootstrapAuth(): Promise<boolean> {
  const token = await refreshAccessToken();
  return token !== null;
}

/** 백그라운드 복귀·네트워크 재연결 시 세션 재부착. 게스트는 치지 않는다. */
export function bindAuthResume(): () => void {
  const resume = () => {
    if (!useAuthStore.getState().accessToken) {
      return;
    }
    if (refreshPromise) {
      return;
    }
    if (Date.now() - lastRefreshOkAt < AUTH_RESUME_OK_WITHIN_MS) {
      return;
    }
    void bootstrapAuth();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      resume();
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', resume);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', resume);
  };
}
