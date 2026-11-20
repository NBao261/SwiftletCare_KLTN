// G-24 — luật khuyến nghị và khuyến nghị của nhà (EXPERT-FR-016…019, BR-42, Report 3 §6.21); api-spec RecommendationRule, Recommendation
import type { FuzzyNumericKey, Thresholds } from '@/types/farm.types';

// Chỉ số theo ngày của nhà mà luật xét
export type RecommendationIndicator = 'TIME_IN_RANGE' | 'AIR_HOURS_OVER' | 'RETURN_RATE' | 'NOISE_EPISODES' | 'MISTING_INEFFECTIVE';
// GTE: chỉ số ≥ giá trị · LTE: chỉ số ≤ giá trị
export type RecommendationComparison = 'GTE' | 'LTE';
export type RecommendationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'MEASURED';

// WORK_ORDER: mở một phiếu sửa chữa có tiêu đề · PARAMETER_CHANGE: đổi một ngưỡng hoặc hệ số mờ của mọi zone trong nhà
export type RecommendationAction =
  | { type: 'WORK_ORDER'; title: string }
  | { type: 'PARAMETER_CHANGE'; group: 'thresholds'; key: keyof Thresholds; value: number }
  | { type: 'PARAMETER_CHANGE'; group: 'fuzzy'; key: FuzzyNumericKey; value: number };

export interface RecommendationRuleInput {
  name: string;
  indicator: RecommendationIndicator;
  comparison: RecommendationComparison;
  value: number;
  window_days: number;
  action: RecommendationAction;
  // Luật lấy từ đâu (phỏng vấn, tài liệu) — bắt buộc, không tự viết luật
  source: string;
  active: boolean;
}

export interface RecommendationRule extends RecommendationRuleInput {
  _id: string;
  farm_id: string;
  author_id: string;
  // BR-22 — luật Farm Owner viết trên farm có chuyên gia: tắt, chờ chuyên gia bật
  pending_approval?: boolean;
  created_at: string;
  updated_at: string;
}

// EXPERT-FR-019 — một dòng mỗi luật
export interface RecommendationRuleEffect {
  rule_id: string;
  name: string;
  indicator: RecommendationIndicator;
  active: boolean;
  raised: number;
  accepted: number;
  measured: number;
  improved: number;
}

export interface RecommendationEvidenceDay {
  date: string;
  value: number | null;
}

export interface Recommendation {
  _id: string;
  farm_id: string;
  house_id: string;
  // Ở danh sách backend kèm tên và hành động của luật
  rule_id: { _id: string; name: string; action: RecommendationAction } | string;
  // Luật lúc khuyến nghị mở; chấp nhận làm theo bản này (khuyến nghị mở trước 17/11/2026 không có)
  rule_snapshot?: {
    name: string;
    indicator: RecommendationIndicator;
    comparison: RecommendationComparison;
    value: number;
    window_days: number;
    action: RecommendationAction;
  };
  status: RecommendationStatus;
  evidence: {
    indicator: RecommendationIndicator;
    comparison: RecommendationComparison;
    value: number;
    window_days: number;
    days: RecommendationEvidenceDay[];
  };
  raised_at: string;
  // Ngày (giờ VN) luật thoả
  raised_for: string;
  decided_by?: string;
  decided_at?: string;
  expired_at?: string;
  reject_reason?: string;
  work_order_id?: string;
  review_ids?: string[];
  // Trung bình 7 ngày sau trừ 7 ngày trước ngày chấp nhận; null khi thiếu số
  effect?: { before: number | null; after: number | null; change: number | null; improved: boolean | null; measured_at: string };
}
