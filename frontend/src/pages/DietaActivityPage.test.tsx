import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DietaActivityPage } from './DietaActivityPage';
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
 render(<MemoryRouter><DietaActivityPage /></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('연결 실패');
 fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
 expect(await screen.findByRole('heading',{name:'활동',level:1})).toBeInTheDocument();
});
it('accepts an explicit zero but rejects an entirely empty record', async () => {
 render(<MemoryRouter><DietaActivityPage /></MemoryRouter>);
 const steps=await screen.findByLabelText('걸음');
 fireEvent.click(screen.getByRole('button',{name:'오늘 활동 저장'}));
 expect(dietaApi.upsertActivity).not.toHaveBeenCalled();
 fireEvent.change(steps,{target:{value:'0'}});
 fireEvent.click(screen.getByRole('button',{name:'오늘 활동 저장'}));
 expect(dietaApi.upsertActivity).toHaveBeenCalledWith(expect.objectContaining({steps:0,durationMin:null,activityKcal:null}),'fixture');
 expect(await screen.findByRole('status')).toHaveTextContent('저장했어요');
});
it('preserves activity input after a failed save', async () => {
 vi.mocked(dietaApi.upsertActivity).mockRejectedValueOnce(new Error('저장 실패'));
 render(<MemoryRouter><DietaActivityPage /></MemoryRouter>);
 const steps=await screen.findByLabelText('걸음');fireEvent.change(steps,{target:{value:'123'}});
 fireEvent.click(screen.getByRole('button',{name:'오늘 활동 저장'}));
 expect(await screen.findByRole('status')).toHaveTextContent('저장 실패');expect(steps).toHaveValue('123');
});
