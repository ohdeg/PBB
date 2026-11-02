// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TemporiPage } from './TemporiPage';
import { fetchTemporiDetail, fetchTemporiContent } from '../features/tempori/services/temporiRepository';
vi.mock('../features/tempori/services/temporiRepository', () => ({ fetchTemporiDetail: vi.fn(), fetchTemporiContent: vi.fn(async () => new Blob(['score'])), temporiStateIdentity: vi.fn(async (id: string, originalHash: string) => ({ owner: 'guest', scoreId: id, originalHash, accountId: null })) }));
vi.mock('../features/tempori/services/temporiCloudApi', () => ({ scoreHash: async () => 'a'.repeat(64) }));
vi.mock('../features/tempori/services/TemporiStateProvider', () => ({ TemporiStateProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../features/tempori/pages/scoreSource', () => ({ sourceFromBlob: vi.fn(async (id: string) => ({ kind: 'musicxml', id, xml: '<score-partwise/>' })) }));
vi.mock('../features/tempori/Tempori', () => ({ Tempori: ({ temporiId }: { temporiId: string }) => <div>Tempori {temporiId}</div> }));
const detail = { id: 'a', title: 'No artist score', artist: null, createdAt: '', storagePath: '' };
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
function openPage() { render(<MemoryRouter initialEntries={['/tempori/a']}><Routes><Route path="/tempori/:id" element={<TemporiPage />} /></Routes></MemoryRouter>); }
it('omits the subtitle after loading a score with no artist', async () => {
  vi.mocked(fetchTemporiDetail).mockResolvedValue(detail); openPage();
  await screen.findByRole('heading', { name: 'No artist score' });
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText('악보를 불러오는 중입니다.')).toBeNull();
  expect(document.querySelector('.tempori-lead')).toBeNull();
});
it('announces a metadata error and retries the metadata request', async () => {
  vi.mocked(fetchTemporiDetail).mockRejectedValueOnce(new Error('metadata failed')).mockResolvedValueOnce(detail);
  openPage(); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await screen.findByText('Tempori a'); expect(fetchTemporiDetail).toHaveBeenCalledTimes(2);
});
it('does not render a stale metadata response after unmount', async () => {
  let resolve!: (value: typeof detail) => void;
  vi.mocked(fetchTemporiDetail).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const result = render(<MemoryRouter initialEntries={['/tempori/a']}><Routes><Route path="/tempori/:id" element={<TemporiPage />} /></Routes></MemoryRouter>);
  result.unmount(); await act(async () => resolve(detail));
  expect(screen.queryByText('Tempori a')).toBeNull();
});

it('does not mount the viewer before original caching completes, and a cache failure offers retry', async () => {
  vi.mocked(fetchTemporiDetail).mockResolvedValue(detail); let reject!: (error: Error) => void;
  vi.mocked(fetchTemporiContent).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  openPage(); await vi.waitFor(() => expect(fetchTemporiContent).toHaveBeenCalled()); expect(screen.queryByText('Tempori a')).toBeNull();
  await act(async () => reject(new Error('저장공간이 부족해 다운로드에 실패했습니다')));
  expect(screen.getByRole('alert')).toHaveTextContent('저장공간이 부족해 다운로드에 실패했습니다'); expect(screen.queryByText('Tempori a')).toBeNull();
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
});
it('shows the exact general download error without mounting a memory-only viewer', async () => {
  vi.mocked(fetchTemporiDetail).mockResolvedValue(detail); vi.mocked(fetchTemporiContent).mockRejectedValueOnce(new Error('오류가 발생하여 다운로드에 실패하였습니다'));
  openPage(); expect(await screen.findByRole('alert')).toHaveTextContent('오류가 발생하여 다운로드에 실패하였습니다'); expect(screen.queryByText('Tempori a')).toBeNull();
});
