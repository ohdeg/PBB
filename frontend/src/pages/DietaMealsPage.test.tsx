import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DietaMealsPage } from './DietaMealsPage';
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
 render(<MemoryRouter><DietaMealsPage /></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('연결 실패');
 fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
 expect(await screen.findByRole('heading',{name:'식사',level:1})).toBeInTheDocument();
});
it.each(['pending','done'] as const)('locks food entry while %s', async status => {
 vi.mocked(dietaApi.getMealQueue).mockResolvedValue({loggedOn:'2026-10-31',status,items:[],updatedAt:'2026-10-31'});
 render(<MemoryRouter><DietaMealsPage /></MemoryRouter>);
 expect(await screen.findByLabelText('오늘 먹은 것')).toBeDisabled();
});
it('offers analysis retry for a failed day with retained food', async () => {
 vi.mocked(dietaApi.getMealQueue).mockResolvedValue({loggedOn:'2026-10-31',status:'failed',items:[{id:'1',mealType:'LUNCH',text:'점심 기록',addedAt:'2026-10-31'}],updatedAt:'2026-10-31'});
 render(<MemoryRouter><DietaMealsPage /></MemoryRouter>);
 expect(await screen.findByRole('button',{name:'분석 다시 시도'})).toBeEnabled();expect(screen.getByText('점심 기록')).toBeInTheDocument();
});
it('explains missing AI consent without discarding food input', async () => {
 vi.mocked(dietaApi.getProfile).mockResolvedValue(mapProfile({...sampleProfile,geminiMealConsent:false}));
 render(<MemoryRouter><DietaMealsPage /></MemoryRouter>);
 expect(await screen.findByRole('button',{name:'오늘 기록 확정하고 분석'})).toBeDisabled();
 expect(screen.getByText(/분석에는 AI 동의가 필요해요/)).toBeInTheDocument();
});
