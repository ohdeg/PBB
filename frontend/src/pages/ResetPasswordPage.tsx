import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { AuthLayout, FormField } from '../components/AuthForm';
import { getErrorMessage } from '../utils/error';
import {
  isValidCode,
  isValidEmail,
  isValidPassword,
  PASSWORD_HINT,
} from '../utils/validation';

type ResetStep = 'email' | 'verify' | 'reset';

export function ResetPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setFieldError('');
    setFormError('');
    setFormSuccess('');
  };

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!isValidEmail(email)) {
      setFieldError('올바른 이메일 형식을 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.requestPasswordReset({
        email: email.trim(),
      });
      setFormSuccess(data.message || '인증 코드를 이메일로 발송했습니다.');
      setStep('verify');
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
      const { data } = await authApi.verifyPasswordReset({
        email: email.trim(),
        code: code.trim(),
      });
      setFormSuccess(data.message || '인증이 완료되었습니다. 새 비밀번호를 설정하세요.');
      setStep('reset');
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, '인증 코드가 올바르지 않습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
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
      await authApi.resetPassword({
        email: email.trim(),
        newPassword,
      });
      void navigate('/login', { replace: true });
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, '비밀번호 변경에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="비밀번호 재설정"
      subtitle={
        step === 'email'
          ? '가입한 이메일로 인증 코드를 받습니다.'
          : step === 'verify'
            ? '메일로 받은 6자리 코드를 입력하세요.'
            : '새 비밀번호를 설정하세요.'
      }
      footer={
        <>
          <Link to="/login">로그인</Link>
          <span aria-hidden="true">·</span>
          <Link to="/find-email">이메일 찾기</Link>
        </>
      }
    >
      {step === 'email' ? (
        <form className="auth-form" onSubmit={handleRequest} noValidate>
          <FormField
            id="reset-email"
            label="이메일"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            error={fieldError}
            disabled={loading}
          />
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '발송 중…' : '인증 코드 발송'}
          </button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form className="auth-form" onSubmit={handleVerify} noValidate>
          <FormField
            id="reset-email-readonly"
            label="이메일"
            type="email"
            value={email}
            onChange={setEmail}
            disabled
          />
          <FormField
            id="reset-code"
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
                resetMessages();
                setStep('email');
              }}
            >
              이메일 변경
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '검증 중…' : '코드 확인'}
            </button>
          </div>
        </form>
      ) : null}

      {step === 'reset' ? (
        <form className="auth-form" onSubmit={handleReset} noValidate>
          <FormField
            id="reset-new-password"
            label="새 비밀번호"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            hint={PASSWORD_HINT}
            autoComplete="new-password"
            disabled={loading}
          />
          <FormField
            id="reset-password-confirm"
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
    </AuthLayout>
  );
}
