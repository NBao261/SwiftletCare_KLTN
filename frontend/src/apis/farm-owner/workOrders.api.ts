import api from '@/lib/axios';
import type { ApiResponse, ChecklistResult, OpsMetrics, SiteCause, WorkOrder, WorkOrderStatus } from '@/types';

// GET /work-orders: houseId hoặc farmId; không truyền cả hai = mọi farm của người gọi
export interface WorkOrderListQuery {
  farmId?: string;
  houseId?: string;
  status?: WorkOrderStatus;
  // 'true' = chưa đóng/huỷ (OPEN, IN_PROGRESS, VERIFYING, AWAITING_APPROVAL)
  open?: 'true' | 'false';
  // 'me' = phiếu giao cho người gọi (kỹ thuật viên)
  assigneeId?: string;
  page?: number;
  limit?: number;
}

// báo xong: nguyên nhân tìm thấy tại chỗ, việc đã làm, ảnh (multipart `photos`)
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

// Domain Expert chỉ đọc
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
    // Tới 5 ảnh × 5 MB trên mạng nhà yến: timeout riêng thay cho 10 s mặc định của axios
    return api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/done`, form, { timeout: 120_000 });
  },
  // Backend xoá ghi chú khi không gửi `note`, nên ghi lại một mục phải gửi kèm ghi chú đang có
  recordChecklist: (id: string, itemIndex: number, result: ChecklistResult, note?: string | null) => {
    const form = new FormData();
    form.append('item_index', String(itemIndex));
    form.append('result', result);
    if (note) form.append('note', note);
    return api.put<ApiResponse<WorkOrder>>(`/work-orders/${id}/checklist`, form);
  },
  approve: (id: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/approve`),
  reopen: (id: string, note: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/reopen`, { note }),
  cancel: (id: string, reason: string) => api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/cancel`, { reason }),
  reassign: (id: string, assigneeId: string) =>
    api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/reassign`, { assignee_id: assigneeId }),
  // MTTA, MTTR trên cảnh báo tạo trong [from, to) của farm hoặc nhà
  metrics: (query: { farmId: string; houseId?: string; from: string; to: string }) =>
    api.get<ApiResponse<OpsMetrics>>('/work-orders/metrics', { params: query }),
};
