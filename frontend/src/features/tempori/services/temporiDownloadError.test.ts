import { expect, it } from 'vitest';
import { downloadStep, TemporiDownloadError } from './temporiDownloadError';

it.each([
  [{ response: { status: 503 }, message: 'private-url?token=secret' }, 'TD-METADATA-HTTP503'],
  [new DOMException('private content', 'QuotaExceededError'), 'TD-METADATA-QUOTA'],
  [new DOMException('private content', 'SecurityError'), 'TD-METADATA-SECURITY'],
  [new DOMException('private content', 'NotSupportedError'), 'TD-METADATA-UNSUPPORTED'],
  [new TypeError('private-url?token=secret'), 'TD-METADATA-UNKNOWN'],
  [{ name: 'private-name', message: 'private-url?token=secret', response: { status: 799 } }, 'TD-METADATA-UNKNOWN'],
])('reports only a fixed diagnostic for failure %#', async (failure, expected) => {
  const error = await downloadStep('METADATA', async () => { throw failure; }).catch(error => error);
  expect(error).toBeInstanceOf(TemporiDownloadError);
  expect(error.diagnosticCode).toBe(expected);
  expect(error.message).toBe(expected.endsWith('QUOTA') ? '저장공간이 부족해 다운로드에 실패했습니다' : '오류가 발생하여 다운로드에 실패하였습니다');
  expect(JSON.stringify(error)).not.toMatch(/private|secret/);
  expect(error).not.toHaveProperty('cause');
});

it('preserves cancellation and the original safe diagnostic across nested boundaries', async () => {
  const abort = new DOMException('cancelled', 'AbortError');
  await expect(downloadStep('CACHE-WRITE', async () => { throw abort; })).rejects.toBe(abort);
  const error = new TemporiDownloadError('OBJECT-FETCH', 'NETWORK');
  await expect(downloadStep('CACHE-WRITE', async () => { throw error; })).rejects.toBe(error);
});
