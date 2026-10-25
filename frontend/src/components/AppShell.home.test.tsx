// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { HomePage } from '../pages/HomePage';
import { useAuthStore } from '../stores/authStore';

// The websocket host is unrelated to home navigation and would initiate service connections.
vi.mock('./veveno/VevenoStockCheckHost', () => ({ VevenoStockCheckHost: () => null }));
beforeEach(() => useAuthStore.getState().clearAuth());
afterEach(cleanup);

function openShell(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<AppShell />}>
    <Route path="/" element={<HomePage />} />
    <Route path="/hobbies/veveno" element={<h1>가게 소개</h1>} />
  </Route></Routes></MemoryRouter>);
}

it('opens a permission-filtered drawer and closes with Escape, returning focus', () => {
  openShell();
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
  const drawer = screen.getByRole('navigation', { name: '앱 목록' });
  const links = within(drawer).getAllByRole('link');
  expect(links).toHaveLength(3);
  links[0].focus();
  fireEvent.keyDown(links[0], { key: 'Escape' });
  expect(screen.queryByRole('navigation', { name: '앱 목록' })).toBeNull();
  expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveFocus();
});

it('closes the drawer on navigation and preserves non-home app tabs', async () => {
  openShell();
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
  fireEvent.click(within(screen.getByRole('navigation', { name: '앱 목록' })).getByRole('link', { name: /Veveno/ }));
  await screen.findByRole('heading', { name: '가게 소개' });
  expect(screen.queryByRole('navigation', { name: '앱 목록' })).toBeNull();
  expect(within(screen.getByRole('navigation', { name: '취미 탭' })).getByRole('link', { name: 'Veveno' })).toBeInTheDocument();
});

it('links directly to the focusable app section and main content', () => {
  openShell();
  expect(screen.getByRole('link', { name: '앱', exact: true })).toHaveAttribute('href', '#apps');
  expect(screen.getByRole('link', { name: '본문으로 바로가기' })).toHaveAttribute('href', '#home-main');
  expect(screen.getByRole('region', { name: '전체 앱' })).toHaveAttribute('tabindex', '-1');
});
