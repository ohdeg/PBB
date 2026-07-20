const GUEST_USER_ID_KEY = 'tempoflow:guest-user-id';

function createGuestUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `guest-${crypto.randomUUID()}`;
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 기기별 로컬 악보 저장 키 */
export function getOrCreateGuestUserId(): string {
  const existing = localStorage.getItem(GUEST_USER_ID_KEY);
  if (existing) {
    return existing;
  }

  const guestId = createGuestUserId();
  localStorage.setItem(GUEST_USER_ID_KEY, guestId);
  return guestId;
}

export function getLocalLibraryUserId(): string {
  return getOrCreateGuestUserId();
}
