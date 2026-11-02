import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAppStatusStore } from '../stores/appStatusStore';
import { useAuthStore } from '../stores/authStore';
import { parseAccessTokenPayload } from '../utils/jwt';
import type { ApiErrorBody, RefreshResponse } from '../types/auth';
import {
  clearVevenoPosToken,
  getVevenoPosToken,
} from '../features/veveno/pos/session';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _credentialKind?: 'account' | 'pos';
  _credentialToken?: string | null;
  _accountId?: string | null;
  _sessionRevision?: number;
}
const isTemporiRequest = (url = '') => /(?:^|\/)api\/v1\/tempori(?:[/?]|$)/.test(url);
const isRefreshRequest = (url = '') => /(?:^|\/)api\/v1\/auth\/refresh(?:[/?]|$)/.test(url);

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const request = config as RetryConfig;
  const state = useAuthStore.getState();
  const posToken = getVevenoPosToken();
  // A retry can wait in another async interceptor after the response guard ran.
  // Preserve its initiating principal through the final credential selection.
  if (request._sessionRevision !== undefined) {
    const changed = request._credentialKind === 'pos'
      ? posToken !== request._credentialToken
      : state.sessionRevision !== request._sessionRevision || state.userId !== request._accountId;
    if (changed) throw new axios.CanceledError('Authentication session changed', config);
  }
  const usesPos = !!posToken && !isTemporiRequest(config.url) && !isRefreshRequest(config.url);
  const token = usesPos ? posToken : state.accessToken;
  request._credentialKind = usesPos ? 'pos' : 'account';
  request._credentialToken = token;
  request._accountId = state.userId;
  request._sessionRevision = state.sessionRevision;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else config.headers.delete('Authorization');
  // Default JSON Content-Type breaks multipart boundaries — let the runtime set it.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) config.headers.delete('Content-Type');
  return config;
});

let refreshPromise: Promise<string | null> | null = null;
let refreshRevision = -1;
let refreshTokenAtStart: string | null = null;
let lastRefreshOkAt = 0;
const AUTH_RESUME_OK_WITHIN_MS = 10_000;

/** RT가 거절된 경우만 세션을 버린다. 네트워크·5xx는 쿠키가 살아 있을 수 있다. */
export function shouldClearAuthOnRefreshFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

async function refreshAccessToken(): Promise<string | null> {
  const captured = useAuthStore.getState();
  if (refreshPromise && refreshRevision === captured.sessionRevision && refreshTokenAtStart === captured.accessToken) return refreshPromise;
  const stillCurrent = () => {
    const state = useAuthStore.getState();
    return state.sessionRevision === captured.sessionRevision && state.userId === captured.userId && state.accessToken === captured.accessToken;
  };
  const controller = new AbortController();
  const unsubscribe = useAuthStore.subscribe(() => { if (!stillCurrent()) controller.abort(); });
  refreshRevision = captured.sessionRevision; refreshTokenAtStart = captured.accessToken;
  const pending = apiClient.post<RefreshResponse>('/api/v1/auth/refresh', undefined, { signal: controller.signal })
    .then((response) => {
      if (!stillCurrent()) return null;
      const token = response.data.accessToken;
      const owner = parseAccessTokenPayload(token)?.userId;
      // A cookie changed by another tab cannot retarget an outstanding account operation.
      if (!owner || (captured.userId && captured.userId !== owner)) {
        unsubscribe(); useAuthStore.getState().clearAuth(); return null;
      }
      unsubscribe(); useAuthStore.getState().setAccessToken(token); lastRefreshOkAt = Date.now(); return token;
    })
    .catch((error: unknown) => {
      if (stillCurrent() && shouldClearAuthOnRefreshFailure(error)) { unsubscribe(); useAuthStore.getState().clearAuth(); }
      return null;
    })
    .finally(() => { unsubscribe(); if (refreshPromise === pending) refreshPromise = null; });
  refreshPromise = pending;
  return pending;
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
      if (!url.includes('/sranko/') && !isTemporiRequest(url)) {
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

    // Refresh errors are handled only by the generation-guarded refresh owner.
    if (isRefreshRequest(originalRequest.url)) return Promise.reject(error);
    if (originalRequest._credentialKind === 'pos') {
      if (getVevenoPosToken() === originalRequest._credentialToken) clearVevenoPosToken();
      return Promise.reject(error);
    }
    const sameSession = () => {
      const state = useAuthStore.getState();
      return state.sessionRevision === originalRequest._sessionRevision && state.userId === originalRequest._accountId;
    };
    if (!sameSession()) return Promise.reject(error);
    originalRequest._retry = true;
    const newToken = await refreshAccessToken();
    if (!newToken || !sameSession()) return Promise.reject(error);

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
