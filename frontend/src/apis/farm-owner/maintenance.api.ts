import api from '@/lib/axios';
import type { ApiResponse, MaintenanceBasis, MaintenanceEquipment, MaintenancePlan, MaintenancePlanState } from '@/types';

// GET /maintenance/plans — houseId hoặc farmId; không truyền = mọi farm của người gọi; RETIRED chỉ hiện khi lọc state=RETIRED
export interface MaintenancePlanListQuery {
  farmId?: string;
  houseId?: string;
  state?: MaintenancePlanState;
  page?: number;
  limit?: number;
}

export interface CreateMaintenancePlanInput {
  house_id: string;
  equipment: MaintenanceEquipment;
  basis: MaintenanceBasis;
  interval: number;
  checklist_template: string[];
  source: string;
  note?: string;
}

// Nhà, thiết bị, cách tính không đổi được sau khi tạo
export type UpdateMaintenancePlanInput = Pick<CreateMaintenancePlanInput, 'interval' | 'checklist_template' | 'source' | 'note'>;

// OPS-FR-005, 006 — Farm Owner tạo, sửa, xoá kế hoạch; Domain Expert chỉ đọc và góp ý
export const maintenanceApi = {
  listPlans: (query: MaintenancePlanListQuery) =>
    api.get<ApiResponse<MaintenancePlan[]>>('/maintenance/plans', { params: query }),
  listDue: (query: { farmId?: string; houseId?: string }) =>
    api.get<ApiResponse<MaintenancePlan[]>>('/maintenance/due', { params: query }),
  create: (input: CreateMaintenancePlanInput) => api.post<ApiResponse<MaintenancePlan>>('/maintenance/plans', input),
  update: (id: string, input: UpdateMaintenancePlanInput) =>
    api.put<ApiResponse<MaintenancePlan>>(`/maintenance/plans/${id}`, input),
  retire: (id: string) => api.delete<ApiResponse<MaintenancePlan>>(`/maintenance/plans/${id}`),
  comment: (id: string, text: string) =>
    api.post<ApiResponse<MaintenancePlan>>(`/maintenance/plans/${id}/comments`, { text }),
};
