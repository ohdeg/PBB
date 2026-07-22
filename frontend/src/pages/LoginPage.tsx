import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { AuthLayout, FormField } from '../components/AuthForm';
import { useAuthStore } from '../stores/authStore';
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setEmailError('');

    if (!isValidEmail(email)) {
      setEmailError('올바른 이메일 형식을 입력해 주세요.');
      return;
    }
    if (!password) {
      setFormError('비밀번호를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.login({
        email: email.trim(),
        password,
      });
      setAccessToken(data.accessToken);
      const state = location.state as { from?: unknown } | null;
      void navigate(resolvePostLoginPath(state?.from));
    } catch (error: unknown) {
      setFormError(
        getErrorMessage(error, '이메일 혹은 비밀번호가 일치하지 않습니다.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="로그인"
      subtitle="계정에 로그인하여 서비스를 이용하세요."
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
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
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
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </AuthLayout>
  );
}
