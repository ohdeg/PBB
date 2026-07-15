export type UserClass = 'free' | 'dev';

export interface UserResponse {
  id: string;
  email: string;
  nickname: string;
  userClass: UserClass;
  createdAt: string;
}

export interface UpdateUserClassRequest {
  query: string;
  userClass: UserClass;
}
