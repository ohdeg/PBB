import { create } from 'zustand';
import { parseAccessTokenPayload, parseUserClass } from '../utils/jwt';
import type { ParsedUserClass } from '../utils/jwt';

interface AuthState {
  accessToken: string | null;
  nickname: string | null;
  email: string | null;
  userId: string | null;
  userClass: ParsedUserClass | null;
  setAccessToken: (token: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  nickname: null,
  email: null,
  userId: null,
  userClass: null,
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
    });
  },
  clearAuth: () =>
    set({
      accessToken: null,
      nickname: null,
      email: null,
      userId: null,
      userClass: null,
    }),
}));
