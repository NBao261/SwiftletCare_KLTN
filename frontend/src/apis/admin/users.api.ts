import api from '@/lib/axios'
import type { ApiResponse, User, Role } from '@/types'

/** GET /admin/users — backend chỉ lọc theo role + is_active, sort cố định created_at desc. */
export interface ListAdminUsersQuery {
  role?: Role
  /** active = is_active:true, inactive = is_active:false (khoá kỷ luật hoặc đã xoá) */
  status?: 'active' | 'inactive'
  page?: number
  limit?: number
}

/**
 * Router `/admin` (backend/src/routes/admin.route.ts) — mọi endpoint đều
 * `requireRole('ADMIN')`. Không có DELETE /admin/users/:id: xoá tài khoản chỉ đi
 * qua hàng đợi delete-requests (AUTH-FR-012).
 * G-20: POST /admin/technicians và PUT /admin/technicians/:id/password đã bị xoá khỏi backend (f9d9522).
 * Farm Technician được Farm Owner mời qua POST /farms/:id/members với role FARM_TECHNICIAN.
 */
export const adminApi = {
  // ── Tài khoản — AUTH-FR-011 / Flow 19 ──────────────────────────────────────
  listUsers: (query?: ListAdminUsersQuery) =>
    api.get<ApiResponse<User[]>>('/admin/users', { params: query }),

  /** Khoá cần `reason` */
  setUserStatus: (id: string, isActive: boolean, reason?: string) =>
    api.put<ApiResponse<User>>(`/admin/users/${id}/status`, { is_active: isActive, reason }),

  // ── Yêu cầu xoá — AUTH-FR-012 / Flow 19 bước 7-8 ────────────────────────────
  listDeleteRequests: (query?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<User[]>>('/admin/delete-requests', { params: query }),

  completeDeleteRequest: (id: string) =>
    api.put<ApiResponse<User>>(`/admin/delete-requests/${id}/complete`),
}
