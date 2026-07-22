import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { bootstrapAuth } from './api/axios';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AppShell } from './components/AppShell';
import { RouteSplash } from './components/RouteSplash';
import { SplashScreen } from './components/SplashScreen';
import { StatusView } from './components/StatusView';
import { PageSeo } from './hooks/usePageSeo';
import { useAppStatusStore } from './stores/appStatusStore';
import { AnalysisPage } from './pages/AnalysisPage';
import { ErrorPage } from './pages/ErrorPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BrewNotePage } from './pages/BrewNotePage';
import { BrewStorePage } from './pages/BrewStorePage';
import { LottoPage } from './pages/LottoPage';
import { FindEmailPage } from './pages/FindEmailPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ScoreLibraryPage } from './pages/ScoreLibraryPage';
import { ScoreViewerPage } from './pages/ScoreViewerPage';
import { SignupPage } from './pages/SignupPage';

const MIN_BOOT_SPLASH_MS = 700;

/** 앱 전용 스플래시를 쓰는 경로 — PBB boot 스플래시 생략 */
function usesAppOwnedSplash(pathname: string): boolean {
  return (
    pathname.startsWith('/hobbies/brew-note')
    || pathname.startsWith('/hobbies/lotto')
  );
}

export default function App() {
  // 최초 진입 경로만 본다 (홈→Veveno 이동 시 boot 로직을 다시 돌리지 않음)
  const skipBootSplash = useRef(
    usesAppOwnedSplash(window.location.pathname),
  ).current;

  const [bootSplashVisible, setBootSplashVisible] = useState(!skipBootSplash);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();

    void bootstrapAuth().finally(() => {
      if (cancelled) {
        return;
      }
      if (skipBootSplash) {
        setAppReady(true);
        return;
      }
      const elapsed = performance.now() - startedAt;
      const wait = Math.max(0, MIN_BOOT_SPLASH_MS - elapsed);
      window.setTimeout(() => {
        if (!cancelled) {
          setBootSplashVisible(false);
        }
      }, wait);
    });

    return () => {
      cancelled = true;
    };
  }, [skipBootSplash]);

  return (
    <>
      {!skipBootSplash ? (
        <SplashScreen
          mode="boot"
          visible={bootSplashVisible}
          onExited={() => setAppReady(true)}
        />
      ) : null}
      {appReady ? (
        <AppErrorBoundary>
          <PageSeo />
          <RouteSplash />
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/error" element={<ErrorPage />} />
              <Route path="/hobbies/ipbt" element={<AnalysisPage />} />
              <Route
                path="/hobbies/analyze-baseball"
                element={<Navigate to="/hobbies/ipbt" replace />}
              />
              <Route path="/hobbies/brew-note" element={<BrewNotePage />} />
              <Route
                path="/hobbies/brew-note/stores/:storeId"
                element={<BrewStorePage />}
              />
              <Route path="/hobbies/lotto" element={<LottoPage />} />
              <Route path="/hobbies/score-viewer" element={<ScoreLibraryPage />} />
              <Route path="/hobbies/score-viewer/:id" element={<ScoreViewerPage />} />
              <Route
                path="/hobbies/pbb"
                element={<Navigate to="/hobbies/ipbt" replace />}
              />
              <Route
                path="/analysis"
                element={<Navigate to="/hobbies/ipbt" replace />}
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route
                path="/profile/change-password"
                element={<ChangePasswordPage />}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/find-email" element={<FindEmailPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Routes>
          <MaintenanceGate />
        </AppErrorBoundary>
      ) : null}
    </>
  );
}

/** axios가 503을 감지하면 전역 점검 화면을 덮어씌운다. */
function MaintenanceGate() {
  const maintenance = useAppStatusStore((state) => state.maintenance);
  const maintenanceMessage = useAppStatusStore(
    (state) => state.maintenanceMessage,
  );

  if (!maintenance) {
    return null;
  }

  return (
    <StatusView
      variant="maintenance"
      fullscreen
      message={maintenanceMessage ?? undefined}
      showHome={false}
      onRetry={() => window.location.reload()}
    />
  );
}
