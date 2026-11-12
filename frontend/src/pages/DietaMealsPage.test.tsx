import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useToastStore } from '../stores/toastStore';
import type { MealDayDetails } from '../features/dieta/quickEntry';
import { MemoryRouter } from 'react-router-dom';
import { DietaMealsPage } from './DietaMealsPage';
import { dietaApi } from '../api/dietaApi';
import { mapProfile } from '../api/dietaMappers';
import { sampleProfile } from '../features/dieta/testProfile';
vi.mock('../api/dietaApi', () => ({ dietaApi: {addMealQueueItem:vi.fn(),mealDay:vi.fn(),getProfile:vi.fn(),listBodyLogs:vi.fn(),listActivities:vi.fn(),upsertActivity:vi.fn(),getMealQueue:vi.fn(),listIntakes:vi.fn(),listRecipes:vi.fn(),autoFinalizeYesterday:vi.fn()} }));
vi.mock('../stores/authStore', () => ({ useAuthStore: (select: (s: object) => unknown) => select({accessToken:'test',userId:'fixture'}) }));
vi.mock('../features/dieta/useDietaProposal', () => ({useDietaProposal: () => ({proposal:null,displayProposal:null,pending:false,error:'',reload:vi.fn()})}));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(dietaApi.getProfile).mockResolvedValue(mapProfile(sampleProfile)); vi.mocked(dietaApi.listBodyLogs).mockResolvedValue([]); vi.mocked(dietaApi.listActivities).mockResolvedValue([]); vi.mocked(dietaApi.listIntakes).mockResolvedValue([]); vi.mocked(dietaApi.listRecipes).mockResolvedValue([]); vi.mocked(dietaApi.autoFinalizeYesterday).mockResolvedValue(null); vi.mocked(dietaApi.getMealQueue).mockResolvedValue({loggedOn:'2026-10-31',status:'open',items:[]}); });
beforeEach(()=>{
 vi.mocked(dietaApi.mealDay).mockImplementation(async day=>({
   day,queue:await dietaApi.getMealQueue(day),intake:null,foods:[],mealTotals:{},completedStage:null
 }));
});
it('opens an older day without editable controls or analysis requests',async()=>{
 render(<MemoryRouter initialEntries={['/?day=2024-02-29']}><DietaMealsPage/></MemoryRouter>);
 expect(await screen.findByText('이날 기록한 식사가 없어요.')).toBeVisible();
 expect(screen.queryByText('최근 식사 기록')).toBeNull();
 expect(screen.queryByLabelText(/먹은 것/)).toBeNull();
 expect(dietaApi.autoFinalizeYesterday).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'다음 날짜'}));
 expect(await screen.findByRole('button',{name:'2024-03-01 날짜 선택'})).toBeVisible();
});
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
it.each([0, 1])('enables the last analysis only after new food is recorded (%i extras)', async count => {
 const items = [{id:'base:0', mealType:'LUNCH' as const, text:'밥', addedAt:null}];
 if (count) items.push({...items[0], id:'extra:1', text:'사과'});
 vi.mocked(dietaApi.getMealQueue).mockResolvedValue({loggedOn:'2026-11-08',status:'done',availableStage:'SUPPLEMENT',newItemCount:count,items});
 render(<MemoryRouter><DietaMealsPage /></MemoryRouter>);
 const button = await screen.findByRole('button',{name:/추가 음식 포함해 다시 분석/});
 expect(button).toHaveProperty('disabled',count === 0);
 expect(!!screen.queryByText('지난 분석 이후 추가한 음식')).toBe(count>0);
 expect(screen.getByLabelText('오늘 먹은 것')).toBeEnabled();
});

it('accepts record-only input after both analysis attempts are spent', async()=>{
 vi.mocked(dietaApi.getMealQueue).mockResolvedValue({loggedOn:'2026-11-09',status:'done',availableStage:null,newItemCount:0,items:[]});
 render(<MemoryRouter><DietaMealsPage/></MemoryRouter>);
 fireEvent.change(await screen.findByLabelText('오늘 먹은 것'),{target:{value:'사과'}});
 expect(screen.getByRole('button',{name:'분석 없이 기록만 저장'})).toBeEnabled();
 expect(screen.queryByRole('button',{name:/확정하고 분석/})).not.toBeInTheDocument();
});

it('shows completion for a pending day once after moving to another date',async()=>{
 vi.useFakeTimers();
 useToastStore.getState().clear();
 try {
   const day = '2026-11-11';
   vi.setSystemTime(new Date(day+'T12:00:00'));
   let finished = false;
   vi.mocked(dietaApi.mealDay).mockImplementation(async selected=>({
     day:selected,queue:{loggedOn:selected,status:selected!==day?'open':finished?'done':'pending',items:[]},
     foods:[],mealTotals:{},intake:null,completedStage:selected===day && finished?'MAIN':null,
   }));
   await act(async()=>{render(<MemoryRouter><DietaMealsPage/></MemoryRouter>);});
   await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'이전 날짜'}));});
   finished=true;
   await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
   expect(useToastStore.getState().toasts.map(t=>t.message)).toEqual([day+' 식사 분석이 완료됐어요.']);
   await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'다음 날짜'}));});
   expect(useToastStore.getState().toasts).toHaveLength(1);
   await act(async()=>{await vi.advanceTimersByTimeAsync(3200);});
   expect(useToastStore.getState().toasts).toHaveLength(0);
 } finally {vi.useRealTimers(); useToastStore.getState().clear();}
});

it('keeps the selected day when a slower previous request completes',async()=>{
 let finish!: (result:MealDayDetails)=>void;
 const empty = (day:string):MealDayDetails=>({day,queue:{loggedOn:day,status:'open',items:[]},
   foods:[],mealTotals:{},intake:null,completedStage:null});
 vi.mocked(dietaApi.mealDay).mockImplementation(day=>day==='2024-12-31'
   ? new Promise(resolve=>{finish=resolve;}) : Promise.resolve(empty(day)));
 render(<MemoryRouter initialEntries={['/?day=2024-12-31']}><DietaMealsPage/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'다음 날짜'}));
 expect(await screen.findByText('이날 기록한 식사가 없어요.')).toBeVisible();
 await act(async()=>finish({...empty('2024-12-31'),foods:[
   {mealType:'LUNCH',name:'이전 날짜 입력',source:'unanalysed',nutrition:null,portion:null}
 ]}));
 expect(screen.queryByText('이전 날짜 입력')).toBeNull();
 expect(screen.getByRole('button',{name:'2025-01-01 날짜 선택'})).toBeVisible();
});

it('suggests the next empty meal for the current time and keeps manual selection and drafts on refresh', async()=>{
 vi.useFakeTimers();
 try {
   vi.setSystemTime(new Date('2026-11-11T12:00:00'));
   vi.mocked(dietaApi.mealDay).mockImplementation(async day=>({
     day,queue:{loggedOn:day,status:'open',items:[]},intake:null,completedStage:null,mealTotals:{},
     foods:[{mealType:'LUNCH',name:'평균 추정',portion:null,source:'average',nutrition:null}],
   }));
   await act(async()=>{render(<MemoryRouter><DietaMealsPage/></MemoryRouter>);});
   expect(screen.getByRole('button',{name:'저녁 기록'})).toHaveAttribute('aria-expanded','true');
   fireEvent.change(screen.getByLabelText('오늘 먹은 것'),{target:{value:'저녁 초안'}});
   fireEvent.click(screen.getByRole('button',{name:'점심 기록'}));
   expect(screen.getByLabelText('오늘 먹은 것')).toHaveValue('');
   await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
   expect(screen.getByRole('button',{name:'점심 기록'})).toHaveAttribute('aria-expanded','true');
   fireEvent.click(screen.getByRole('button',{name:'저녁 기록'}));
   expect(screen.getByLabelText('오늘 먹은 것')).toHaveValue('저녁 초안');
 } finally {vi.useRealTimers();}
});

it('keeps a successful add visible if refreshing nutrition fails',async()=>{
 vi.mocked(dietaApi.addMealQueueItem).mockResolvedValue({
   loggedOn:'2026-11-11',status:'open',items:[{id:'new',mealType:'LUNCH',text:'새 점심',addedAt:null}],
 });
 render(<MemoryRouter><DietaMealsPage/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'점심 기록'}));
 fireEvent.change(screen.getByLabelText('오늘 먹은 것'),{target:{value:'새 점심'}});
 vi.mocked(dietaApi.mealDay).mockRejectedValueOnce(new Error('offline'));
 fireEvent.click(screen.getByRole('button',{name:'점심에 추가'}));
 expect(await screen.findByRole('button',{name:'다시 조회'})).toBeEnabled();
 expect(screen.getByText('새 점심')).toBeVisible();
 expect(screen.getByLabelText('오늘 먹은 것')).toHaveValue('');
 expect(dietaApi.addMealQueueItem).toHaveBeenCalledTimes(1);
});
