import { beforeEach, describe, expect, it } from 'vitest';
import {
  DemoPosError,
  getDemoPosSession,
  resetDemoPos,
  startDemoPosSession,
  switchToDemoPos,
} from './demoSession';

const memory = new Map<string, string>();
const sessionMemory = new Map<string, string>();

function mockStorage(map: Map<string, string>) {
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: mockStorage(memory),
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: mockStorage(sessionMemory),
});

describe('demo POS session', () => {
  beforeEach(() => {
    memory.clear();
    sessionMemory.clear();
    resetDemoPos();
  });

  it('lets owner switch this device into POS', () => {
    const session = switchToDemoPos(true, true, 'device-a');
    expect(session.deviceId).toBe('device-a');
    expect(getDemoPosSession()?.deviceId).toBe('device-a');
  });

  it('rejects staff on an unenrolled device', () => {
    expect(() => switchToDemoPos(false, true, 'device-a')).toThrow(DemoPosError);
    try {
      switchToDemoPos(false, true, 'device-a');
    } catch (err) {
      expect(err).toBeInstanceOf(DemoPosError);
      expect((err as DemoPosError).code).toBe('POS_OWNER_ENROLL_ONLY');
    }
  });

  it('lets staff switch after owner enrolled that device', () => {
    switchToDemoPos(true, true, 'device-a');
    const session = switchToDemoPos(false, true, 'device-a');
    expect(session.deviceId).toBe('device-a');
  });

  it('restores a live session and drops an expired one', () => {
    startDemoPosSession('device-a', true);
    expect(getDemoPosSession()?.deviceId).toBe('device-a');
    const expired = getDemoPosSession();
    if (expired) {
      sessionStorage.setItem(
        'veveno:pos:demo:session',
        JSON.stringify({ ...expired, expiresAt: '2000-01-01T00:00:00.000Z' }),
      );
    }
    expect(getDemoPosSession()).toBeNull();
  });

  it('keeps POS session on this tab only', () => {
    switchToDemoPos(true, true, 'device-a');
    expect(sessionStorage.getItem('veveno:pos:demo:session')).toBeTruthy();
    expect(localStorage.getItem('veveno:pos:demo:session')).toBeNull();
  });
});
