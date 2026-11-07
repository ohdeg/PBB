// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../stores/authStore';
import { LoginPage } from './LoginPage';

vi.mock('../api/authApi', () => ({ authApi: { login: vi.fn() } }));

beforeEach(() => {
  useAuthStore.getState().clearAuth();
  vi.mocked(authApi.login).mockReset();
});

function openLogin(from?: string, startAfterLogin = false) {
  const entries = ['/original', { pathname: '/login', state: { from } }];
  if (startAfterLogin) entries.push('/later');
  const router = createMemoryRouter([
    { path: '/login', element: <LoginPage /> },
    { path: '*', element: <p>목적지</p> },
  ], { initialEntries: entries });
  render(<RouterProvider router={router} />);
  return router;
}

it('allows retry after failure and replaces the login entry on success', async () => {
  const router = openLogin('/profile');
  vi.mocked(authApi.login).mockRejectedValueOnce(new Error('invalid'));
  vi.mocked(authApi.login).mockImplementationOnce(async () => ({
    data: { accessToken: 'test' },
  } as Awaited<ReturnType<typeof authApi.login>>));
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'demo@example.test' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'test' } });
  const submit = screen.getByRole('button', { name: '로그인' });
  fireEvent.click(submit);
  await waitFor(() => expect(submit).toBeEnabled());
  expect(router.state.location.pathname).toBe('/login');
  fireEvent.click(submit);
  await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  await act(() => router.navigate(-1));
  expect(router.state.location.pathname).toBe('/original');
});

it('redirects an authenticated back navigation to an older login entry', async () => {
  useAuthStore.getState().setAccessToken('test');
  const router = openLogin('/profile', true);
  await act(() => router.navigate(-1));
  expect(router.state.location.pathname).toBe('/profile');
  expect(screen.queryByLabelText('이메일')).toBeNull();
});

it.each([
  [undefined, '/'], ['/profile?q=1#tab', '/profile?q=1#tab'],
  ['https://example.test', '/'], ['//example.test', '/'], ['/\\example.test', '/'],
  ['/x/..//example.test', '/'], ['/LOGIN/?next=x#top', '/'], ['/%6Cogin', '/'],
])('routes authenticated entry with from=%s to %s', (from, expected) => {
  useAuthStore.getState().setAccessToken('test');
  const router = openLogin(from);
  const { pathname, search, hash } = router.state.location;
  expect(pathname + search + hash).toBe(expected);
  expect(screen.queryByLabelText('이메일')).toBeNull();
});
