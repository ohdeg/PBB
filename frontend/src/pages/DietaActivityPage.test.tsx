import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DietaActivityPage } from './DietaActivityPage';
import { dietaApi } from '../api/dietaApi';
import { mapProfile } from '../api/dietaMappers';
import { sampleProfile } from '../features/dieta/testProfile';
vi.mock('../api/dietaApi', () => ({ dietaApi: {getProfile:vi.fn(),listBodyLogs:vi.fn(),listActivities:vi.fn(),activitySuggestions:vi.fn(),upsertActivity:vi.fn(),getMealQueue:vi.fn(),listIntakes:vi.fn(),listRecipes:vi.fn(),autoFinalizeYesterday:vi.fn()} }));
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
 expect(dietaApi.upsertActivity).toHaveBeenCalledWith(expect.objectContaining({steps:0,durationMin:null,exerciseKcal:null}),'fixture');
 expect(await screen.findByRole('status')).toHaveTextContent('저장했어요');
});
it('preserves activity input after a failed save', async () => {
 vi.mocked(dietaApi.upsertActivity).mockRejectedValueOnce(new Error('저장 실패'));
 render(<MemoryRouter><DietaActivityPage /></MemoryRouter>);
 const steps=await screen.findByLabelText('걸음');fireEvent.change(steps,{target:{value:'123'}});
 fireEvent.click(screen.getByRole('button',{name:'오늘 활동 저장'}));
 expect(await screen.findByRole('status')).toHaveTextContent('저장 실패');expect(steps).toHaveValue('123');
});

it('submits only exercise calories alongside step count', async () => {
 render(<MemoryRouter><DietaActivityPage /></MemoryRouter>);
 fireEvent.change(await screen.findByLabelText('걸음'), {target:{value:'5000'}});
 fireEvent.change(screen.getByLabelText('운동 소모 열량 (kcal)'), {target:{value:'120'}});
 fireEvent.click(screen.getByRole('button',{name:'오늘 활동 저장'}));
 expect(dietaApi.upsertActivity).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('운동명'),{target:{value:'수영'}});
 fireEvent.click(screen.getByRole('button',{name:'오늘 활동 저장'}));
 expect(dietaApi.upsertActivity).toHaveBeenCalledWith(expect.objectContaining({steps:5000,exerciseKcal:120}), 'fixture');
});
it('preserves the old daily total when editing minutes without conversion', async () => {
 const loggedOn = new Intl.DateTimeFormat('sv-SE').format(new Date());
 vi.mocked(dietaApi.listActivities).mockResolvedValue([{id:'old',loggedOn,steps:null,durationMin:5,activityKcal:220,note:null}]);
 render(<MemoryRouter><DietaActivityPage /></MemoryRouter>);
 expect(await screen.findByLabelText('운동 소모 열량 (kcal)')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('운동 시간 (분)'),{target:{value:'10'}});
 fireEvent.click(screen.getByRole('button',{name:'오늘 활동 수정'}));
 expect(dietaApi.upsertActivity).toHaveBeenCalledWith(expect.objectContaining({durationMin:10,preservedLegacyKcal:220,exerciseKcal:null}), 'fixture');
});

it('records a named activity for yesterday with missing minutes and kcal', async () => {
 render(<MemoryRouter><DietaActivityPage /></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'이전 날짜'}));
 const day = await screen.findByText('어제 활동 기록');
 expect(day).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('운동명'),{target:{value:'점심 산책'}});
 fireEvent.click(screen.getByRole('button',{name:'어제 활동 저장'}));
 expect(dietaApi.upsertActivity).toHaveBeenCalledWith(expect.objectContaining({activityName:'점심 산책',durationMin:null,exerciseKcal:null}), 'fixture');
});
it('retains provenance of an adjusted average and submits its source revision', async () => {
 vi.mocked(dietaApi.activitySuggestions).mockResolvedValue({previous:null,averages:{steps:{value:8000,days:4}},revision:'prior-4'});
 render(<MemoryRouter><DietaActivityPage /></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'평소 수준으로 채우기'}));
 fireEvent.click(await screen.findByRole('button',{name:/걸음 8000/}));
 fireEvent.change(screen.getByLabelText('걸음'),{target:{value:'7500'}});
 fireEvent.click(screen.getByRole('button',{name:'오늘 활동 저장'}));
 expect(dietaApi.upsertActivity).toHaveBeenCalledWith(expect.objectContaining({steps:7500,estimatedFields:['steps'],suggestionRevision:'prior-4'}),'fixture');
});

it('opens dated activity history without edit controls or repeated list fetches', async () => {
 vi.mocked(dietaApi.listActivities).mockResolvedValue([{id:'old',loggedOn:'2024-02-29',steps:5800,durationMin:30,
   exerciseKcal:120,activityKcal:220,walkingKcal:100,splitCalories:true,activityName:'실내 자전거',note:null}]);
 render(<MemoryRouter initialEntries={['/?day=2024-02-29']}><DietaActivityPage/></MemoryRouter>);
 expect(await screen.findByText('실내 자전거')).toBeVisible();
 expect(screen.queryByLabelText('운동명')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'다음 날짜'}));
 expect(await screen.findByText('이날 기록한 활동이 없어요.')).toBeVisible();
 expect(screen.getByRole('button',{name:'2024-03-01 날짜 선택'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'오늘로 돌아가기'}));
 expect(await screen.findByLabelText('운동명')).toBeVisible();
 expect(screen.getByRole('button',{name:'다음 날짜'})).toBeDisabled();
 expect(dietaApi.listActivities).toHaveBeenCalledTimes(1);
 expect(dietaApi.upsertActivity).not.toHaveBeenCalled();
});

it('keeps a draft on its original date across midnight', async()=>{
 vi.useFakeTimers({toFake:['Date']});
 try {
   vi.setSystemTime(new Date(2026,10,12,23,59));
   render(<MemoryRouter><DietaActivityPage/></MemoryRouter>);
   const name=await screen.findByLabelText('운동명');
   fireEvent.change(name,{target:{value:'야간 산책'}});
   vi.setSystemTime(new Date(2026,10,13,0,1));
   fireEvent.focus(window);
   expect(await screen.findByRole('button',{name:'어제 활동 저장'})).toBeVisible();
   expect(screen.getByLabelText('운동명')).toHaveValue('야간 산책');
   fireEvent.click(screen.getByRole('button',{name:'어제 활동 저장'}));
   expect(dietaApi.upsertActivity).toHaveBeenCalledWith(expect.objectContaining({loggedOn:'2026-11-12',activityName:'야간 산책'}),'fixture');
 } finally {vi.useRealTimers();}
});
