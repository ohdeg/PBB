import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dietaApi } from '../../api/dietaApi';
import { useDietaProposal } from './useDietaProposal';
vi.mock('../../api/dietaApi', () => ({ dietaApi: { proposeCheckIn: vi.fn() } }));

describe('server proposal freshness', () => {
  it('never exposes an old weight proposal after inputs change or requests finish out of order', async () => {
    type Result = Awaited<ReturnType<typeof dietaApi.proposeCheckIn>>;
    const fixture = (revisionToken: string): Result => ({
      eval: 'ON_TRACK', x: 0.5, source: 'WEIGHT', avgIntakeKcal: 1800, intakeDays: 4,
      weightDeltaKg: -0.6, fatDeltaKg: null, muscleDeltaKg: null, proposedTdee: 2200,
      proposedDailyKcal: 1800, proposedActivityExtraKcal: 0, action: 'HOLD', summary: '유지',
      targetWeightReached: false, due: true, revisionToken,
    });
    let first!: (result: Result) => void;
    let second!: (result: Result) => void;
    vi.mocked(dietaApi.proposeCheckIn)
      .mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
    const { result, rerender } = renderHook(({ weight }) => useDietaProposal({
      enabled: true, loggedOn: '2026-10-31', weight, plateauChoice: 'CUT_KCAL', contextKey: 'same',
    }), { initialProps: { weight: '80' } });
    await waitFor(() => expect(first).toBeDefined());
    rerender({ weight: '79' });
    expect(result.current.proposal).toBeNull();
    await waitFor(() => expect(second).toBeDefined());
    await act(async () => second(fixture('new')));
    expect(result.current.proposal?.revisionToken).toBe('new');
    await act(async () => first(fixture('old')));
    expect(result.current.proposal?.revisionToken).toBe('new');
  });
});
