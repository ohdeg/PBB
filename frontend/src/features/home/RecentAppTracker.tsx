import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getNavHobbies } from '../../data/hobbies';
import { useAuthStore } from '../../stores/authStore';
import { findVisitedApp, recordRecentApp } from './homeRecentStorage';

export function RecentAppTracker() {
  const { pathname } = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.userId);
  const isDev = useAuthStore((state) => state.userClass === 'dev');
  useEffect(() => {
    if (!accessToken || !userId) return;
    const app = findVisitedApp(pathname, getNavHobbies(isDev));
    if (app) recordRecentApp(userId, app.id);
  }, [pathname, accessToken, userId, isDev]);
  return null;
}
