// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../../api/axios', () => ({ apiClient: { post: boundary.post } }));
import { useAuthStore } from '../../../stores/authStore';
import { downloadCloudScore } from './temporiCloudApi';

const fetchOriginal = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ userId: 'test-account' });
  boundary.post.mockResolvedValue({ data: { url: 'https://example.invalid/original?signature=test-only', expiresAt: '' } });
  vi.stubGlobal('fetch', fetchOriginal);
  fetchOriginal.mockResolvedValue({ ok: true, blob: async () => new Blob(['abc']) });
});
afterEach(() => { vi.unstubAllGlobals(); useAuthStore.setState({ userId: null }); });

it('distinguishes a signed address failure from original fetch and body failures', async () => {
  boundary.post.mockRejectedValueOnce({ response: { status: 503 }, message: 'private API error' });
  await expect(downloadCloudScore('remote-a')).rejects.toMatchObject({ diagnosticCode: 'TD-DOWNLOAD-URL-HTTP503' });
  expect(fetchOriginal).not.toHaveBeenCalled();
  fetchOriginal.mockRejectedValueOnce(new TypeError('private signed URL'));
  await expect(downloadCloudScore('remote-a')).rejects.toMatchObject({ diagnosticCode: 'TD-OBJECT-FETCH-NETWORK' });
  fetchOriginal.mockResolvedValueOnce({ ok: true, blob: async () => { throw new TypeError('private body error'); } });
  await expect(downloadCloudScore('remote-a')).rejects.toMatchObject({ diagnosticCode: 'TD-OBJECT-BODY-UNKNOWN' });
});

it.each([401, 403])('refreshes the signed URL once after HTTP%d and then returns original bytes', async (status) => {
  fetchOriginal.mockResolvedValueOnce({ ok: false, status });
  expect((await downloadCloudScore('remote-a')).size).toBe(3);
  expect(boundary.post).toHaveBeenCalledTimes(2);
  expect(fetchOriginal).toHaveBeenCalledTimes(2);
});

it('reports the second HTTP failure without retrying a third time', async () => {
  fetchOriginal.mockResolvedValue({ ok: false, status: 403 });
  await expect(downloadCloudScore('remote-a')).rejects.toMatchObject({ diagnosticCode: 'TD-OBJECT-FETCH-HTTP403' });
  expect(boundary.post).toHaveBeenCalledTimes(2);
});

it('retains cancellation when an account changes while an original fetch fails', async () => {
  let fail!: (error: Error) => void;
  fetchOriginal.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const pending = downloadCloudScore('remote-a');
  await vi.waitFor(() => expect(fetchOriginal).toHaveBeenCalled());
  useAuthStore.setState({ userId: 'next-account' });
  fail(new TypeError('private signed URL'));
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
