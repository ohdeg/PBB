import { describe, expect, it } from 'vitest';
import {
  callBellSpoken,
  callBellSpeech,
  clampCallBellPitch,
  clampCallBellRate,
  DEFAULT_CALL_BELL_PHRASE,
  speakCallBellSlot,
  toSinoKorean,
} from './speech';

describe('callBellSpeech', () => {
  it('returns null when the number is empty', () => {
    expect(callBellSpeech('  ', DEFAULT_CALL_BELL_PHRASE)).toBeNull();
  });

  it('joins number and saved phrase', () => {
    expect(callBellSpeech('000', DEFAULT_CALL_BELL_PHRASE)).toBe(
      '000 고객님 주문하신 음료 나왔습니다',
    );
  });

  it('keeps only the number when the phrase is empty', () => {
    expect(callBellSpeech('12', '  ')).toBe('12');
    expect(callBellSpeech('12', null)).toBe('12');
  });
});

describe('toSinoKorean', () => {
  it('reads cafe numbers in Sino-Korean', () => {
    expect(toSinoKorean(312)).toBe('삼백십이');
    expect(toSinoKorean(12)).toBe('십이');
    expect(toSinoKorean(100)).toBe('백');
    expect(toSinoKorean(10)).toBe('십');
    expect(toSinoKorean(0)).toBe('영');
  });
});

describe('speakCallBellSlot', () => {
  it('keeps a user-typed 번 after the number', () => {
    expect(speakCallBellSlot('312번')).toBe('삼백십이번');
  });
});

describe('callBellSpoken', () => {
  it('reads 312 plus a phrase that starts with 번 as 삼백십이번', () => {
    expect(callBellSpoken('312', '번 고객님 나왔습니다', 'ko')).toBe(
      '삼백십이번 고객님 나왔습니다',
    );
    expect(callBellSpoken('312', '번 고객님 나왔습니다', 'en')).toBe(
      '312 번 고객님 나왔습니다',
    );
  });

  it('speaks only the number when the phrase is empty', () => {
    expect(callBellSpoken('312', null, 'ko')).toBe('삼백십이');
    expect(callBellSpoken('312', '  ', 'en')).toBe('312');
  });
});

describe('clampCallBell', () => {
  it('clamps rate and pitch', () => {
    expect(clampCallBellRate(9)).toBe(2);
    expect(clampCallBellRate(0.1)).toBe(0.5);
    expect(clampCallBellPitch(-1)).toBe(0);
    expect(clampCallBellPitch(9)).toBe(2);
  });
});
