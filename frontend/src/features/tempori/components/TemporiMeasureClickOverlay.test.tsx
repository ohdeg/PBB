// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TemporiMeasureClickOverlay from './TemporiMeasureClickOverlay';
afterEach(cleanup);
it('activates an accessible physical measure and removes targets when disabled', () => {
  const select = vi.fn();
  const layouts = [{ measureIndex: 3, topPx: 0, leftPx: 0, widthPx: 300, heightPx: 100 }];
  const result = render(<TemporiMeasureClickOverlay layouts={layouts} enabled onMeasureClick={select} />);
  fireEvent.click(screen.getByRole('button', { name: '마디 4 선택' }));
  expect(select).toHaveBeenCalledWith(3);
  result.rerender(<TemporiMeasureClickOverlay layouts={layouts} enabled={false} onMeasureClick={select} />);
  expect(screen.queryByRole('button')).toBeNull();
});
