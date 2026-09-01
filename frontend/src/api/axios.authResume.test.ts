import axios, { type AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { shouldClearAuthOnRefreshFailure } from './axios';

function axiosError(status?: number): AxiosError {
  const error = new axios.AxiosError('refresh failed');
  if (status !== undefined) {
    error.response = { status, data: {}, headers: {}, config: {}, statusText: '' };
  }
  return error;
}

describe('shouldClearAuthOnRefreshFailure', () => {
  it('clears only on HTTP 401', () => {
    expect(shouldClearAuthOnRefreshFailure(axiosError(401))).toBe(true);
  });

  it('keeps the session on network errors and 5xx', () => {
    expect(shouldClearAuthOnRefreshFailure(axiosError())).toBe(false);
    expect(shouldClearAuthOnRefreshFailure(axiosError(503))).toBe(false);
    expect(shouldClearAuthOnRefreshFailure(axiosError(500))).toBe(false);
    expect(shouldClearAuthOnRefreshFailure(new Error('offline'))).toBe(false);
  });
});
