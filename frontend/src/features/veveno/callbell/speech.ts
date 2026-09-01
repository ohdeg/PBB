export const DEFAULT_CALL_BELL_PHRASE = '고객님 주문하신 음료 나왔습니다';
export const DEFAULT_CALL_BELL_RATE = 1;
export const DEFAULT_CALL_BELL_PITCH = 1;

const SINO_ONES = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

function sinoBelowMan(n: number): string {
  const thousand = Math.floor(n / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const ten = Math.floor((n % 100) / 10);
  const one = n % 10;
  let out = '';
  if (thousand) {
    out += (thousand === 1 ? '' : SINO_ONES[thousand]) + '천';
  }
  if (hundred) {
    out += (hundred === 1 ? '' : SINO_ONES[hundred]) + '백';
  }
  if (ten) {
    out += (ten === 1 ? '' : SINO_ONES[ten]) + '십';
  }
  if (one) {
    out += SINO_ONES[one];
  }
  return out;
}

/** 312 → 삼백십이. 대기번호용 한자어. */
export function toSinoKorean(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    return String(n);
  }
  if (n === 0) {
    return '영';
  }
  if (n >= 100_000_000) {
    return String(n);
  }
  const man = Math.floor(n / 10_000);
  const rest = n % 10_000;
  let out = '';
  if (man) {
    out += (man === 1 ? '' : sinoBelowMan(man)) + '만';
  }
  return out + sinoBelowMan(rest);
}

/** 숫자만 한자어로. `312번` → `삼백십이번`. */
export function speakCallBellSlot(slot: string): string {
  return slot.replace(/\d+/g, (digits) => {
    if (digits.length > 8) {
      return digits;
    }
    if (/^0+$/.test(digits)) {
      return '영';
    }
    return toSinoKorean(Number(digits));
  });
}

export function callBellSpeech(slot: string, phrase: string | null): string | null {
  const number = slot.trim();
  if (!number) {
    return null;
  }
  const line = (phrase ?? '').trim() || DEFAULT_CALL_BELL_PHRASE;
  return `${number} ${line}`;
}

export function callBellSpoken(
  slot: string,
  phrase: string | null,
  locale: string,
): string | null {
  const number = slot.trim();
  if (!number) {
    return null;
  }
  const line = (phrase ?? '').trim() || DEFAULT_CALL_BELL_PHRASE;
  const spokenNum = locale === 'ko' ? speakCallBellSlot(number) : number;
  if (locale === 'ko' && line.startsWith('번')) {
    return `${spokenNum}${line}`;
  }
  return `${spokenNum} ${line}`;
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
