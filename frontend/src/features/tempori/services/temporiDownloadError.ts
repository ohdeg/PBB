export type DownloadStage = 'METADATA' | 'CACHE-READ' | 'CACHE-HASH' | 'DOWNLOAD-URL' | 'OBJECT-FETCH' | 'OBJECT-BODY' | 'DOWNLOAD-HASH' | 'INTEGRITY' | 'CACHE-WRITE';
type DownloadReason = 'QUOTA' | 'SECURITY' | 'NETWORK' | 'UNSUPPORTED' | 'UNKNOWN' | 'SIZE' | 'HASH' | `HTTP${number}`;

/** Carries fixed labels only: never retain a signed URL, response, account or cause. */
export class TemporiDownloadError extends Error {
  readonly diagnosticCode: string;
  constructor(stage: DownloadStage, reason: DownloadReason) {
    super(reason === 'QUOTA' ? '저장공간이 부족해 다운로드에 실패했습니다' : '오류가 발생하여 다운로드에 실패하였습니다');
    this.name = 'TemporiDownloadError';
    this.diagnosticCode = `TD-${stage}-${reason}`;
  }
}

export function downloadError(stage: DownloadStage, failure: unknown): Error {
  if (failure instanceof TemporiDownloadError || failure instanceof DOMException && failure.name === 'AbortError') return failure;
  const value = failure as { name?: unknown; code?: unknown; response?: { status?: unknown } } | null;
  const status = value?.response?.status;
  let reason: DownloadReason = 'UNKNOWN';
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599) reason = `HTTP${status}`;
  else if (value?.name === 'QuotaExceededError') reason = 'QUOTA';
  else if (value?.name === 'SecurityError') reason = 'SECURITY';
  else if (value?.name === 'NotSupportedError') reason = 'UNSUPPORTED';
  else if (value?.code === 'ERR_NETWORK' || value?.name === 'NetworkError' || value?.name === 'TypeError' && stage === 'OBJECT-FETCH') reason = 'NETWORK';
  return new TemporiDownloadError(stage, reason);
}

export async function downloadStep<T>(stage: DownloadStage, operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (failure) { throw downloadError(stage, failure); }
}
