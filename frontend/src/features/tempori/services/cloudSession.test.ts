import { describe, expect, it } from 'vitest';
import { createAccountSession } from './cloudSession';

describe('account request isolation', () => {
  it('aborts and rejects late responses on account change, but keeps a token refresh valid', () => {
    const session = createAccountSession('A');
    const request = session.capture();
    session.setAccount('A');
    expect(request.valid()).toBe(true);
    session.setAccount('B');
    expect(request.signal.aborted).toBe(true);
    expect(request.valid()).toBe(false);
    session.setAccount('A');
    expect(request.valid()).toBe(false);
  });
});
