import { create } from 'zustand';
import { parseAccessTokenPayload, parseUserClass } from '../utils/jwt';
import type { ParsedUserClass } from '../utils/jwt';

interface AuthState {
  accessToken: string | null;
  /** Changes on account transitions or explicit logout; access-token rotation keeps it stable. */
  sessionRevision: number;
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
  sessionRevision: 0,
  nickname: null,
  email: null,
  userId: null,
  userClass: null,
  suppressLoginRedirect: false,
  setAccessToken: (token) => {
    if (!token) {
      set((state) => ({
        sessionRevision: state.sessionRevision + 1,
        accessToken: null,
        nickname: null,
        email: null,
        userId: null,
        userClass: null,
      }));
      return;
    }

    const payload = parseAccessTokenPayload(token);
    set((state) => ({
      sessionRevision: state.sessionRevision + ((payload?.userId ?? null) !== state.userId ? 1 : 0),
      accessToken: token,
      nickname: payload?.nickname ?? null,
      email: payload?.sub ?? null,
      userId: payload?.userId ?? null,
      userClass: parseUserClass(payload?.userClass),
      suppressLoginRedirect: false,
    }));
  },
  setSuppressLoginRedirect: (value) => set({ suppressLoginRedirect: value }),
  clearAuth: () =>
    set((state) => ({
      sessionRevision: state.sessionRevision + 1,
      accessToken: null,
      nickname: null,
      email: null,
      userId: null,
      userClass: null,
    })),
}));
