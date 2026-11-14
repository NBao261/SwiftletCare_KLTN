import api from '@/lib/axios';
import type { ApiResponse, OpsMetrics, WorkOrder, WorkOrderStatus } from '@/types';

// GET /work-orders — houseId hoặc farmId; không truyền cả hai = mọi farm của người gọi
export interface WorkOrderListQuery {
  farmId?: string;
  houseId?: string;
  status?: WorkOrderStatus;
  // 'true' = chưa đóng/huỷ (OPEN, IN_PROGRESS, VERIFYING, AWAITING_APPROVAL)
  open?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export interface CreateWorkOrderInput {
  house_id: string;
  title: string;
  description?: string;
}

// OPS-FR-001…004, 009 — Work Order sửa chữa: Farm Owner mở tay, duyệt, mở lại, huỷ, giao lại; Domain Expert chỉ đọc
export const workOrderApi = {
  list: (query: WorkOrderListQuery) => api.get<ApiResponse<WorkOrder[]>>('/work-orders', { params: query }),
  getOne: (id: string) => api.get<ApiResponse<WorkOrder>>(`/work-orders/${id}`),
  create: (input: CreateWorkOrderInput) => api.post<ApiResponse<WorkOrder>>('/work-orders', input),
  approve: (id: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/approve`),
  reopen: (id: string, note: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/reopen`, { note }),
  cancel: (id: string, reason: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/cancel`, { reason }),
  reassign: (id: string, assigneeId: string) =>
    api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/reassign`, { assignee_id: assigneeId }),
  // MTTA, MTTR trên cảnh báo tạo trong [from, to) của farm hoặc nhà (BR-40)
  metrics: (query: { farmId: string; houseId?: string; from: string; to: string }) =>
    api.get<ApiResponse<OpsMetrics>>('/work-orders/metrics', { params: query }),
};
