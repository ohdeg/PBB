// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';
import * as catalog from '../data/hobbies';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { recordRecentApp } from '../features/home/homeRecentStorage';

beforeEach(() => { localStorage.clear(); useAuthStore.getState().clearAuth(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const openHome = () => render(<MemoryRouter><HomePage /></MemoryRouter>);

it('shows public execution and introduction links without a duplicate login CTA', () => {
  openHome();
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(screen.getByRole('link', { name: 'Veveno 열기' })).toHaveAttribute('href', '/hobbies/veveno/hub');
  expect(screen.getByRole('link', { name: 'Veveno 소개' })).toHaveAttribute('href', '/hobbies/veveno');
  expect(screen.queryByRole('link', { name: '로그인' })).toBeNull();
  expect(screen.queryByRole('region', { name: '최근 사용' })).toBeNull();
});

it('never shows a previous account or revoked app in recent shortcuts', () => {
  recordRecentApp('A', '6pick');
  recordRecentApp('B', 'sranko');
  useAuthStore.setState({ accessToken: 'test', userId: 'A', userClass: 'dev' });
  openHome();
  expect(screen.getAllByRole('article')).toHaveLength(5);
  expect(within(screen.getByRole('region', { name: '최근 사용' })).getByRole('link', { name: /6PICK/ })).toBeInTheDocument();
  act(() => useAuthStore.setState({ userId: 'B', userClass: null }));
  expect(screen.getAllByRole('article')).toHaveLength(3);
  const recent = within(screen.getByRole('region', { name: '최근 사용' }));
  expect(recent.getByRole('link', { name: /Sranko/ })).toBeInTheDocument();
  expect(recent.queryByRole('link', { name: /6PICK/ })).toBeNull();
  act(() => useAuthStore.setState({ userId: 'A' }));
  expect(screen.queryByRole('region', { name: '최근 사용' })).toBeNull();
  act(() => useAuthStore.getState().clearAuth());
  expect(screen.queryByRole('region', { name: '최근 사용' })).toBeNull();
});

it.each([6, 7])('renders all %i visible apps without a fixed featured partition', (count) => {
  const base = catalog.getNavHobbies(true);
  const apps = [...base, ...Array.from({ length: count - base.length }, (_, i) => ({
    ...base[0], id: `future-${i}`, name: `Future ${i}`, path: `/future/${i}`, startPath: `/future/${i}/open`,
  }))];
  vi.spyOn(catalog, 'getNavHobbies').mockReturnValue(apps);
  openHome();
  expect(screen.getAllByRole('article')).toHaveLength(count);
  expect(screen.getByRole('link', { name: 'Future 0 열기' })).toHaveAttribute('href', '/future/0/open');
});

it('handles an empty catalog without broken app links', () => {
  vi.spyOn(catalog, 'getNavHobbies').mockReturnValue([]);
  openHome();
  expect(screen.getByText('사용 가능한 앱이 없습니다.')).toBeInTheDocument();
  expect(screen.queryAllByRole('article')).toHaveLength(0);
});

it('falls back after image failure and retries the alternate theme image', () => {
  useThemeStore.setState({ theme: 'light' });
  const { container } = openHome();
  const firstCard = container.querySelector('article')!;
  const firstImage = firstCard.querySelector('img')!;
  fireEvent.error(firstImage);
  expect(firstCard.querySelector('img')).toBeNull();
  expect(within(screen.getAllByRole('article')[0]).getByText('V')).toBeInTheDocument();
  act(() => useThemeStore.setState({ theme: 'dark' }));
  expect(firstCard.querySelector('img')).toHaveAttribute('src', expect.stringContaining('-dark.png'));
});
