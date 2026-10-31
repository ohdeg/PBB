import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DietaHomePage } from './DietaHomePage';
import { dietaApi } from '../api/dietaApi';
import { mapProfile, type DietaProfileApi } from '../api/dietaMappers';
import { todayIsoDate } from '../features/dieta/utils/dietaMath';
vi.mock('../api/dietaApi', () => ({ dietaApi: {
  getProfile: vi.fn(), getMealQueue: vi.fn().mockResolvedValue(null), listBodyLogs: vi.fn(), listIntakes: vi.fn(), upsertBodyLog: vi.fn(), setMaintainMode: vi.fn(),
} }));
vi.mock('../stores/authStore', () => ({ useAuthStore: (select: (state: object) => unknown) =>
  select({ accessToken: 'session', userId: 'user', email: 'test@example.com' }) }));
vi.mock('../features/dieta/useDietaProposal', () => ({ useDietaProposal: () => ({
  proposal: null, pending: false, error: '', reload: vi.fn(),
}) }));

const sampleProfile: DietaProfileApi = {
  userId: '11111111-1111-1111-1111-111111111111',
  heightCm: 170,
  goalType: 'LOSS',
  lastNonMaintainGoalType: 'LOSS',
  weeklyTargetKg: 0.5,
  targetWeightKg: 65,
  weeklyBodyFatLossKg: 0.45,
  weeklyMuscleGainKg: null,
  intensityPreference: null,
  bmrKcal: 1600,
  bmrSource: 'ESTIMATED',
  activityFactor: 1.4,
  tdeeKcal: 2240,
  dietStyle: 'BALANCED',
  macros: { carbPct: 0.4, proteinPct: 0.3, fatPct: 0.3 },
  macrosCustomized: false,
  dietBaselineMethod: 'SURVEY',
  lossInitialDeficitKcal: 400,
  gainInitialSurplusKcal: 250,
  lossCutKcal: 175,
  lossRecoverKcal: 150,
  lossActivityKcal: 150,
  gainSurplusKcal: 250,
  gainCutKcal: 175,
  gainCeilingDeltaKcal: 500,
  geminiMealConsent: true,
  onboardingComplete: true,
  dailyKcal: 1840,
  weekStartsOn: '2026-07-20',
  weekActivityExtraKcal: 0,
  createdAt: '2026-07-20T00:00:00',
  updatedAt: '2026-07-27T00:00:00',
};

describe('Dieta daily target attainment', () => {
  it('enters maintain mode when a daily weight reaches the target before check-in is due', async () => {
    const profile = mapProfile({ ...sampleProfile, weekStartsOn: todayIsoDate(), targetWeightKg: 65 });
    vi.mocked(dietaApi.getProfile).mockResolvedValue(profile);
    vi.mocked(dietaApi.listBodyLogs).mockResolvedValue([]);
    vi.mocked(dietaApi.listIntakes).mockResolvedValue([]);
    vi.mocked(dietaApi.setMaintainMode).mockResolvedValue({ ...profile, goalType: 'MAINTAIN',
      dailyKcal: profile.tdeeKcal, weeklyTargetKg: 0 });
    render(<MemoryRouter><DietaHomePage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('오늘 체중 (kg)'), { target: { value: '65' } });
    fireEvent.click(screen.getByRole('button', { name: '체중 저장' }));
    expect(await screen.findByText('유지 중')).toBeInTheDocument();
    expect(screen.queryByText('감량 중')).not.toBeInTheDocument();
  });
});

afterEach(cleanup);
it('offers retry on a home load error', async () => {
 vi.mocked(dietaApi.getProfile).mockRejectedValueOnce(new Error('연결 실패'));
 render(<MemoryRouter><DietaHomePage /></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('연결 실패');
 expect(screen.getByRole('button',{name:'다시 시도'})).toBeInTheDocument();
});

it('redirects a new user before requesting profile-dependent logs', async () => {
 vi.mocked(dietaApi.getProfile).mockResolvedValue(null); vi.mocked(dietaApi.listIntakes).mockClear();
 render(<MemoryRouter><DietaHomePage /></MemoryRouter>);
 await new Promise(r=>setTimeout(r,20)); expect(dietaApi.listIntakes).not.toHaveBeenCalled();
});
