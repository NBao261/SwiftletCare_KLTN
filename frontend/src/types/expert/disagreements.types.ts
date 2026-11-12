// Types cho màn hình Chuyên gia xem các ngày đánh giá lệch, độ đồng thuận và chỉnh mức chỉ số sức khỏe của nhà (EXPERT-FR-022, ANALYTICS-FR-014, BR-28)
import type {
  HealthIndicator,
  HealthLevel,
  HealthLevels,
  HealthRatingValue,
  HealthReason,
  HealthSource,
  HealthStatus,
} from '@/types/healthDay.types';

// Người chấm điểm thực địa tại nhà yến (BR-31, EXPERT-FR-012)
export type HealthDisagreementAssessorRole = 'FARM_OWNER' | 'FARM_TECHNICIAN';

// Một lượt chấm điểm lệch với trạng thái ảnh chụp của hệ thống lúc chấm
export interface HealthDisagreementItem {
  assessor: {
    full_name: string | null;
    role: HealthDisagreementAssessorRole;
  };
  rating: HealthRatingValue;
  snapshot_status: HealthRatingValue;
  snapshot_reasons: HealthReason[];
  snapshot_levels: Partial<Record<HealthSource, HealthLevel | null>>;
  note: string | null;
  at: string;
}

// Một ngày có ít nhất 1 lượt chấm điểm lệch với trạng thái hệ thống lúc chấm
export interface HealthDisagreementDay {
  day_id: string;
  house_id: string;
  house_name: string;
  date: string; // 'YYYY-MM-DD' giờ VN
  current_status: HealthStatus;
  current_reasons: HealthReason[];
  indicators: Partial<Record<HealthSource, HealthIndicator>>;
  disagreements: HealthDisagreementItem[];
}

// Tóm tắt mức chỉ số sức khỏe hiện tại của từng nhà yến trong phạm vi truy vấn (BR-28)
export interface HealthDisagreementHouseSummary {
  house_id: string;
  house_name: string;
  health_levels: HealthLevels;
}

// Phản hồi từ GET /health-reports/disagreements (api-spec HealthDisagreements)
export interface HealthDisagreementsResponse {
  from: string;
  to: string;
  houses: HealthDisagreementHouseSummary[];
  days: HealthDisagreementDay[];
}

// Phản hồi từ GET /health-reports/evaluation (api-spec HealthEvaluation — ANALYTICS-FR-014, NFR-14)
export interface HealthEvaluationResponse {
  from: string;
  to: string;
  role: HealthDisagreementAssessorRole | null;
  rated_count: number;
  insufficient_data_count: number;
  agreement: {
    value: number;
    ci_low: number;
    ci_high: number;
  } | null;
  weighted_kappa: number | null;
  gwet_ac1: number | null;
  confusion_matrix: {
    labels: HealthRatingValue[];
    rows: string;
    columns: string;
    counts: number[][];
  };
  false_alarm_rate: {
    combined: number | null;
    environment: number | null;
    air: number | null;
    flock: number | null;
    noise: number | null;
  };
  ratings: Array<{
    house_name: string;
    date: string;
    assessor: {
      full_name: string | null;
      role: string;
    };
    snapshot_status: HealthStatus;
    rating: HealthRatingValue;
    counted: boolean;
  }>;
}

// Tham số truy vấn GET /health-reports/disagreements & GET /health-reports/evaluation (bắt buộc có houseId hoặc farmId, tối đa 366 ngày)
export interface HealthDisagreementsQueryParams {
  houseId?: string;
  farmId?: string;
  from?: string;
  to?: string;
  role?: HealthDisagreementAssessorRole;
}
