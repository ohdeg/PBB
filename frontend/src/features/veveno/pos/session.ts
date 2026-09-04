const DEVICE_KEY = 'veveno:pos:device';
const TOKEN_KEY = 'veveno:pos:token';
const STORE_KEY = 'veveno:pos:storeId';

export function isVevenoPosKioskPath(pathname: string): boolean {
  return pathname.startsWith('/hobbies/veveno/pos');
}

export function isVevenoPosKiosk(): boolean {
  return typeof window !== 'undefined'
    && isVevenoPosKioskPath(window.location.pathname);
}

export function getOrCreatePosDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
    return existing;
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

export function getVevenoPosToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  return token && token.length > 0 ? token : null;
}

export function getVevenoPosStoreId(): string | null {
  const storeId = localStorage.getItem(STORE_KEY);
  return storeId && storeId.length > 0 ? storeId : null;
}

export function setVevenoPosToken(token: string, storeId?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (storeId) {
    localStorage.setItem(STORE_KEY, storeId);
  }
}

export function clearVevenoPosToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STORE_KEY);
}

