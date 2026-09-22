import api from '@/lib/axios'
import type { ApiResponse, User, Role, SalesAssignmentRequest } from '@/types'

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
  /** Bắt buộc ≥1 vùng */
  assigned_regions: string[]
}

export interface CreateSalesStaffInput {
  email: string; password: string; full_name: string; phone?: string
  /** Bắt buộc ≥1 farm đang tồn tại (backend kiểm tra trước khi tạo tài khoản) */
  farm_ids: string[]
}

export interface ListSalesStaffRequestsQuery {
  status?: SalesAssignmentRequest['status']
  type?: SalesAssignmentRequest['type']
  page?: number
  limit?: number
}

/**
 * Router `/admin` (backend/src/routes/admin.route.ts) — mọi endpoint đều
 * `requireRole('ADMIN')`. Không có DELETE /admin/users/:id: xoá tài khoản chỉ đi
 * qua hàng đợi delete-requests (AUTH-FR-012); cũng không có endpoint sửa
 * full_name/phone của người khác — Admin chỉ sửa được assigned_regions.
 */
export const adminApi = {
  // ── Tài khoản — AUTH-FR-011 / Flow 19 ──────────────────────────────────────
  listUsers: (query?: ListAdminUsersQuery) =>
    api.get<ApiResponse<User[]>>('/admin/users', { params: query }),

  /** Khoá cần `reason`; khoá Technician còn ticket mở → meta.openTickets để Admin gán lại */
  setUserStatus: (id: string, isActive: boolean, reason?: string) =>
    api.put<ApiResponse<User>>(`/admin/users/${id}/status`, { is_active: isActive, reason }),

  // ── Yêu cầu xoá — AUTH-FR-012 / Flow 19 bước 7-8 ────────────────────────────
  listDeleteRequests: (query?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<User[]>>('/admin/delete-requests', { params: query }),

  /** 409 HAS_OPEN_TICKETS (details.openTickets) nếu còn ticket mở và không force */
  completeDeleteRequest: (id: string, force = false) =>
    api.put<ApiResponse<User>>(`/admin/delete-requests/${id}/complete`, { force }),

  // ── Tạo tài khoản nhân viên — AUTH-FR-005c / Flow 16 bước 1a ────────────────
  createTechnician: (input: CreateTechnicianInput) =>
    api.post<ApiResponse<User>>('/admin/technicians', input),
  createSalesStaff: (input: CreateSalesStaffInput) =>
    api.post<ApiResponse<User>>('/admin/sales-staff', input),

  /** Flow 21 case 4a-x — có hiệu lực ngay ở request kế tiếp của Technician */
  updateTechnicianRegions: (id: string, assigned_regions: string[]) =>
    api.put<ApiResponse<User>>(`/admin/technicians/${id}/regions`, { assigned_regions }),

  /** Flow 16 case 1e — chỉ xoá bản ghi gán, không đụng tài khoản */
  unassignSalesStaff: (farmId: string, salesStaffId: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/admin/farms/${farmId}/sales-staff/${salesStaffId}`),

  // ── Duyệt đề xuất Sales Staff — AUTH-FR-005d / Flow 16 bước 1b ──────────────
  listSalesStaffRequests: (query?: ListSalesStaffRequestsQuery) =>
    api.get<ApiResponse<SalesAssignmentRequest[]>>('/admin/sales-staff-requests', { params: query }),

  /** REJECTED bắt buộc `reason` */
  decideSalesStaffRequest: (id: string, decision: 'APPROVED' | 'REJECTED', reason?: string) =>
    api.put<ApiResponse<SalesAssignmentRequest>>(`/admin/sales-staff-requests/${id}/decision`, { decision, reason }),
}
