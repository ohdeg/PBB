import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { AuthLayout, FormField } from '../components/AuthForm';
import { Button } from '../components/ui/Button';
import { toast } from '../stores/toastStore';
import { getErrorMessage } from '../utils/error';
import { isValidNickname, NICKNAME_HINT } from '../utils/validation';

export function FindEmailPage() {
  const [nickname, setNickname] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = isValidNickname(nickname.trim()) && !loading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError('');
    setMaskedEmail('');

    if (!isValidNickname(nickname)) {
      setFieldError(NICKNAME_HINT);
      toast(NICKNAME_HINT, 'error');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.findEmail({
        nickname: nickname.trim(),
      });
      setMaskedEmail(data.email);
      toast('가입 이메일을 찾았어요.', 'success');
    } catch (error: unknown) {
      toast(
        getErrorMessage(error, '해당 닉네임의 계정을 찾을 수 없습니다.'),
        'error',
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
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
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
          <p className="m-0 rounded-[14px] bg-[color-mix(in_srgb,#34C759_12%,transparent)] px-4 py-3 text-[0.92rem] font-semibold text-[#34C759]" role="status">
            가입 이메일: {maskedEmail}
          </p>
        ) : null}
        <Button type="submit" disabled={!canSubmit} className="w-full">
          {loading ? '조회 중…' : '이메일 찾기'}
        </Button>
      </form>
    </AuthLayout>
  );
}
