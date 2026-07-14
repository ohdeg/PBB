import axios from 'axios';
import type { ApiErrorBody } from '../types/auth';

export function getErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data;
  if (data && typeof data === 'object' && 'message' in data) {
    const body = data as ApiErrorBody;
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  }

  return fallback;
}
