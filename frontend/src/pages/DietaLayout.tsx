import { NavLink, Outlet } from 'react-router-dom';
import { Home, Utensils, Footprints, Settings } from 'lucide-react';
const NAV = [
  { to: '/hobbies/dieta/home', label: '홈', Icon: Home },
  { to: '/hobbies/dieta/meals', label: '식사', Icon: Utensils },
  { to: '/hobbies/dieta/activity', label: '활동', Icon: Footprints },
  { to: '/hobbies/dieta/settings', label: '설정', Icon: Settings },
];
export function DietaLayout() {
  return <div className="dieta-app">
    <a className="dieta-skip" href="#dieta-main">본문으로 바로가기</a>
    <div className="dieta-app-header"><NavLink to="/hobbies/dieta/home" className="dieta-wordmark">Dieta<span>하루의 기록, 한 주의 변화</span></NavLink>
      <nav className="dieta-nav" aria-label="Dieta">{NAV.map(({to,label,Icon}) => <NavLink key={to} to={to} className={({isActive}) => isActive ? 'is-active' : undefined}><Icon size={20} aria-hidden="true" />{label}</NavLink>)}</nav>
    </div>
    <main id="dieta-main" className="dieta-shell" tabIndex={-1}><Outlet /></main>
  </div>;
}
