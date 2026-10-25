// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import FloatingSettingsPanel from './FloatingSettingsPanel';
afterEach(cleanup);
it('keeps actions outside the scroll body and restores focus after Escape', async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return <FloatingSettingsPanel isOpen={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} footer={<button>Apply</button>}><input aria-label="BPM" /></FloatingSettingsPanel>;
  }
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: '설정 열기' });
  trigger.focus(); fireEvent.click(trigger);
  await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: '설정 닫기' })).toHaveFocus());
  expect(screen.getByRole('button', { name: 'Apply' }).closest('.floating-settings-body')).toBeNull();
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(trigger).toHaveFocus());
});
