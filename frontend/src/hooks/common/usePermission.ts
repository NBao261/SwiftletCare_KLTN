import { useAuthStore } from '@/stores/authStore'
import type { Role } from '@/types'

// Primitive dùng chung cho cả check inline (vd usePermission) lẫn RequireRole.
function hasRole(role: Role | undefined, ...allowed: Role[]): boolean {
  return !!role && allowed.includes(role)
}

// Ẩn hoặc khoá nút mà backend đã chặn bằng requireRole
export function usePermission(...allowedRoles: Role[]): boolean {
  const role = useAuthStore(s => s.user?.role)
  return hasRole(role, ...allowedRoles)
}
