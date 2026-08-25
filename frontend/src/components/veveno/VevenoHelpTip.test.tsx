// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VevenoHelpTip } from './VevenoHelpTip';
import { VevenoI18nProvider } from '../../features/veveno/i18n/LanguageContext';

afterEach(() => {
  cleanup();
});

describe('VevenoHelpTip', () => {
  it('toggles the bubble on click and closes on outside pointer', () => {
    render(
      <VevenoI18nProvider locale="ko">
        <div>
          <VevenoHelpTip text="근무 중에만 수량을 바꿀 수 있습니다." />
          <button type="button">바깥</button>
        </div>
      </VevenoI18nProvider>,
    );

    const tip = screen.getByRole('button', { name: '도움말' });
    const bubble = screen.getByRole('tooltip', { hidden: true });
    expect(tip.parentElement).not.toHaveClass('is-open');

    fireEvent.click(tip);
    expect(tip.parentElement).toHaveClass('is-open');
    expect(bubble).toHaveTextContent('근무 중에만 수량을 바꿀 수 있습니다.');

    fireEvent.pointerDown(screen.getByRole('button', { name: '바깥' }));
    expect(tip.parentElement).not.toHaveClass('is-open');
  });
});
