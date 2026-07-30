import { useAuthStore } from '../../stores/authStore';

export function useDietaUserKey(): string {
  const userId = useAuthStore((s) => s.userId);
  const email = useAuthStore((s) => s.email);
  return userId ?? email ?? 'guest';
}
