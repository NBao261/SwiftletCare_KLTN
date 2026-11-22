import api from '@/lib/axios'
import type { ApiResponse, User, Role } from '@/types'

// GET /admin/users: backend chỉ lọc theo role + is_active, sort cố định created_at desc.
export interface ListAdminUsersQuery {
  role?: Role
  // active = is_active:true, inactive = is_active:false (khoá kỷ luật hoặc đã xoá)
  status?: 'active' | 'inactive'
  page?: number
  limit?: number
}

// POST /admin/farm-owners: e-mail đã có tài khoản (mọi role) trả 409
export interface CreateFarmOwnerInput {
  email: string
  full_name: string
  phone?: string
}

// Router `/admin` (backend/src/routes/admin.route.ts): mọi endpoint đều `requireRole('ADMIN')`. Không có DELETE /admin/users/:id: xoá tài khoản chỉ đi qua hàng đợi delete-requests. POST /admin/technicians và PUT /admin/technicians/:id/password đã bị xoá khỏi backend (f9d9522). Farm Technician được Farm Owner mời qua POST /farms/:id/members với role FARM_TECHNICIAN.
export const adminApi = {
  // Tài khoản
  listUsers: (query?: ListAdminUsersQuery) =>
    api.get<ApiResponse<User[]>>('/admin/users', { params: query }),

  // Khoá cần `reason`
  setUserStatus: (id: string, isActive: boolean, reason?: string) =>
    api.put<ApiResponse<User>>(`/admin/users/${id}/status`, { is_active: isActive, reason }),

  // Tạo Farm Owner: mật khẩu tạm gửi qua e-mail, phải đổi ở lần đăng nhập đầu
  createFarmOwner: (input: CreateFarmOwnerInput) =>
    api.post<ApiResponse<User & { temporary_password_emailed: boolean }>>('/admin/farm-owners', input),

  // Yêu cầu xoá
  listDeleteRequests: (query?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<User[]>>('/admin/delete-requests', { params: query }),

  completeDeleteRequest: (id: string) =>
    api.put<ApiResponse<User>>(`/admin/delete-requests/${id}/complete`),

  // Admin "completes or rejects"; lý do bắt buộc, gửi lại cho người yêu cầu
  rejectDeleteRequest: (id: string, reason: string) =>
    api.put<ApiResponse<User>>(`/admin/delete-requests/${id}/reject`, { reason }),
}
