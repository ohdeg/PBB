import { apiClient } from './axios';
import type { UpdateUserClassRequest, UserResponse } from '../types/user';
import type {
  FeaturedAppResponse,
  UpdateFeaturedAppRequest,
} from '../types/config';

export const devApi = {
  searchUsers(query: string) {
    return apiClient.get<UserResponse[]>('/api/v1/dev/users', {
      params: { q: query },
    });
  },

  updateUserClass(payload: UpdateUserClassRequest) {
    return apiClient.patch<UserResponse>('/api/v1/dev/users/class', payload);
  },

  updateFeaturedApp(payload: UpdateFeaturedAppRequest) {
    return apiClient.put<FeaturedAppResponse>('/api/v1/dev/featured-app', payload);
  },
};
