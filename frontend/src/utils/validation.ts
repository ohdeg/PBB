/** Front/Back 공통 예정 비밀번호: 8~16자, 영문+숫자+특수문자 */
export const PASSWORD_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+=\[\]{};':"\\|,.<>/?-]).{8,16}$/;

/** 닉네임: 영문, 숫자, 한글, 밑줄만 허용 (2~20자) */
export const NICKNAME_REGEX = /^[A-Za-z0-9가-힣_]{2,20}$/;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isValidNickname(nickname: string): boolean {
  return NICKNAME_REGEX.test(nickname.trim());
}

export function isValidPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}

export function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

export const PASSWORD_HINT =
  '8~16자, 영문·숫자·특수문자를 모두 포함해야 합니다.';

export const NICKNAME_HINT =
  '2~20자, 영문·숫자·한글·밑줄(_)만 사용할 수 있습니다.';
