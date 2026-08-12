import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info' | 'loading';

export interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, kind?: ToastKind, durationMs?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let toastSeq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, kind = 'info', durationMs = kind === 'loading' ? 0 : 3200) => {
    const id = `toast-${Date.now()}-${toastSeq++}`;
    const item: ToastItem = { id, message, kind, durationMs };
    set((state) => ({ toasts: [...state.toasts.slice(-4), item] }));
    if (durationMs > 0) {
      window.setTimeout(() => {
        get().dismiss(id);
      }, durationMs);
    }
    return id;
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clear: () => set({ toasts: [] }),
}));

export function toast(
  message: string,
  kind: ToastKind = 'info',
  durationMs?: number,
): string {
  return useToastStore.getState().show(message, kind, durationMs);
}
