import { useAuthStore } from '@/stores/authStore'
import type { Role } from '@/types'

/** Primitive dùng chung cho cả check inline (vd usePermission) lẫn RequireRole. */
function hasRole(role: Role | undefined, ...allowed: Role[]): boolean {
  return !!role && allowed.includes(role)
}

/**
 * true nếu user hiện tại có role nằm trong danh sách cho phép — dùng để ẩn/disable
 * các nút hành động mà backend đã chặn qua requireRole(...) ở route tương ứng.
 *
 * VD: const canCreateFarm = usePermission('FARM_OWNER', 'ADMIN')
 */
export function usePermission(...allowedRoles: Role[]): boolean {
  const role = useAuthStore(s => s.user?.role)
  return hasRole(role, ...allowedRoles)
}
