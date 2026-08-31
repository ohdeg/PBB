import { getOrCreatePosDeviceId } from './session';

const SESSION_KEY = 'veveno:pos:demo:session';
const DEVICES_KEY = 'veveno:pos:demo:devices';
const LEGACY_PENDING_KEY = 'veveno:pos:demo:pending';
const LEGACY_CLAIM_KEY = 'veveno:pos:demo:claim';

const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_DEVICES = 3;

export class DemoPosError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface DemoPosSession {
  deviceId: string;
  canEditStock: boolean;
  expiresAt: string;
}

interface DemoPosDevice {
  id: string;
  deviceId: string;
  createdAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function enrollDevice(deviceId: string, isOwner: boolean): void {
  const devices = readJson<DemoPosDevice[]>(DEVICES_KEY, []);
  if (devices.some((row) => row.deviceId === deviceId)) {
    return;
  }
  if (!isOwner) {
    throw new DemoPosError('POS_OWNER_ENROLL_ONLY', '처음 등록은 사장님만 할 수 있습니다.');
  }
  if (devices.length >= MAX_DEVICES) {
    throw new DemoPosError('POS_DEVICE_LIMIT', 'POS는 가게당 3대까지입니다.');
  }
  devices.push({
    id: crypto.randomUUID(),
    deviceId,
    createdAt: new Date().toISOString(),
  });
  writeJson(DEVICES_KEY, devices);
}

export function getDemoPosSession(): DemoPosSession | null {
  const session = readJson<DemoPosSession | null>(SESSION_KEY, null);
  if (!session) {
    return null;
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

export function startDemoPosSession(
  deviceId: string,
  canEditStock: boolean,
): DemoPosSession {
  const session: DemoPosSession = {
    deviceId,
    canEditStock,
    expiresAt: new Date(Date.now() + SESSION_MS).toISOString(),
  };
  writeJson(SESSION_KEY, session);
  return session;
}

export function switchToDemoPos(
  isOwner: boolean,
  canEditStock: boolean,
  deviceId = getOrCreatePosDeviceId(),
): DemoPosSession {
  enrollDevice(deviceId, isOwner);
  return startDemoPosSession(deviceId, canEditStock);
}

export function extendDemoPosSession(): DemoPosSession {
  const current = getDemoPosSession();
  if (!current) {
    throw new DemoPosError('POS_DEVICE_REVOKED', '체험 POS 세션이 없습니다.');
  }
  return startDemoPosSession(current.deviceId, current.canEditStock);
}

export function clearDemoPosSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function resetDemoPos(): void {
  localStorage.removeItem(LEGACY_PENDING_KEY);
  localStorage.removeItem(LEGACY_CLAIM_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(DEVICES_KEY);
}
