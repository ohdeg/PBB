import { create } from 'zustand';
import { parseAccessTokenPayload } from '../utils/jwt';

interface AuthState {
  accessToken: string | null;
  nickname: string | null;
  email: string | null;
  setAccessToken: (token: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  nickname: null,
  email: null,
  setAccessToken: (token) => {
    if (!token) {
      set({ accessToken: null, nickname: null, email: null });
      return;
    }

    const payload = parseAccessTokenPayload(token);
    set({
      accessToken: token,
      nickname: payload?.nickname ?? null,
      email: payload?.sub ?? null,
    });
  },
  clearAuth: () =>
    set({ accessToken: null, nickname: null, email: null }),
}));
