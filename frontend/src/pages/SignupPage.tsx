import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { AuthLayout, FormField } from '../components/AuthForm';
import { SignupConsentPanel } from '../components/SignupConsentPanel';
import {
  areRequiredConsentsAgreed,
  createInitialConsentState,
  getActiveConsents,
  type ConsentKey,
} from '../data/consents';
import { getErrorMessage } from '../utils/error';
import {
  isValidCode,
  isValidEmail,
  isValidNickname,
  isValidPassword,
  NICKNAME_HINT,
  PASSWORD_HINT,
} from '../utils/validation';

type SignupStep = 'nickname' | 'email' | 'password' | 'consent';

const STEP_META: Record<
  SignupStep,
  { index: number; title: string; subtitle: string }
> = {
  nickname: {
    index: 1,
    title: '닉네임',
    subtitle: '서비스에서 사용할 닉네임을 입력하세요.',
  },
  email: {
    index: 2,
    title: '이메일 인증',
    subtitle: '이메일과 인증 코드를 확인한 뒤 다음으로 진행합니다.',
  },
  password: {
    index: 3,
    title: '비밀번호',
    subtitle: '안전한 비밀번호를 설정하세요.',
  },
  consent: {
    index: 4,
    title: '약관 동의',
    subtitle: '서비스 이용을 위해 필수 약관에 동의해 주세요.',
  },
};

export function SignupPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<SignupStep>('nickname');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [consents, setConsents] = useState(createInitialConsentState);

  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const current = STEP_META[step];

  const resetMessages = () => {
    setFieldError('');
    setFormError('');
    setFormSuccess('');
  };

  const goToStep = (next: SignupStep) => {
    resetMessages();
    setStep(next);
  };

  const handleConsentChange = (key: ConsentKey, agreed: boolean) => {
    setConsents((prev) => ({ ...prev, [key]: agreed }));
  };

  const handleAgreeAllActive = (agreed: boolean) => {
    setConsents((prev) => {
      const next = { ...prev };
      getActiveConsents().forEach((item) => {
        next[item.key] = agreed;
      });
      return next;
    });
  };

  const handleNicknameNext = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!isValidNickname(nickname)) {
      setFieldError(NICKNAME_HINT);
      return;
    }

    goToStep('email');
  };

  const handleRequestEmail = async () => {
    resetMessages();

    if (!isValidEmail(email)) {
      setFieldError('올바른 이메일 형식을 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.requestSignupEmail({
        email: email.trim(),
      });
      setEmailVerified(false);
      setCode('');
      setFormSuccess(data.message || '인증 코드를 이메일로 발송했습니다.');
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, '인증 코드 발송에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    resetMessages();

    if (!isValidEmail(email)) {
      setFieldError('올바른 이메일 형식을 입력해 주세요.');
      return;
    }
    if (!isValidCode(code)) {
      setFieldError('6자리 숫자 인증 코드를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.verifySignupEmail({
        email: email.trim(),
        code: code.trim(),
      });
      setEmailVerified(true);
      setFormSuccess(data.message || '이메일 인증이 완료되었습니다.');
    } catch (error: unknown) {
      setEmailVerified(false);
      setFormError(getErrorMessage(error, '인증 코드가 올바르지 않습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailNext = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!emailVerified) {
      setFormError('이메일 인증을 완료한 뒤 다음으로 이동할 수 있습니다.');
      return;
    }

    goToStep('password');
  };

  const handlePasswordNext = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!isValidPassword(password)) {
      setFieldError(PASSWORD_HINT);
      return;
    }
    if (password !== passwordConfirm) {
      setFieldError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    goToStep('consent');
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!areRequiredConsentsAgreed(consents)) {
      setFormError('필수 동의 항목에 모두 동의해 주세요.');
      return;
    }

    setLoading(true);
    try {
      await authApi.signup({
        email: email.trim(),
        nickname: nickname.trim(),
        password,
        consents: getActiveConsents().map((item) => ({
          key: item.key,
          agreed: consents[item.key],
          version: item.version,
        })),
      });
      void navigate('/login', { replace: true });
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, '회원가입에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="회원가입"
      subtitle={current.subtitle}
      footer={
        <>
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </>
      }
    >
      <div className="signup-progress" aria-label="회원가입 단계">
        {(['nickname', 'email', 'password', 'consent'] as const).map((key) => {
          const meta = STEP_META[key];
          const isActive = step === key;
          const isDone = current.index > meta.index;
          return (
            <div
              key={key}
              className={`signup-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
            >
              <span className="signup-step-index">{meta.index}</span>
              <span className="signup-step-label">{meta.title}</span>
            </div>
          );
        })}
      </div>

      <div key={step} className="signup-card-panel">
        {step === 'nickname' ? (
          <form className="auth-form" onSubmit={handleNicknameNext} noValidate>
            <FormField
              id="signup-nickname"
              label="닉네임"
              value={nickname}
              onChange={setNickname}
              hint={NICKNAME_HINT}
              autoComplete="nickname"
              error={fieldError}
              disabled={loading}
            />
            {formError ? (
              <p className="form-error" role="alert">
                {formError}
              </p>
            ) : null}
            <button type="submit" className="btn-primary">
              다음
            </button>
          </form>
        ) : null}

        {step === 'email' ? (
          <form className="auth-form" onSubmit={handleEmailNext} noValidate>
            <FormField
              id="signup-email"
              label="이메일"
              type="email"
              value={email}
              onChange={(value) => {
                setEmail(value);
                setEmailVerified(false);
              }}
              autoComplete="email"
              disabled={loading}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={loading}
              onClick={() => {
                void handleRequestEmail();
              }}
            >
              {loading ? '처리 중…' : '인증 코드 발송'}
            </button>
            <FormField
              id="signup-code"
              label="인증 코드"
              value={code}
              onChange={(value) => {
                setCode(value);
                setEmailVerified(false);
              }}
              placeholder="6자리 숫자"
              maxLength={6}
              error={fieldError}
              disabled={loading}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={loading || emailVerified}
              onClick={() => {
                void handleVerifyEmail();
              }}
            >
              {emailVerified ? '인증 완료' : loading ? '검증 중…' : '코드 확인'}
            </button>
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
                onClick={() => goToStep('nickname')}
              >
                이전
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !emailVerified}
              >
                다음
              </button>
            </div>
          </form>
        ) : null}

        {step === 'password' ? (
          <form className="auth-form" onSubmit={handlePasswordNext} noValidate>
            <FormField
              id="signup-password"
              label="비밀번호"
              type="password"
              value={password}
              onChange={setPassword}
              hint={PASSWORD_HINT}
              autoComplete="new-password"
              disabled={loading}
            />
            <FormField
              id="signup-password-confirm"
              label="비밀번호 확인"
              type="password"
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              autoComplete="new-password"
              error={fieldError}
              disabled={loading}
            />
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
                onClick={() => goToStep('email')}
              >
                이전
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                다음
              </button>
            </div>
          </form>
        ) : null}

        {step === 'consent' ? (
          <form className="auth-form" onSubmit={(event) => void handleSignup(event)} noValidate>
            <SignupConsentPanel
              consents={consents}
              onChange={handleConsentChange}
              onAgreeAllActive={handleAgreeAllActive}
              disabled={loading}
            />
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
                onClick={() => goToStep('password')}
              >
                이전
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !areRequiredConsentsAgreed(consents)}
              >
                {loading ? '가입 중…' : '회원가입 완료'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </AuthLayout>
  );
}
