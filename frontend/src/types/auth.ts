export interface ApiMessageResponse {
  message: string;
}

export interface EmailRequest {
  email: string;
}

export interface EmailVerifyRequest {
  email: string;
  code: string;
}

export interface SignupConsentAgreement {
  key: string;
  agreed: boolean;
  version: string;
}

export interface SignupRequest {
  email: string;
  nickname: string;
  password: string;
  consents: SignupConsentAgreement[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface FindEmailRequest {
  nickname: string;
}

export interface FindEmailResponse {
  email: string;
}

export interface PasswordRequest {
  email: string;
}

export interface PasswordVerifyRequest {
  email: string;
  code: string;
}

export interface PasswordResetRequest {
  email: string;
  newPassword: string;
}

export interface PasswordChangeVerifyRequest {
  code: string;
}

export interface PasswordChangeRequest {
  newPassword: string;
}

export interface ApiErrorBody {
  message: string;
}
