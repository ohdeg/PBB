import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { bootstrapAuth } from './api/axios';
import { AppShell } from './components/AppShell';
import { RouteSplash } from './components/RouteSplash';
import { SplashScreen } from './components/SplashScreen';
import { AnalysisPage } from './pages/AnalysisPage';
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

export default function App() {
  const [bootSplashVisible, setBootSplashVisible] = useState(true);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();

    void bootstrapAuth().finally(() => {
      if (cancelled) return;
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
  }, []);

  return (
    <>
      <SplashScreen
        mode="boot"
        visible={bootSplashVisible}
        onExited={() => setAppReady(true)}
      />
      {appReady ? (
        <>
          <RouteSplash />
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/hobbies/analyze-baseball" element={<AnalysisPage />} />
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
                element={<Navigate to="/hobbies/analyze-baseball" replace />}
              />
              <Route
                path="/analysis"
                element={<Navigate to="/hobbies/analyze-baseball" replace />}
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route
                path="/profile/change-password"
                element={<ChangePasswordPage />}
              />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/find-email" element={<FindEmailPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </>
      ) : null}
    </>
  );
}
