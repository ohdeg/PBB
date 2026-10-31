import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DietaCheckInPage } from './DietaCheckInPage';
import { dietaApi } from '../api/dietaApi';
import { mapProfile } from '../api/dietaMappers';
import { sampleProfile } from '../features/dieta/testProfile';
vi.mock('../api/dietaApi', () => ({ dietaApi: {getProfile:vi.fn(),listBodyLogs:vi.fn(),listActivities:vi.fn(),upsertActivity:vi.fn(),getMealQueue:vi.fn(),listIntakes:vi.fn(),listRecipes:vi.fn(),autoFinalizeYesterday:vi.fn()} }));
vi.mock('../stores/authStore', () => ({ useAuthStore: (select: (s: object) => unknown) => select({accessToken:'test',userId:'fixture'}) }));
vi.mock('../features/dieta/useDietaProposal', () => ({useDietaProposal: () => ({proposal:null,displayProposal:null,pending:false,error:'',reload:vi.fn()})}));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(dietaApi.getProfile).mockResolvedValue(mapProfile(sampleProfile)); vi.mocked(dietaApi.listBodyLogs).mockResolvedValue([]); vi.mocked(dietaApi.listActivities).mockResolvedValue([]); vi.mocked(dietaApi.listIntakes).mockResolvedValue([]); vi.mocked(dietaApi.listRecipes).mockResolvedValue([]); vi.mocked(dietaApi.autoFinalizeYesterday).mockResolvedValue(null); vi.mocked(dietaApi.getMealQueue).mockResolvedValue({loggedOn:'2026-10-31',status:'open',items:[]}); });
it('shows initial load failure instead of empty data and allows retry', async () => {
 vi.mocked(dietaApi.getProfile).mockRejectedValueOnce(new Error('연결 실패'));
 render(<MemoryRouter><DietaCheckInPage /></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('연결 실패');
 fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
 expect(await screen.findByRole('heading',{name:'주간 체크인',level:1})).toBeInTheDocument();
});
