import { useCallback, useEffect, useState } from 'react';
import { dietaApi } from '../../api/dietaApi';
import type { DietaPlateauChoice } from './utils/dietaMath';

type Proposal = Awaited<ReturnType<typeof dietaApi.proposeCheckIn>>;

export function useDietaProposal(input: {
  enabled: boolean;
  loggedOn: string;
  weight: string;
  plateauChoice: DietaPlateauChoice;
  contextKey: string;
}) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; proposal: Proposal | null; error: string }>({
    key: '', proposal: null, error: '',
  });
  const weightKg = Number(input.weight);
  const valid = input.enabled && Number.isFinite(weightKg) && weightKg > 0;
  const key = JSON.stringify([input.loggedOn, weightKg, input.plateauChoice, input.contextKey, version, valid]);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void dietaApi.proposeCheckIn({
        loggedOn: input.loggedOn, weightKg, plateauChoice: input.plateauChoice,
      }).then(proposal => {
        if (!cancelled) setState({ key, proposal, error: '' });
      }).catch((error: unknown) => {
        if (!cancelled) setState({ key, proposal: null,
          error: error instanceof Error ? error.message : '계획을 불러오지 못했어요. 다시 시도해 주세요.' });
      });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [key, valid, input.loggedOn, input.plateauChoice, weightKg]);
  const current = valid && state.key === key;
  return {
    proposal: current ? state.proposal : null,
    displayProposal: valid ? state.proposal : null,
    error: current ? state.error : '',
    pending: valid && !current,
    reload,
  };
}
