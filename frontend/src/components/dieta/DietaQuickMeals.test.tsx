// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { DietaQuickMeals } from './DietaQuickMeals';
import { dietaApi } from '../../api/dietaApi';
import type { QuickPreview } from '../../features/dieta/quickEntry';
vi.mock('../../api/dietaApi',()=>({dietaApi:{quickPreview:vi.fn(),quickApply:vi.fn()}}));
const rice={id:'first',mealType:'LUNCH',text:'밥 한 공기',recipeId:null,portion:1} as const;
const p:QuickPreview={day:'2026-11-09',previousDay:'2026-11-08',current:[rice],previous:[rice],
  favorites:[{id:'saved',name:'평일 점심',items:[rice]}],estimates:{},revision:'v1',requestId:'test-request',averages:[]};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(dietaApi.quickPreview).mockResolvedValue(p);vi.mocked(dietaApi.quickApply).mockResolvedValue();});
afterEach(cleanup);
const show=()=>render(<DietaQuickMeals day={p.day} mealType="LUNCH" disabled={false} refresh={vi.fn().mockResolvedValue(undefined)}/>);
it('lets the user correct an imported portion without altering yesterday and reuses a key on retry', async()=>{
  vi.mocked(dietaApi.quickApply).mockRejectedValueOnce(new Error('통신 실패'));
  show();fireEvent.click(screen.getByText('어제 식사 가져오기'));
  expect(await screen.findByText('2026-11-08 → 2026-11-09')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('음식과 양'),{target:{value:'밥 반 공기'}});
  fireEvent.click(screen.getByText('선택한 음식 추가'));await screen.findByText('통신 실패');
  fireEvent.click(screen.getByText('선택한 음식 추가'));await screen.findByText('저장했어요.');
  const calls=vi.mocked(dietaApi.quickApply).mock.calls;
  expect(calls[0]).toEqual(calls[1]);expect(calls[0][1].picks?.[0].text).toBe('밥 반 공기');expect(p.previous[0].text).toBe('밥 한 공기');
});
it('saves a named meal and lets the same template be used at a different meal', async()=>{
  show();fireEvent.click(screen.getByText('자주 먹는 식사로 저장'));fireEvent.change(await screen.findByLabelText('식사 이름'),{target:{value:'회사 점심'}});
  fireEvent.click(screen.getByText('식사 저장'));await screen.findByText('저장했어요.');
  expect(dietaApi.quickApply).toHaveBeenCalledWith(p.day,expect.objectContaining({action:'saveFavorite',name:'회사 점심'}));
  fireEvent.click(screen.getByText('자주 먹는 식사'));fireEvent.change(await screen.findByLabelText('밥 한 공기 끼니'),{target:{value:'DINNER'}});
  fireEvent.click(screen.getByText('선택한 음식 추가'));await waitFor(()=>expect(dietaApi.quickApply).toHaveBeenCalledTimes(2));
  expect(vi.mocked(dietaApi.quickApply).mock.calls[1][1].picks?.[0].mealType).toBe('DINNER');
});
it('blocks an estimate for an already recorded meal',async()=>{
  show();fireEvent.click(screen.getByText('평소 수준으로 채우기'));
  expect(await screen.findByText('추정으로 저장')).toBeDisabled();
  fireEvent.click(screen.getByText('취소'));expect(dietaApi.quickApply).not.toHaveBeenCalled();
});

it('shows the preview failure on the phone before reopening', async()=>{
  vi.mocked(dietaApi.quickPreview).mockRejectedValueOnce(new Error('간편 기록 조회 실패 (HTTP 404).'));
  show(); fireEvent.click(screen.getByText('어제 식사 가져오기'));
  expect(await screen.findByRole('status')).toHaveTextContent('HTTP 404');
  fireEvent.click(screen.getByText('어제 식사 가져오기'));
  expect(await screen.findByText('선택한 음식 추가')).toBeEnabled();
});
