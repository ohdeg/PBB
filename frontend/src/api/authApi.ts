import { apiClient } from './axios';
import type {
  ApiMessageResponse,
  EmailRequest,
  EmailVerifyRequest,
  FindEmailRequest,
  FindEmailResponse,
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
  PasswordChangeVerifyRequest,
  PasswordRequest,
  PasswordResetRequest,
  PasswordVerifyRequest,
  SignupRequest,
} from '../types/auth';

export const authApi = {
  requestSignupEmail(payload: EmailRequest) {
    return apiClient.post<ApiMessageResponse>(
      '/api/v1/auth/email/request',
      payload,
    );
  },

  verifySignupEmail(payload: EmailVerifyRequest) {
    return apiClient.post<ApiMessageResponse>(
      '/api/v1/auth/email/verify',
      payload,
    );
  },

  signup(payload: SignupRequest) {
    return apiClient.post<ApiMessageResponse>('/api/v1/auth/signup', payload);
  },

  login(payload: LoginRequest) {
    return apiClient.post<LoginResponse>('/api/v1/auth/login', payload);
  },

  logout() {
    return apiClient.post<ApiMessageResponse>('/api/v1/auth/logout');
  },

  findEmail(payload: FindEmailRequest) {
    return apiClient.post<FindEmailResponse>(
      '/api/v1/auth/find-email',
      payload,
    );
  },

  requestPasswordReset(payload: PasswordRequest) {
    return apiClient.post<ApiMessageResponse>(
      '/api/v1/auth/password/request',
      payload,
    );
  },

  verifyPasswordReset(payload: PasswordVerifyRequest) {
    return apiClient.post<ApiMessageResponse>(
      '/api/v1/auth/password/verify',
      payload,
    );
  },

  resetPassword(payload: PasswordResetRequest) {
    return apiClient.patch<ApiMessageResponse>(
      '/api/v1/auth/password/reset',
      payload,
    );
  },

  requestPasswordChange() {
    return apiClient.post<ApiMessageResponse>(
      '/api/v1/auth/password/change/request',
    );
  },

  verifyPasswordChange(payload: PasswordChangeVerifyRequest) {
    return apiClient.post<ApiMessageResponse>(
      '/api/v1/auth/password/change/verify',
      payload,
    );
  },

  changePassword(payload: PasswordChangeRequest) {
    return apiClient.patch<ApiMessageResponse>(
      '/api/v1/auth/password/change',
      payload,
    );
  },

  deleteAccount(payload: { password: string }) {
    return apiClient.delete<ApiMessageResponse>('/api/v1/auth/account', {
      data: payload,
    });
  },
};
