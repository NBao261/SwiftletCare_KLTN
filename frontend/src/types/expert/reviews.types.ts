/**
 * reviews.types.ts — Types cho mục duyệt tham số và đề xuất hệ số mờ (G-04)
 * SRS: EXPERT-FR-010, EXPERT-FR-011; Report 3 §6.10, §6.11
 */

export type ParameterReviewGroup = 'thresholds' | 'fuzzy';

export type ParameterReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REVERTED' | 'ADJUSTED';

export interface ParameterReview {
  _id: string;
  zone_id: string;
  farm_id: string;
  group: ParameterReviewGroup;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  status: ParameterReviewStatus;
  changed_by: string | { _id: string; full_name?: string; email?: string };
  reviewed_by?: string | { _id: string; full_name?: string; email?: string } | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CoefficientProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';

export interface FuzzyPredictedImpact {
  inRangeNow?: number;
  inRangeSuggested?: number;
  mistingNow?: number;
  mistingSuggested?: number;
  in_range_pct?: number;
  fan_runtime_pct?: number;
  misting_runtime_pct?: number;
}

export interface CoefficientProposal {
  _id: string;
  zone_id: string;
  farm_id: string;
  submitted_by: string | { _id: string; full_name?: string; email?: string };
  suggested_values: {
    fuzzy_humidity_band?: number;
    fuzzy_temp_band?: number;
    fuzzy_fan_dry_level?: number;
    fuzzy_window_sec?: number;
    fuzzy_input_filter?: boolean;
    [key: string]: unknown;
  };
  current_values: {
    fuzzy_humidity_band?: number;
    fuzzy_temp_band?: number;
    fuzzy_fan_dry_level?: number;
    fuzzy_window_sec?: number;
    fuzzy_input_filter?: boolean;
    [key: string]: unknown;
  };
  predicted?: FuzzyPredictedImpact | null;
  status: CoefficientProposalStatus;
  note?: string | null;
  decided_by?: string | { _id: string; full_name?: string; email?: string } | null;
  decided_at?: string | null;
  created_at: string;
}

export interface ParameterReviewsQueryParams {
  farmId: string;
  zoneId?: string;
  status?: ParameterReviewStatus;
  page?: number;
  limit?: number;
}

export interface CoefficientProposalsQueryParams {
  farmId: string;
  zoneId?: string;
  status?: CoefficientProposalStatus;
  page?: number;
  limit?: number;
}

export interface ReviewsResponse<T> {
  success: boolean;
  data: T[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}
