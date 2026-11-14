import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, MaintenancePlan, MaintenancePlanState } from '@/types'

// Bộ lọc danh sách kế hoạch bảo trì
export interface MaintenancePlanListParams {
  farmId?: string
  houseId?: string
  state?: MaintenancePlanState
  page?: number
  limit?: number
}

// Bỏ trường trống để không gửi "undefined" lên query
function toQuery(params: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  )
}

// API bảo trì phòng ngừa (OPS-FR-005…008, G-22): Farm Owner, Domain Expert xem kế hoạch của các farm mình, Farm Technician của nhà
// được giao. Tạo, sửa, bỏ kế hoạch là việc của Farm Owner trên web; mobile chỉ đọc
export const maintenanceApi = {
  // Kế hoạch DUE và OVERDUE, quá hạn trước, kèm Work Order phòng ngừa đang mở (OPS-FR-006); không phân trang
  listDue: (params: { farmId?: string; houseId?: string } = {}) =>
    apiClient.get<ApiResponse<MaintenancePlan[]>>(ENDPOINTS.MAINTENANCE_DUE, { params: toQuery(params) }),

  // Mọi kế hoạch còn dùng (RETIRED chỉ hiện khi lọc state=RETIRED), phân trang theo meta
  listPlans: (params: MaintenancePlanListParams) =>
    apiClient.get<ApiResponse<MaintenancePlan[]>>(ENDPOINTS.MAINTENANCE_PLANS, { params: toQuery(params) }),
}
