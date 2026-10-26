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

export interface CreateTechnicianInput {
  email: string; password: string; full_name: string; phone?: string
}

/**
 * Router `/admin` (backend/src/routes/admin.route.ts) — mọi endpoint đều
 * `requireRole('ADMIN')`. Không có DELETE /admin/users/:id: xoá tài khoản chỉ đi
 * qua hàng đợi delete-requests (AUTH-FR-012); cũng không có endpoint sửa
 * hồ sơ người khác (AUTH-FR-005c: chỉ tạo Technician và cấp lại mật khẩu tạm).
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

  // ── Tạo tài khoản nhân viên — AUTH-FR-005c / Flow 16 bước 1a ────────────────
  createTechnician: (input: CreateTechnicianInput) =>
    api.post<ApiResponse<User>>('/admin/technicians', input),
}
