import axios from 'axios';
import type { ApiErrorBody } from '../../../types/auth';
import { VEVENO_KO_MESSAGE_TO_CODE } from './messages';
import type { TranslateFn } from './translate';

function readErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  if (!axios.isAxiosError(error)) {
    return undefined;
  }
  const data = error.response?.data;
  if (data && typeof data === 'object' && 'code' in data) {
    const body = data as ApiErrorBody;
    if (typeof body.code === 'string' && body.code.length > 0) {
      return body.code;
    }
  }
  return undefined;
}

function readRawMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'message' in data) {
      const body = data as ApiErrorBody;
      if (typeof body.message === 'string' && body.message.length > 0) {
        return body.message;
      }
    }
    return '';
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return '';
}

export function getVevenoErrorMessage(
  error: unknown,
  fallback: string,
  t: TranslateFn,
): string {
  const code = readErrorCode(error);
  if (code) {
    const translated = t(`errors.${code}`);
    if (translated !== `errors.${code}`) {
      return translated;
    }
  }
  const raw = readRawMessage(error);
  if (raw) {
    const mapped = VEVENO_KO_MESSAGE_TO_CODE[raw];
    if (mapped) {
      const translated = t(`errors.${mapped}`);
      if (translated !== `errors.${mapped}`) {
        return translated;
      }
    }
    return raw;
  }
  return fallback;
}
