export const DEFAULT_CALL_BELL_PHRASE = '고객님 주문하신 음료 나왔습니다';

export function callBellSpeech(slot: string, phrase: string | null): string | null {
  const number = slot.trim();
  if (!number) {
    return null;
  }
  const line = (phrase ?? '').trim() || DEFAULT_CALL_BELL_PHRASE;
  return `${number} ${line}`;
}
