import { useState } from 'react';
import { BrewTimers } from './BrewTimers';
import { BrewUnitConverter } from './BrewUnitConverter';

type ToolsSection = 'units' | 'timers';

interface BrewToolsPanelProps {
  storeId: string;
}

export function BrewToolsPanel({ storeId }: BrewToolsPanelProps) {
  const [section, setSection] = useState<ToolsSection>('units');

  return (
    <div className="brew-tools">
      <div className="brew-tools-seg brew-tools-seg--main" role="tablist" aria-label="도구">
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
          className={section === 'timers' ? 'is-active' : ''}
          aria-selected={section === 'timers'}
          onClick={() => setSection('timers')}
        >
          타이머
        </button>
      </div>

      {section === 'units' ? (
        <BrewUnitConverter />
      ) : (
        <BrewTimers storeId={storeId} />
      )}
    </div>
  );
}
