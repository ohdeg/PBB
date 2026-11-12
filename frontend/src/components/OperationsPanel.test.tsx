// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OperationsPanel } from './OperationsPanel';
import { apiClient } from '../api/axios';

describe('OperationsPanel', () => {
  it('filters errors separately from audit and clears private data after a rejected refresh', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: {
      date: '2026-11-13', nextCursor: null,
      errors: [{ app: 'Dieta', operation: 'finalizeMeal', count: 3, status: 503, lastMs: 0, requestId: 'test-ref' }],
      changes: [{ id: '1', action: 'USER_CLASS', actor: 'actor-uuid', target: 'target-uuid', before: 'FREE', after: 'DEV', atMs: 0 }],
    } }).mockRejectedValueOnce(new Error('forbidden'));
    render(<OperationsPanel />);
    await screen.findByText('Dieta · finalizeMeal');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Tempori' } });
    expect(screen.queryByText('Dieta · finalizeMeal')).toBeNull();
    expect(screen.getByText('FREE → DEV')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.queryByText('FREE → DEV')).toBeNull();
    get.mockRestore();
  });
});
