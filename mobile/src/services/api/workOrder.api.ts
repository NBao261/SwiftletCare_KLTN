import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, CompleteWorkOrderInput, WorkOrder, WorkOrderStatus } from '@/types'
import { buildPhotoPart } from '@/utils/workOrder.utils'

// Bộ lọc GET /work-orders: assigneeId 'me' = Work Order giao cho chính người gọi; open 'true' = chưa đóng, chưa huỷ
export interface WorkOrderListParams {
  farmId?: string
  houseId?: string
  alertId?: string
  assigneeId?: string
  status?: WorkOrderStatus
  open?: 'true' | 'false'
  page?: number
  limit?: number
}

// Bỏ trường trống để không gửi "undefined" lên query
function toQuery(params: WorkOrderListParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  )
}

// API Work Order sửa chữa (OPS-FR-001…004, G-21). Farm Technician chỉ thấy và làm Work Order của nhà được giao (nhà khác 403);
// duyệt, mở lại, huỷ, giao lại chỉ Farm Owner, trên web
export const workOrderApi = {
  // Mới mở trước, phân trang theo meta
  list: (params: WorkOrderListParams) =>
    apiClient.get<ApiResponse<WorkOrder[]>>(ENDPOINTS.WORK_ORDERS, { params: toQuery(params) }),

  // Chi tiết kèm photo_urls (URL tạm 1 giờ) và lịch sử trạng thái
  getDetail: (workOrderId: string) => apiClient.get<ApiResponse<WorkOrder>>(ENDPOINTS.WORK_ORDER_DETAIL(workOrderId)),

  // OPEN → IN_PROGRESS; trạng thái khác 409
  start: (workOrderId: string) => apiClient.post<ApiResponse<WorkOrder>>(ENDPOINTS.WORK_ORDER_START(workOrderId)),

  // IN_PROGRESS → VERIFYING (BR-41), không gắn cảnh báo thì AWAITING_APPROVAL. Có ảnh thì gửi multipart (field photos, tối đa 5),
  // không thì JSON; thiếu nguyên nhân của cảnh báo thiết bị thì 422 (ALERT-FR-018)
  complete: (workOrderId: string, { cause, workNote, photos }: CompleteWorkOrderInput) => {
    const url = ENDPOINTS.WORK_ORDER_DONE(workOrderId)
    if (photos.length === 0) return apiClient.post<ApiResponse<WorkOrder>>(url, { cause, work_note: workNote })
    const form = new FormData()
    if (cause) form.append('cause', cause)
    if (workNote) form.append('work_note', workNote)
    photos.forEach((photo, index) => form.append('photos', buildPhotoPart(photo, `work-order-${index + 1}`)))
    return apiClient.post<ApiResponse<WorkOrder>>(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
