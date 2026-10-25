// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TemporiPage } from './TemporiPage';
import { fetchTemporiDetail } from '../features/tempori/services/temporiRepository';
vi.mock('../features/tempori/services/temporiRepository', () => ({ fetchTemporiDetail: vi.fn() }));
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
