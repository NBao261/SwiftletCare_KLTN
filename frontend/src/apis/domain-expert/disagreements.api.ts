import api from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  HealthDisagreementsQueryParams,
  HealthDisagreementsResponse,
  HealthEvaluationResponse,
} from '@/types/expert/disagreements.types';

// API gọi các endpoint đối chiếu ngày đánh giá lệch (EXPERT-FR-022) và độ đồng thuận chấm điểm (ANALYTICS-FR-014)
export const disagreementsApi = {
  // Lấy danh sách ngày lệch kèm mức chỉ số sức khỏe hiện tại của từng nhà (EXPERT-FR-022, BR-28)
  listDisagreements: (params: HealthDisagreementsQueryParams) =>
    api.get<ApiResponse<HealthDisagreementsResponse>>('/health-reports/disagreements', {
      params,
    }),

  // Lấy chỉ số đồng thuận (CI 95%, Weighted Kappa, Gwet's AC1) và tỷ lệ báo động giả theo nguồn (ANALYTICS-FR-014)
  getEvaluation: (params: HealthDisagreementsQueryParams) =>
    api.get<ApiResponse<HealthEvaluationResponse>>('/health-reports/evaluation', {
      params,
    }),
};
