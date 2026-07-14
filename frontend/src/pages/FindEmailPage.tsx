import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { AuthLayout, FormField } from '../components/AuthForm';
import { getErrorMessage } from '../utils/error';
import { isValidNickname, NICKNAME_HINT } from '../utils/validation';

export function FindEmailPage() {
  const [nickname, setNickname] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError('');
    setFormError('');
    setMaskedEmail('');

    if (!isValidNickname(nickname)) {
      setFieldError(NICKNAME_HINT);
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.findEmail({
        nickname: nickname.trim(),
      });
      setMaskedEmail(data.email);
    } catch (error: unknown) {
      setFormError(
        getErrorMessage(error, '해당 닉네임의 계정을 찾을 수 없습니다.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="이메일 찾기"
      subtitle="가입 시 사용한 닉네임으로 이메일을 조회합니다."
      footer={
        <>
          <Link to="/login">로그인</Link>
          <span aria-hidden="true">·</span>
          <Link to="/reset-password">비밀번호 재설정</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="find-nickname"
          label="닉네임"
          value={nickname}
          onChange={setNickname}
          hint={NICKNAME_HINT}
          error={fieldError}
          disabled={loading}
        />
        {maskedEmail ? (
          <p className="form-success" role="status">
            가입 이메일: <strong>{maskedEmail}</strong>
          </p>
        ) : null}
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '조회 중…' : '이메일 찾기'}
        </button>
      </form>
    </AuthLayout>
  );
}
