import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { AuthLayout, FormField } from '../components/AuthForm';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/authStore';
import { toast, useToastStore } from '../stores/toastStore';
import { getErrorMessage } from '../utils/error';
import { isValidEmail } from '../utils/validation';

function resolvePostLoginPath(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return '/';
  }
  return from;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const dismissToast = useToastStore((state) => state.dismiss);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit =
    isValidEmail(email.trim()) && password.length > 0 && !loading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError('');

    if (!isValidEmail(email)) {
      setEmailError('올바른 이메일 형식을 입력해 주세요.');
      toast('올바른 이메일을 입력해 주세요.', 'error');
      return;
    }
    if (!password) {
      toast('비밀번호를 입력해 주세요.', 'error');
      return;
    }

    setLoading(true);
    const loadingId = toast('로그인 중…', 'loading');
    try {
      const { data } = await authApi.login({
        email: email.trim(),
        password,
      });
      setAccessToken(data.accessToken);
      dismissToast(loadingId);
      toast('로그인했어요.', 'success');
      const state = location.state as { from?: unknown } | null;
      void navigate(resolvePostLoginPath(state?.from));
    } catch (error: unknown) {
      dismissToast(loadingId);
      toast(
        getErrorMessage(error, '이메일 혹은 비밀번호가 일치하지 않습니다.'),
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  const from = (location.state as { from?: unknown } | null)?.from;
  const resumeHint =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
      ? '로그인하면 방금 보던 화면으로 이어집니다.'
      : null;

  return (
    <AuthLayout
      title="로그인"
      subtitle={resumeHint ?? '이메일과 비밀번호로 들어와요.'}
      footer={
        <>
          <Link to="/signup">회원가입</Link>
          <span aria-hidden="true">·</span>
          <Link to="/find-email">이메일 찾기</Link>
          <span aria-hidden="true">·</span>
          <Link to="/reset-password">비밀번호 재설정</Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <FormField
          id="login-email"
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={emailError}
          disabled={loading}
        />
        <FormField
          id="login-password"
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={loading}
        />
        <Button type="submit" disabled={!canSubmit} className="w-full">
          {loading ? '로그인 중…' : '로그인'}
        </Button>
      </form>
    </AuthLayout>
  );
}
