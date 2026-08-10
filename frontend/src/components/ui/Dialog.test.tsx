// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function DialogHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div id="root">
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <Dialog
        open={open}
        title="접근성 대화상자"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        backdropClassName="backdrop"
        panelClassName="panel"
      >
        {({ titleId }) => (
          <>
            <h2 id={titleId}>접근성 대화상자</h2>
            <button type="button">첫 번째</button>
            <button type="button">마지막</button>
          </>
        )}
      </Dialog>
    </div>
  );
}

describe('Dialog', () => {
  it('배경을 비활성화하고 첫 컨트롤에 포커스한다', async () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));

    const dialog = screen.getByRole('dialog', { name: '접근성 대화상자' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const appBoundary = screen.getByText('열기').closest('#root')?.parentElement;
    expect(appBoundary?.inert).toBe(true);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '첫 번째' })).toHaveFocus();
    });
  });

  it('Tab 포커스를 대화상자 안에 가둔다', async () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));

    const first = screen.getByRole('button', { name: '첫 번째' });
    const last = screen.getByRole('button', { name: '마지막' });
    await waitFor(() => expect(first).toHaveFocus());

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('Escape로 닫고 열기 버튼에 포커스를 복원한다', async () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: '열기' });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '첫 번째' })).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
