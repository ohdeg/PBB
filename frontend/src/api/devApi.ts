import { apiClient } from './axios';
import type { UpdateUserClassRequest, UserResponse } from '../types/user';

export const devApi = {
  searchUsers(query: string) {
    return apiClient.get<UserResponse[]>('/api/v1/dev/users', {
      params: { q: query },
    });
  },

  updateUserClass(payload: UpdateUserClassRequest) {
    return apiClient.patch<UserResponse>('/api/v1/dev/users/class', payload);
  },
};
