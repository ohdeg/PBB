import { useState } from 'react';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { VevenoConcentrationCalculator } from './VevenoConcentrationCalculator';
import { VevenoTimers } from './VevenoTimers';
import { VevenoUnitConverter } from './VevenoUnitConverter';

type ToolsSection = 'units' | 'concentration' | 'timers';

interface VevenoToolsPanelProps {
  storeId: string;
}

export function VevenoToolsPanel({ storeId }: VevenoToolsPanelProps) {
  const t = useTranslation();
  const [section, setSection] = useState<ToolsSection>('units');

  return (
    <div className="veveno-tools">
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
