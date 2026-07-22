import { create } from 'zustand';
import { parseAccessTokenPayload, parseUserClass } from '../utils/jwt';
import type { ParsedUserClass } from '../utils/jwt';

interface AuthState {
  accessToken: string | null;
  nickname: string | null;
  email: string | null;
  userId: string | null;
  userClass: ParsedUserClass | null;
  /** 로그아웃 직후 가드가 /login으로 덮어쓰지 않게 함 */
  suppressLoginRedirect: boolean;
  setAccessToken: (token: string | null) => void;
  setSuppressLoginRedirect: (value: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  nickname: null,
  email: null,
  userId: null,
  userClass: null,
  suppressLoginRedirect: false,
  setAccessToken: (token) => {
    if (!token) {
      set({
        accessToken: null,
        nickname: null,
        email: null,
        userId: null,
        userClass: null,
      });
      return;
    }

    const payload = parseAccessTokenPayload(token);
    set({
      accessToken: token,
      nickname: payload?.nickname ?? null,
      email: payload?.sub ?? null,
      userId: payload?.userId ?? null,
      userClass: parseUserClass(payload?.userClass),
      suppressLoginRedirect: false,
    });
  },
  setSuppressLoginRedirect: (value) => set({ suppressLoginRedirect: value }),
  clearAuth: () =>
    set({
      accessToken: null,
      nickname: null,
      email: null,
      userId: null,
      userClass: null,
    }),
}));
