// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { lazy, Suspense, type ComponentType } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { TemporiDockSlot, TemporiViewerFrame } from './TemporiViewerDock';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function openScore(Score: ComponentType) {
  return render(<MemoryRouter initialEntries={['/hobbies/tempori/a']}>
    <Suspense fallback={<p>Outer route loading</p>}>
      <Routes>
        <Route path="/hobbies/tempori/:id" element={<TemporiViewerFrame><Score /></TemporiViewerFrame>} />
        <Route path="/hobbies/tempori/library" element={<h1>보관함</h1>} />
      </Routes>
    </Suspense>
  </MemoryRouter>);
}

it('retains a real library exit while the score chunk is pending', async () => {
  const Score = lazy(() => new Promise<{ default: ComponentType }>(() => {}));
  openScore(Score);
  expect(screen.queryByText('Outer route loading')).toBeNull();
  expect(screen.getByRole('link', { name: '보관함으로' })).toHaveAttribute('href', '/hobbies/tempori/library');
  fireEvent.click(screen.getByRole('link', { name: '보관함으로' }));
  await screen.findByRole('heading', { name: '보관함' });
  expect(document.documentElement.classList.contains('tempori-score-mode')).toBe(false);
});

it('retains the exit after a rejected score chunk', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let rejectChunk!: (reason: Error) => void;
  const Score = lazy(() => new Promise<{ default: ComponentType }>((_resolve, reject) => { rejectChunk = reject; }));
  openScore(Score);
  await act(async () => rejectChunk(new Error('chunk unavailable')));
  expect(screen.getByRole('link', { name: '보관함으로' })).toBeVisible();
  expect(screen.getByRole('button', { name: '새로고침' })).toBeVisible();
});

it('retains the exit after an unexpected score rendering exception', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenScore(): never { throw new Error('renderer failed'); }
  openScore(BrokenScore);
  expect(screen.getByRole('link', { name: '보관함으로' })).toBeVisible();
  expect(screen.getByRole('button', { name: '새로고침' })).toBeVisible();
});

it('puts playback beside the exit and annotation and beat controls in separate dock rows', () => {
  function Controls() {
    return <>
      <TemporiDockSlot slot="playback"><button>재생</button></TemporiDockSlot>
      <TemporiDockSlot slot="annotation"><button>펜</button></TemporiDockSlot>
      <TemporiDockSlot slot="beat"><p role="status">1 / 4</p></TemporiDockSlot>
    </>;
  }
  openScore(Controls);
  expect(screen.getByRole('button', { name: '재생' }).closest('.tempori-viewer-dock-row')).toContainElement(screen.getByRole('link', { name: '보관함으로' }));
  expect(screen.getByRole('button', { name: '펜' }).closest('.tempori-viewer-dock-annotation')).not.toBeNull();
  expect(screen.getByRole('status').closest('.tempori-viewer-dock-beat')).not.toBeNull();
});
