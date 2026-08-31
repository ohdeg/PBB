import { describe, expect, it } from 'vitest';
import { parsePosQr } from './parseQr';

describe('parsePosQr', () => {
  it('parses pair id and secret', () => {
    const parsed = parsePosQr(
      'pbb-pos:v1:11111111-1111-4111-8111-111111111111:deadbeefdeadbeefdeadbeefdeadbeef',
    );
    expect(parsed).toEqual({
      pairId: '11111111-1111-4111-8111-111111111111',
      secret: 'deadbeefdeadbeefdeadbeefdeadbeef',
    });
  });

  it('rejects other payloads', () => {
    expect(parsePosQr('https://example.com')).toBeNull();
    expect(parsePosQr('pbb-pos:v1:not-a-uuid:abc')).toBeNull();
  });
});
