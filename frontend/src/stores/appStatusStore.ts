import { create } from 'zustand';

interface AppStatusState {
  /** 서버 점검(HTTP 503) 감지 여부 — true면 전역 점검 화면을 띄운다 */
  maintenance: boolean;
  /** 점검 화면에 함께 노출할 안내 문구 (서버가 내려준 경우) */
  maintenanceMessage: string | null;
  setMaintenance: (on: boolean, message?: string | null) => void;
}

export const useAppStatusStore = create<AppStatusState>((set) => ({
  maintenance: false,
  maintenanceMessage: null,
  setMaintenance: (on, message = null) =>
    set({ maintenance: on, maintenanceMessage: on ? message : null }),
}));
