import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DietaSettingsPage } from './DietaSettingsPage';
import { dietaApi } from '../api/dietaApi';
import { mapProfile } from '../api/dietaMappers';
import { sampleProfile } from '../features/dieta/testProfile';
vi.mock('../api/dietaApi', () => ({ dietaApi: { getProfile: vi.fn(), updateProfile: vi.fn(), setMaintainMode: vi.fn(), resetAll: vi.fn() } }));
const auth = vi.hoisted(() => ({listeners: [] as Array<(s: {accessToken:string|null;userId:string|null}, p: {accessToken:string|null;userId:string|null})=>void>}));
vi.mock('../stores/authStore', () => ({ useAuthStore: Object.assign((select: (s: object) => unknown) => select({accessToken:'test',userId:'fixture'}), { subscribe: (listener: typeof auth.listeners[number]) => {auth.listeners.push(listener); return () => {};} }) }));
afterEach(cleanup);
beforeEach(() => { auth.listeners.forEach(fn=>fn({accessToken:null,userId:null},{accessToken:'test',userId:'fixture'})); vi.clearAllMocks(); vi.mocked(dietaApi.getProfile).mockResolvedValue(mapProfile(sampleProfile)); });
function show() { return render(<MemoryRouter><DietaSettingsPage /></MemoryRouter>); }
describe('Dieta settings explicit saves', () => {
  it('does not save on blur and saves only the target section explicitly', async () => {
    vi.mocked(dietaApi.updateProfile).mockResolvedValue(mapProfile({...sampleProfile,targetWeightKg:64}));
    show(); const input = await screen.findByLabelText('목표 체중 (kg)');
    fireEvent.change(input,{target:{value:'64'}}); fireEvent.blur(input);
    expect(dietaApi.updateProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'목표 저장'}));
    expect(await screen.findByText('목표를 저장했어요.')).toBeInTheDocument();
    expect(dietaApi.updateProfile).toHaveBeenCalledWith(expect.objectContaining({targetWeightKg:64}), 'fixture');
  });
  it('preserves input after save failure and allows cancel', async () => {
    vi.mocked(dietaApi.updateProfile).mockRejectedValue(new Error('저장 실패'));
    show(); const input = await screen.findByLabelText('목표 체중 (kg)');
    fireEvent.change(input,{target:{value:'63'}}); fireEvent.click(screen.getByRole('button',{name:'목표 저장'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장 실패');
    expect(input).toHaveValue('63'); fireEvent.click(screen.getByRole('button',{name:'목표 변경 취소'}));
    expect(input).toHaveValue('65');
  });
  it('offers retry after initial load failure', async () => {
    vi.mocked(dietaApi.getProfile).mockRejectedValueOnce(new Error('연결 실패'));
    show(); expect(await screen.findByRole('alert')).toHaveTextContent('연결 실패');
    fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
    expect(await screen.findByLabelText('목표 체중 (kg)')).toBeInTheDocument();
  });
});
it('does not restore saved values over a newer server profile', async () => {
 vi.mocked(dietaApi.updateProfile).mockResolvedValue(mapProfile({...sampleProfile,targetWeightKg:64}));
 const view=show(); fireEvent.change(await screen.findByLabelText('목표 체중 (kg)'),{target:{value:'64'}});
 fireEvent.click(screen.getByRole('button',{name:'목표 저장'})); await screen.findByText('목표를 저장했어요.'); view.unmount();
 vi.mocked(dietaApi.getProfile).mockResolvedValue(mapProfile({...sampleProfile,targetWeightKg:64,weeklyTargetKg:0.8}));
 show(); expect(await screen.findByLabelText('주간 목표 변화 (kg)')).toHaveValue('0.8');
 expect(screen.queryByText(/저장하지 않은 변경이 있어요/)).not.toBeInTheDocument();
});

it('warns before reload after leaving settings with a retained draft', async () => {
 const view=show(); fireEvent.change(await screen.findByLabelText('목표 체중 (kg)'),{target:{value:'62'}}); view.unmount();
 const event=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
});
it('ignores a late save from an unmounted instance after a newer edit', async () => {
 let resolve!: (p: ReturnType<typeof mapProfile>) => void;
 vi.mocked(dietaApi.updateProfile).mockReturnValue(new Promise(r => {resolve=r;}));
 const first=show(); fireEvent.change(await screen.findByLabelText('목표 체중 (kg)'),{target:{value:'64'}}); fireEvent.click(screen.getByRole('button',{name:'목표 저장'})); first.unmount();
 const second=show(); fireEvent.change(await screen.findByLabelText('목표 체중 (kg)'),{target:{value:'62'}});
 await act(async()=>{resolve(mapProfile({...sampleProfile,targetWeightKg:64}));}); second.unmount();
 show(); expect(await screen.findByLabelText('목표 체중 (kg)')).toHaveValue('62');
});
it('clears a retained draft on logout', async () => {
 const first=show(); fireEvent.change(await screen.findByLabelText('목표 체중 (kg)'),{target:{value:'62'}}); first.unmount();
 auth.listeners.forEach(fn=>fn({accessToken:null,userId:null},{accessToken:'test',userId:'fixture'}));
 show(); expect(await screen.findByLabelText('목표 체중 (kg)')).toHaveValue('65');
});
it('does not reset data when the deletion confirmation is cancelled', async () => {
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 show(); fireEvent.click(await screen.findByRole('button',{name:'모든 기록 삭제 후 다시 시작'}));
 expect(confirm).toHaveBeenCalled(); expect(dietaApi.resetAll).not.toHaveBeenCalled(); confirm.mockRestore();
});
