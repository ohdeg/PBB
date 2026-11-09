import { expect, it, vi } from 'vitest';
import { dietaApi } from './dietaApi';
import { apiClient } from './axios';

vi.mock('./axios', () => ({ apiClient: { get: vi.fn() } }));
it.each([401,404,500,502])('retains HTTP %i on a failed preview',async status=>{
  vi.mocked(apiClient.get).mockRejectedValueOnce({isAxiosError:true,response:{status}});
  await expect(dietaApi.quickPreview('2026-11-09')).rejects.toThrow(`HTTP ${status}`);
});
it('distinguishes a missing response from a 200 HTML page',async()=>{
  vi.mocked(apiClient.get).mockRejectedValueOnce({isAxiosError:true});
  await expect(dietaApi.quickPreview('2026-11-09')).rejects.toThrow('응답을 받지 못했어요');
  vi.mocked(apiClient.get).mockResolvedValueOnce({status:200,data:'<html></html>'});
  await expect(dietaApi.quickPreview('2026-11-09')).rejects.toThrow('응답 형식을 확인할 수 없어요 (HTTP 200)');
});

it.each([
  ['식사 큐를 읽을 수 없습니다.', '식사 큐를 읽을 수 없습니다.'],
  ['서버 내부 오류가 발생했습니다.', '서버 내부 오류가 발생했습니다.'],
  ['unexpected internal details', '잠시 후 다시 시도해 주세요.'],
])('shows only recognized server messages for HTTP 500 (%s)', async (message, expected) => {
  vi.mocked(apiClient.get).mockRejectedValueOnce({
    isAxiosError: true, response: { status: 500, data: { message } },
  });
  await expect(dietaApi.quickPreview('2026-11-09')).rejects.toThrow(
    new Error(`간편 기록 조회 실패 (HTTP 500). ${expected}`),
  );
});
