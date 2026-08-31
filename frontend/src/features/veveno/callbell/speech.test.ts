import { describe, expect, it } from 'vitest';
import { callBellSpeech, DEFAULT_CALL_BELL_PHRASE } from './speech';

describe('callBellSpeech', () => {
  it('returns null when the number is empty', () => {
    expect(callBellSpeech('  ', DEFAULT_CALL_BELL_PHRASE)).toBeNull();
  });

  it('joins number and saved phrase', () => {
    expect(callBellSpeech('000', DEFAULT_CALL_BELL_PHRASE)).toBe(
      '000 고객님 주문하신 음료 나왔습니다',
    );
  });

  it('falls back to the default phrase', () => {
    expect(callBellSpeech('12', '  ')).toBe(`12 ${DEFAULT_CALL_BELL_PHRASE}`);
  });
});
