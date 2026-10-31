export type TemporiViewMode = 'wrapped' | 'horizontal';
export const VIEW_MODE_STORAGE_KEY = 'tempori:view-mode';

export interface DeviceSignals {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

/** Width is intentionally absent: resizing, split view and rotation are not device changes. */
export function getDeviceViewMode(device: DeviceSignals): TemporiViewMode {
  const { userAgent, platform, maxTouchPoints = 0 } = device;
  if (/iPad/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'wrapped';
  return /iPhone|iPod/i.test(userAgent) || (/Android/i.test(userAgent) && /Mobile/i.test(userAgent))
    ? 'horizontal' : 'wrapped';
}

export function getInitialViewMode(
  storage?: Pick<Storage, 'getItem'>,
  device: DeviceSignals = typeof navigator === 'undefined' ? { userAgent: '' } : navigator,
): TemporiViewMode {
  try {
    const source = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
    const saved = source?.getItem(VIEW_MODE_STORAGE_KEY);
    if (saved === 'horizontal' || saved === 'wrapped') return saved;
  } catch { /* A denied preference read must not prevent opening the score. */ }
  return getDeviceViewMode(device);
}

export function saveViewMode(mode: TemporiViewMode, storage?: Pick<Storage, 'setItem'>): boolean {
  try { (storage ?? localStorage).setItem(VIEW_MODE_STORAGE_KEY, mode); return true; } catch { return false; }
}

export function getHorizontalScrollTarget(measureLeft: number, viewportWidth: number, contentWidth: number): number {
  return Math.max(0, Math.min(Math.max(0, contentWidth - viewportWidth), measureLeft - viewportWidth / 3));
}
