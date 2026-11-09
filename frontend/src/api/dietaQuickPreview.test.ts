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
