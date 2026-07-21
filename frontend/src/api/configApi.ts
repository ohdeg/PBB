import { apiClient } from './axios';
import type { FeaturedAppResponse } from '../types/config';

export const configApi = {
  getFeaturedApps() {
    return apiClient.get<FeaturedAppResponse>('/api/v1/config/featured-app');
  },
};
