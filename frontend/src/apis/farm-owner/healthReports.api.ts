import api from '@/lib/axios';
import type { ApiResponse, ZoneHealthReport } from '@/types';

// EXPERT-FR-005/006 — báo cáo sức khỏe Zone (Farm Owner chỉ đọc, kết luận do Domain Expert viết)
export const healthReportApi = {
  list: (zoneId: string, params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<ZoneHealthReport[]>>('/health-reports', { params: { zoneId, ...params } }),
};
