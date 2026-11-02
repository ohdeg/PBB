// @vitest-environment jsdom
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const pos = vi.hoisted(() => ({ token: null as string | null, clear: vi.fn() }));
vi.mock('../features/veveno/pos/session', () => ({ getVevenoPosToken: () => pos.token, clearVevenoPosToken: () => { pos.clear(); pos.token = null; } }));
import { apiClient, bootstrapAuth } from './axios';
import { useAuthStore } from '../stores/authStore';
const originalAdapter = apiClient.defaults.adapter;
const token = (id: string, nonce = 'first') => `header.${btoa(JSON.stringify({ sub: `${id}@example.test`, nickname: id, userId: id, type: 'access', nonce }))}.signature`;
const response = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const unauthorized = (config: InternalAxiosRequestConfig) => new axios.AxiosError('unauthorized', 'ERR_BAD_REQUEST', config, undefined, { config, data: {}, status: 401, statusText: 'Unauthorized', headers: {} });
beforeEach(() => { pos.token = null; pos.clear.mockClear(); useAuthStore.getState().clearAuth(); });
afterEach(() => { apiClient.defaults.adapter = originalAdapter; useAuthStore.getState().clearAuth(); });
describe('account refresh and POS isolation', () => {
  it('refreshes a Tempori account401 without clearing an unrelated POS session', async () => {
    const old = token('A'), fresh = token('A', 'fresh'); useAuthStore.getState().setAccessToken(old); pos.token = 'pos-token';
    const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.url!);
      if (config.url === '/api/v1/auth/refresh') return response(config, { accessToken: fresh });
      if (config.headers.Authorization === `Bearer ${old}`) throw unauthorized(config);
      expect(config.headers.Authorization).toBe(`Bearer ${fresh}`); return response(config, { items: [] });
    };
    await expect(apiClient.get('/api/v1/tempori')).resolves.toMatchObject({ status: 200 });
    expect(requests).toEqual(['/api/v1/tempori', '/api/v1/auth/refresh', '/api/v1/tempori']); expect(pos.clear).not.toHaveBeenCalled(); expect(pos.token).toBe('pos-token');
  });
  it('still clears the POS token when the failed request actually used it', async () => {
    pos.token = 'pos-token'; apiClient.defaults.adapter = async (config) => { expect(config.headers.Authorization).toBe('Bearer pos-token'); throw unauthorized(config); };
    await expect(apiClient.get('/api/v1/veveno/stores/mine')).rejects.toBeInstanceOf(axios.AxiosError); expect(pos.clear).toHaveBeenCalledOnce();
  });
  for (const outcome of ['success', '401'] as const) it(`discards a late refresh ${outcome} after A switches to B`, async () => {
    useAuthStore.getState().setAccessToken(token('A')); let finish!: () => void;
    apiClient.defaults.adapter = (config) => new Promise((resolve, reject) => { finish = () => outcome === 'success' ? resolve(response(config, { accessToken: token('A', 'old-refresh') })) : reject(unauthorized(config)); });
    const pending = bootstrapAuth(); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const newer = token('B'); useAuthStore.getState().setAccessToken(newer); finish();
    expect(await pending).toBe(false); expect(useAuthStore.getState().accessToken).toBe(newer); expect(useAuthStore.getState().userId).toBe('B');
  });
  it('discards a bootstrap response when login finishes first, and an A→B→A response', async () => {
    for (const start of [null, 'A']) {
      useAuthStore.getState().clearAuth(); if (start) useAuthStore.getState().setAccessToken(token(start));
      let finish!: () => void;
      apiClient.defaults.adapter = (config) => new Promise((resolve) => { finish = () => resolve(response(config, { accessToken: token('A', 'stale') })); });
      const pending = bootstrapAuth(); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      useAuthStore.getState().setAccessToken(token('B')); const newer = token('A', 'new-login'); useAuthStore.getState().setAccessToken(newer); finish();
      expect(await pending).toBe(false); expect(useAuthStore.getState().accessToken).toBe(newer);
    }
  });
  it('does not retry an old account request after switching accounts during refresh', async () => {
    useAuthStore.getState().setAccessToken(token('A')); let finish!: () => void; const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.url!); if (config.url !== '/api/v1/auth/refresh') throw unauthorized(config);
      return new Promise((resolve) => { finish = () => resolve(response(config, { accessToken: token('A', 'stale') })); });
    };
    const pending = apiClient.post('/api/v1/tempori', { original: 'A' }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function')); useAuthStore.getState().setAccessToken(token('B')); finish();
    expect(await pending).toBeInstanceOf(axios.AxiosError); expect(requests).toHaveLength(2); expect(useAuthStore.getState().userId).toBe('B');
  });
  it('does not restore a bootstrap session after an explicit logout while still anonymous', async () => {
    let finish!: () => void;
    apiClient.defaults.adapter = (config) => new Promise((resolve) => { finish = () => resolve(response(config, { accessToken: token('A') })); });
    const pending = bootstrapAuth(); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    useAuthStore.getState().clearAuth(); finish(); expect(await pending).toBe(false); expect(useAuthStore.getState().accessToken).toBeNull();
  });
  it('does not retarget an outstanding account operation when the refresh cookie belongs to another account', async () => {
    useAuthStore.getState().setAccessToken(token('A')); const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.url!); if (config.url !== '/api/v1/auth/refresh') throw unauthorized(config);
      return response(config, { accessToken: token('B') });
    };
    await expect(apiClient.post('/api/v1/tempori', { original: 'A' })).rejects.toBeInstanceOf(axios.AxiosError);
    expect(requests).toHaveLength(2); expect(useAuthStore.getState().accessToken).toBeNull();
  });
  it('rejects an old operation if account changes after refresh but before the retry request interceptor runs', async () => {
    useAuthStore.getState().setAccessToken(token('A')); let release!: () => void; const dispatches: string[] = [];
    const interceptor = apiClient.interceptors.request.use(async (config) => {
      if ((config as InternalAxiosRequestConfig & { _retry?: boolean })._retry) await new Promise<void>((resolve) => { release = resolve; });
      return config;
    });
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/refresh') return response(config, { accessToken: token('A', 'fresh') });
      dispatches.push(String(config.headers.Authorization));
      if (dispatches.length === 1) throw unauthorized(config);
      return response(config, { changed: true });
    };
    try {
      const pending = apiClient.post('/api/v1/lotto/picks', { original: 'A' }).catch((error: unknown) => error);
      await vi.waitFor(() => expect(release).toBeTypeOf('function')); useAuthStore.getState().setAccessToken(token('B')); release();
      expect(await pending).toBeInstanceOf(axios.CanceledError); expect(dispatches).toHaveLength(1);
    } finally { apiClient.interceptors.request.eject(interceptor); }
  });
});
