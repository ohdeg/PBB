import { useState } from 'react';
import { VevenoConcentrationCalculator } from './VevenoConcentrationCalculator';
import { VevenoTimers } from './VevenoTimers';
import { VevenoUnitConverter } from './VevenoUnitConverter';

type ToolsSection = 'units' | 'concentration' | 'timers';

interface VevenoToolsPanelProps {
  storeId: string;
}

export function VevenoToolsPanel({ storeId }: VevenoToolsPanelProps) {
  const [section, setSection] = useState<ToolsSection>('units');

  return (
    <div className="veveno-tools">
      <div className="veveno-tools-seg veveno-tools-seg--main" role="tablist" aria-label="도구">
        <button
          type="button"
          role="tab"
          className={section === 'units' ? 'is-active' : ''}
          aria-selected={section === 'units'}
          onClick={() => setSection('units')}
        >
          단위 변환
        </button>
        <button
          type="button"
          role="tab"
          className={section === 'concentration' ? 'is-active' : ''}
          aria-selected={section === 'concentration'}
          onClick={() => setSection('concentration')}
        >
          농도
        </button>
        <button
          type="button"
          role="tab"
          className={section === 'timers' ? 'is-active' : ''}
          aria-selected={section === 'timers'}
          onClick={() => setSection('timers')}
        >
          타이머
        </button>
      </div>

      {section === 'units' ? (
        <VevenoUnitConverter />
      ) : section === 'concentration' ? (
        <VevenoConcentrationCalculator />
      ) : (
        <VevenoTimers storeId={storeId} />
      )}
    </div>
  );
}
