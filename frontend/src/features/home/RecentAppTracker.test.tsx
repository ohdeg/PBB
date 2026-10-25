// @vitest-environment jsdom
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { StrictMode } from 'react';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import { RecentAppTracker } from './RecentAppTracker';
import { readRecentAppIds } from './homeRecentStorage';

beforeEach(() => { localStorage.clear(); useAuthStore.getState().clearAuth(); });
afterEach(cleanup);

it('waits for identity, tracks deep links once, and isolates account changes', () => {
  render(<StrictMode><MemoryRouter initialEntries={['/hobbies/veveno/stores/42']}>
    <RecentAppTracker />
    <Link to="/hobbies/tempori/library">악보 이동</Link>
  </MemoryRouter></StrictMode>);
  expect(localStorage.length).toBe(0);
  act(() => useAuthStore.setState({ accessToken: 'test', userId: 'A' }));
  expect(readRecentAppIds('A')).toEqual(['veveno']);
  fireEvent.click(screen.getByRole('link'));
  expect(readRecentAppIds('A')).toEqual(['tempori', 'veveno']);
  act(() => useAuthStore.setState({ userId: 'B' }));
  expect(readRecentAppIds('B')).toEqual(['tempori']);
  expect(readRecentAppIds('A')).toEqual(['tempori', 'veveno']);
});

it('does not record a denied execution route or a missing stable user ID', () => {
  useAuthStore.setState({ accessToken: 'test', userId: 'A', userClass: null });
  render(<MemoryRouter initialEntries={['/hobbies/6pick/play']}><RecentAppTracker /></MemoryRouter>);
  expect(readRecentAppIds('A')).toEqual([]);
  act(() => useAuthStore.setState({ userId: null, userClass: 'dev' }));
  expect(localStorage.length).toBe(0);
});
