// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TemporiUploadConfirm } from './TemporiUploadConfirm';
afterEach(cleanup);
it('names the title input, announces an error and initially focuses the dialog without opening a keyboard', async () => {
  render(<TemporiUploadConfirm fileName="sample.mxl" title="Sample" artist="" isUploading={false} error="Try again" onTitleChange={vi.fn()} onArtistChange={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.getByRole('textbox', { name: '제목' })).toHaveValue('Sample');
  expect(screen.getByRole('alert')).toHaveTextContent('Try again');
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
});
