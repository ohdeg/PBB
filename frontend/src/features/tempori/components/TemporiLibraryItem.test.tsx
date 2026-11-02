// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { TemporiLibraryItem } from './TemporiLibraryItem';
afterEach(cleanup);
function Row({ account = true, uploading = false, state = 'local' as 'local' | 'saved' | 'failed' }) {
  const [open, setOpen] = useState(false);
  return <MemoryRouter><ul><TemporiLibraryItem item={{ id: 'a', title: '아주 긴 악보 제목', artist: 'Composer', createdAt: '', syncState: state }} account={account} uploading={uploading} open={open} onOpenChange={setOpen} onDelete={vi.fn()} onUpload={vi.fn()} /></ul></MemoryRouter>;
}
it('keeps actions hidden until the independent menu button opens them in delete/upload order', () => {
  render(<Row />); expect(screen.queryByRole('button', { name: '업로드' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '악보 메뉴' }));
  expect(screen.getAllByRole('button').map((item) => item.textContent)).toEqual(['삭제', '업로드', '']);
  expect(screen.getByRole('button', { name: '악보 메뉴' }).closest('a')).toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('button', { name: '업로드' })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '악보 메뉴' }));
});
it('hides upload for guest or saved rows and disables both actions while uploading', () => {
  const view = render(<Row account={false} />); fireEvent.click(screen.getByRole('button', { name: '악보 메뉴' })); expect(screen.queryByText('업로드')).toBeNull();
  view.unmount(); render(<Row uploading />); fireEvent.click(screen.getByRole('button', { name: '악보 메뉴' }));
  expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled(); expect(screen.getByRole('button', { name: '업로드 중…' })).toBeDisabled();
});
