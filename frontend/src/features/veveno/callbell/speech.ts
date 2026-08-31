export const DEFAULT_CALL_BELL_PHRASE = '고객님 주문하신 음료 나왔습니다';
export const DEFAULT_CALL_BELL_RATE = 1;
export const DEFAULT_CALL_BELL_PITCH = 1;

export function callBellSpeech(slot: string, phrase: string | null): string | null {
  const number = slot.trim();
  if (!number) {
    return null;
  }
  const line = (phrase ?? '').trim() || DEFAULT_CALL_BELL_PHRASE;
  return `${number} ${line}`;
}

export function clampCallBellRate(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CALL_BELL_RATE;
  }
  return Math.min(2, Math.max(0.5, value));
}

export function clampCallBellPitch(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CALL_BELL_PITCH;
  }
  return Math.min(2, Math.max(0, value));
}
