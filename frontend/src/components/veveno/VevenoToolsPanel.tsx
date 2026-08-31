import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { openVevenoToolsPopup } from '../../features/veveno/tools/compact';
import { openDocumentPip } from '../../features/veveno/tools/documentPip';
import { VevenoButton } from './VevenoButton';
import { VevenoConcentrationCalculator } from './VevenoConcentrationCalculator';
import { VevenoTimers } from './VevenoTimers';
import { VevenoUnitConverter } from './VevenoUnitConverter';

type ToolsSection = 'units' | 'concentration' | 'timers';

interface VevenoToolsPanelProps {
  storeId: string;
  popup?: boolean;
  onCompactChange?: (open: boolean) => void;
}

export function VevenoToolsPanel({
  storeId,
  popup = false,
  onCompactChange,
}: VevenoToolsPanelProps) {
  const t = useTranslation();
  const location = useLocation();
  const [section, setSection] = useState<ToolsSection>('units');
  const [pipRoot, setPipRoot] = useState<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const pipWinRef = useRef<Window | null>(null);

  const closePip = useCallback(() => {
    const win = pipWinRef.current;
    pipWinRef.current = null;
    setPipRoot(null);
    onCompactChange?.(false);
    win?.close();
  }, [onCompactChange]);

  useEffect(() => {
    return () => {
      pipWinRef.current?.close();
    };
  }, []);

  const openCompact = async () => {
    setError('');
    try {
      const opened = await openDocumentPip({ width: 380, height: 640 });
      if (opened) {
        pipWinRef.current = opened.win;
        setPipRoot(opened.root);
        onCompactChange?.(true);
        opened.win.addEventListener('pagehide', () => {
          pipWinRef.current = null;
          setPipRoot(null);
          onCompactChange?.(false);
        });
        return;
      }
    } catch {
      /* fall through to popup */
    }
    const pop = openVevenoToolsPopup(storeId, location.pathname);
    if (!pop) {
      setError(t('tools.compactBlocked'));
    }
  };

  const body = (
    <div className="veveno-tools">
      <div className="veveno-tools-head">
        <div className="veveno-tools-seg veveno-tools-seg--main" role="tablist" aria-label={t('tools.aria')}>
          <button
            type="button"
            role="tab"
            className={section === 'units' ? 'is-active' : ''}
            aria-selected={section === 'units'}
            onClick={() => setSection('units')}
          >
            {t('tools.units')}
          </button>
          <button
            type="button"
            role="tab"
            className={section === 'concentration' ? 'is-active' : ''}
            aria-selected={section === 'concentration'}
            onClick={() => setSection('concentration')}
          >
            {t('tools.concentration')}
          </button>
          <button
            type="button"
            role="tab"
            className={section === 'timers' ? 'is-active' : ''}
            aria-selected={section === 'timers'}
            onClick={() => setSection('timers')}
          >
            {t('tools.timers')}
          </button>
        </div>
        {popup ? null : pipRoot ? (
          <VevenoButton type="button" size="sm" variant="ghost" onClick={closePip}>
            {t('tools.compactClose')}
          </VevenoButton>
        ) : (
          <VevenoButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void openCompact();
            }}
          >
            {t('tools.compact')}
          </VevenoButton>
        )}
      </div>
      {error ? <p className="veveno-error">{error}</p> : null}

      {section === 'units' ? (
        <VevenoUnitConverter />
      ) : section === 'concentration' ? (
        <VevenoConcentrationCalculator />
      ) : (
        <VevenoTimers storeId={storeId} />
      )}
    </div>
  );

  if (pipRoot) {
    return (
      <>
        <p className="veveno-shell__meta">{t('tools.compactHint')}</p>
        {createPortal(body, pipRoot)}
      </>
    );
  }

  return body;
}
