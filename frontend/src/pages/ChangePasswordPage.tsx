import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { FormField } from '../components/AuthForm';
import { useAuthStore } from '../stores/authStore';
import { getErrorMessage } from '../utils/error';
import {
  isValidCode,
  isValidPassword,
  PASSWORD_HINT,
} from '../utils/validation';

type ChangePasswordStep = 'verify' | 'new-password';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const email = useAuthStore((state) => state.email);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [step, setStep] = useState<ChangePasswordStep>('verify');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!accessToken) {
    if (useAuthStore.getState().suppressLoginRedirect) {
      return null;
    }
    return <Navigate to="/login" replace />;
  }

  const resetMessages = () => {
    setFieldError('');
    setFormError('');
    setFormSuccess('');
  };

  const handleRequestCode = async () => {
    resetMessages();
    setLoading(true);
    try {
      const { data } = await authApi.requestPasswordChange();
      setCodeSent(true);
      setFormSuccess(data.message || '인증 코드를 이메일로 발송했습니다.');
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, '인증 코드 발송에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!isValidCode(code)) {
      setFieldError('6자리 숫자 인증 코드를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.verifyPasswordChange({ code: code.trim() });
      setFormSuccess(data.message || '이메일 인증이 완료되었습니다.');
      setStep('new-password');
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, '인증 코드가 올바르지 않습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!isValidPassword(newPassword)) {
      setFieldError(PASSWORD_HINT);
      return;
    }
    if (newPassword !== passwordConfirm) {
      setFieldError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword({ newPassword });
      clearAuth();
      void navigate('/login', { replace: true });
    } catch (error: unknown) {
      setFormError(
        getErrorMessage(error, '비밀번호 변경에 실패했습니다.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="profile-main">
      <h1>비밀번호 변경</h1>
      <p className="profile-lead">
        {step === 'verify'
          ? '이메일 인증 후 새 비밀번호를 설정합니다.'
          : '현재와 다른 새 비밀번호를 입력하세요. 변경 후 다시 로그인합니다.'}
      </p>

      {step === 'verify' ? (
        <form className="auth-form profile-change-password-form" onSubmit={handleVerify} noValidate>
          <FormField
            id="change-pw-email"
            label="이메일"
            type="email"
            value={email ?? ''}
            onChange={() => undefined}
            disabled
          />
          <FormField
            id="change-pw-code"
            label="인증 코드"
            value={code}
            onChange={setCode}
            placeholder="6자리 숫자"
            maxLength={6}
            error={fieldError}
            disabled={loading}
          />
          {formSuccess ? <p className="form-success">{formSuccess}</p> : null}
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="btn-row">
            <button
              type="button"
              className="btn-secondary"
              disabled={loading}
              onClick={() => {
                void handleRequestCode();
              }}
            >
              {loading ? '처리 중…' : codeSent ? '코드 재발송' : '인증 코드 발송'}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !codeSent}
            >
              {loading ? '처리 중…' : '코드 확인'}
            </button>
          </div>
        </form>
      ) : null}

      {step === 'new-password' ? (
        <form
          className="auth-form profile-change-password-form"
          onSubmit={handleChangePassword}
          noValidate
        >
          <FormField
            id="change-pw-new"
            label="새 비밀번호"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            hint={PASSWORD_HINT}
            autoComplete="new-password"
            disabled={loading}
          />
          <FormField
            id="change-pw-confirm"
            label="새 비밀번호 확인"
            type="password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
            error={fieldError}
            disabled={loading}
          />
          {formSuccess ? <p className="form-success">{formSuccess}</p> : null}
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      ) : null}
    </main>
  );
}
