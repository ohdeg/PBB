import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DietaOnboardingPage } from './DietaOnboardingPage';
vi.mock('../stores/authStore', () => ({useAuthStore:(select:(s:object)=>unknown)=>select({accessToken:'test',userId:'fixture'})}));
vi.mock('../api/dietaApi', () => ({dietaApi:{completeOnboarding:vi.fn()}}));
afterEach(cleanup);
it('keeps invalid basic input on the same step with an accessible error', () => {
 render(<MemoryRouter><DietaOnboardingPage /></MemoryRouter>);
 fireEvent.change(screen.getByLabelText('키 (cm)'),{target:{value:'-1'}});
 fireEvent.click(screen.getByRole('button',{name:'다음'}));
 expect(screen.getByRole('alert')).toHaveTextContent('0보다 큰');
 expect(screen.getByLabelText('키 (cm)')).toBeInTheDocument();
});
it('shows a personal daily preview and hides advanced knobs by default', () => {
 render(<MemoryRouter><DietaOnboardingPage /></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'다음'}));
 fireEvent.click(screen.getByRole('button',{name:'다음'}));
 fireEvent.click(screen.getByRole('button',{name:'다음'}));
 // 70kg, 170cm, age30, M => BMR1618, TDEE2103, loss1703.
 expect(screen.getByText(/1,703 kcal/)).toBeInTheDocument();
 expect(screen.getByText('고급 조절').closest('details')).not.toHaveAttribute('open');
});
