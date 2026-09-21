import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type CreateTechnicianInput, type CreateSalesStaffInput } from '@/services/api'
import type { User, Role, UserStatus, SortDirection } from '@/types'

export type UsersSortKey = 'full_name' | 'email' | 'role' | 'status' | 'created_at'

/**
 * Trạng thái hiển thị — dẫn xuất từ 3 cờ backend (không có enum trên `users`).
 * Ưu tiên: đã xoá > đang chờ xoá > bị khoá > hoạt động.
 */
export function getUserStatus(user: User): UserStatus {
  if (user.deleted_at) return 'DELETED'
  if (user.deletion_requested_at) return 'PENDING_DELETION'
  if (!user.is_active) return 'LOCKED'
  return 'ACTIVE'
}

export interface ListUsersQuery {
  /**
   * Lọc gửi lên backend: ACTIVE → status=active, LOCKED → status=inactive.
   * Hàng đợi chờ xoá có trang riêng (useAccountRequests → /admin/delete-requests).
   */
  status?: Extract<UserStatus, 'ACTIVE' | 'LOCKED'>
  role?: Role
  /** Chỉ lọc CLIENT-SIDE trên trang hiện tại — /admin/users chưa có search */
  search?: string
  /** Chỉ sort CLIENT-SIDE trên trang hiện tại — /admin/users cố định created_at desc */
  sortBy?: UsersSortKey
  sortDir?: SortDirection
  page?: number
  limit?: number
}

function matchesSearch(user: User, search: string): boolean {
  const s = search.toLowerCase()
  return user.full_name.toLowerCase().includes(s) || user.email.toLowerCase().includes(s)
}

export function sortUsers(list: User[], sortKey?: UsersSortKey, sortDir: SortDirection = 'asc'): User[] {
  if (!sortKey) return list
  const dir = sortDir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    switch (sortKey) {
      case 'full_name': return a.full_name.localeCompare(b.full_name) * dir
      case 'email': return a.email.localeCompare(b.email) * dir
      case 'role': return a.role.localeCompare(b.role) * dir
      case 'status': return getUserStatus(a).localeCompare(getUserStatus(b)) * dir
      case 'created_at': return (a.created_at ?? '').localeCompare(b.created_at ?? '') * dir
      default: return 0
    }
  })
}

/** AUTH-FR-011 — GET /admin/users. */
export function useUsersList(query: ListUsersQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const result = useQuery({
    queryKey: ['admin-users', query.status, query.role, page, limit],
    queryFn: () => {
      const status = query.status === 'ACTIVE' ? 'active' : query.status === 'LOCKED' ? 'inactive' : undefined
      return adminApi.listUsers({ role: query.role, status, page, limit }).then(r => r.data)
    },
  })

  let records = result.data?.data ?? []
  if (query.search) records = records.filter(u => matchesSearch(u, query.search!))
  records = sortUsers(records, query.sortBy, query.sortDir)

  return {
    records,
    total: result.data?.meta?.total ?? 0,
    page: result.data?.meta?.page ?? page,
    limit: result.data?.meta?.limit ?? limit,
    isLoading: result.isLoading,
  }
}

/** Trần `limit` backend (utils/helpers.util.ts#paginate) — không lấy được nhiều hơn trong 1 request */
const PICKER_LIMIT = 100

/**
 * Danh sách người dùng cho các ô chọn (gán lại KTV, lọc actor nhật ký) — 1 trang
 * tối đa PICKER_LIMIT. Backend không có search nên không phân trang dropdown
 * được; khi `truncated` (total > số lấy về) UI phải báo để Admin biết danh sách
 * chưa đủ thay vì tưởng người đó không tồn tại.
 */
export function useUsersPicker(options: { role?: Role; activeOnly?: boolean } = {}) {
  const { role, activeOnly = false } = options
  const result = useQuery({
    queryKey: ['admin-users', 'picker', role ?? 'all', activeOnly],
    queryFn: () => adminApi.listUsers({ role, status: activeOnly ? 'active' : undefined, limit: PICKER_LIMIT }).then(r => r.data),
  })
  const records = result.data?.data ?? []
  const total = result.data?.meta?.total ?? records.length
  return { records, total, truncated: total > records.length, isLoading: result.isLoading }
}

/** Technician đang hoạt động để gán lại ticket (TicketDetailPage, TICKET-FR-005b) */
export function useTechniciansList() {
  return useUsersPicker({ role: 'TECHNICIAN', activeOnly: true })
}

/**
 * AUTH-FR-005c, Flow 16 bước 1a — Admin chỉ tạo được 2 loại tài khoản (RACI mục
 * 4.4: Farm Owner tự đăng ký/được mời, Admin là tài khoản gốc seed). Backend là
 * 2 endpoint riêng (POST /admin/technicians, POST /admin/sales-staff).
 */
export type AdminCreatableRole = Extract<Role, 'TECHNICIAN' | 'SALES_STAFF'>

export type CreateUserInput =
  | ({ role: 'TECHNICIAN' } & CreateTechnicianInput)
  | ({ role: 'SALES_STAFF' } & CreateSalesStaffInput)

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) => {
      const base = { email: input.email, password: input.password, full_name: input.full_name, phone: input.phone }
      return input.role === 'TECHNICIAN'
        ? adminApi.createTechnician({ ...base, assigned_regions: input.assigned_regions })
        : adminApi.createSalesStaff({ ...base, farm_ids: input.farm_ids })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export interface SetUserStatusResult {
  user: User
  /** Chỉ có khi khoá Technician còn ticket đang giao — Admin cần gán lại (TICKET-FR-005b) */
  openTickets?: number
}

/** AUTH-FR-011 — PUT /admin/users/:id/status. Khoá cần lý do, mở khoá không. */
export function useSetUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive, reason }: { id: string; isActive: boolean; reason?: string }): Promise<SetUserStatusResult> => {
      const res = await adminApi.setUserStatus(id, isActive, reason)
      const meta = res.data.meta as { openTickets?: number } | undefined
      return { user: res.data.data, openTickets: meta?.openTickets }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

/** AUTH-FR-005c, Flow 21 4a-x — PUT /admin/technicians/:id/regions (chỉ Technician). */
export function useUpdateTechnicianRegions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assigned_regions }: { id: string; assigned_regions: string[] }) =>
      adminApi.updateTechnicianRegions(id, assigned_regions),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}
