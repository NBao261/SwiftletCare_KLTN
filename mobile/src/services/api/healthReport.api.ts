import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, ZoneHealthReport } from '@/types'

// API báo cáo sức khoẻ (EXPERT-FR-005/006)
export const healthReportApi = {
  getDetail: (reportId: string) => apiClient.get<ApiResponse<ZoneHealthReport>>(ENDPOINTS.HEALTH_REPORT_DETAIL(reportId)),
}
