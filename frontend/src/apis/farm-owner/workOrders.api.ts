import api from '@/lib/axios';
import type { ApiResponse, ChecklistResult, OpsMetrics, SiteCause, WorkOrder, WorkOrderStatus } from '@/types';

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

// OPS-FR-002, ALERT-FR-018 — báo xong: nguyên nhân tìm thấy tại chỗ, việc đã làm, ảnh (multipart `photos`)
export interface CompleteWorkOrderInput {
  cause?: SiteCause;
  work_note?: string;
  photos: File[];
}

export interface CreateWorkOrderInput {
  house_id: string;
  title: string;
  description?: string;
}

// OPS-FR-001…004, 007, 009 — Work Order: Farm Owner mở tay, tự làm (bắt đầu, checklist, báo xong), duyệt, mở lại, huỷ, giao lại; Domain Expert chỉ đọc
export const workOrderApi = {
  list: (query: WorkOrderListQuery) => api.get<ApiResponse<WorkOrder[]>>('/work-orders', { params: query }),
  getOne: (id: string) => api.get<ApiResponse<WorkOrder>>(`/work-orders/${id}`),
  create: (input: CreateWorkOrderInput) => api.post<ApiResponse<WorkOrder>>('/work-orders', input),
  start: (id: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/start`),
  complete: (id: string, input: CompleteWorkOrderInput) => {
    const form = new FormData();
    if (input.cause) form.append('cause', input.cause);
    if (input.work_note) form.append('work_note', input.work_note);
    input.photos.forEach(photo => form.append('photos', photo));
    return api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/done`, form);
  },
  // OPS-FR-007 — kết quả 1 mục checklist của phiếu phòng ngừa đang làm (multipart, ảnh tuỳ chọn ở mobile)
  recordChecklist: (id: string, itemIndex: number, result: ChecklistResult) => {
    const form = new FormData();
    form.append('item_index', String(itemIndex));
    form.append('result', result);
    return api.put<ApiResponse<WorkOrder>>(`/work-orders/${id}/checklist`, form);
  },
  approve: (id: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/approve`),
  reopen: (id: string, note: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/reopen`, { note }),
  cancel: (id: string, reason: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/cancel`, { reason }),
  reassign: (id: string, assigneeId: string) =>
    api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/reassign`, { assignee_id: assigneeId }),
  // MTTA, MTTR trên cảnh báo tạo trong [from, to) của farm hoặc nhà (BR-40)
  metrics: (query: { farmId: string; houseId?: string; from: string; to: string }) =>
    api.get<ApiResponse<OpsMetrics>>('/work-orders/metrics', { params: query }),
};
