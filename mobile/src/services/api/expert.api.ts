import { ENDPOINTS } from '@/constants/apiEndpoints'
import { apiClient } from '@/services/api/apiClient'
import type { ApiResponse } from '@/types'
import type {
  AlertEvidence,
  CoefficientProposal,
  ExpertActivityEntry,
  ExpertDetectionTuning,
  ExpertFuzzyTuning,
  ExpertThresholds,
  ExpertVerdictStats,
  FuzzySuggestionResponse,
  HouseHealthReport,
  HouseHealthReportKind,
  HouseHealthReportSummary,
  InferredAlert,
  ProposalStatus,
  ReviewItem,
  ReviewItemStatus,
  VerdictResult,
} from '@/types/expert.types'

// Tham số lọc danh sách cảnh báo suy luận
export interface InferredAlertsQueryParams {
  farm_id?: string
  zone_id?: string
  verdict?: 'pending' | 'confirmed' | 'rejected'
  type?: string
  severity?: string
  page?: number
  limit?: number
}

// Tham số lọc danh sách nhật ký hoạt động
export interface ExpertActivityQueryParams {
  action?: string
  page?: number
  limit?: number
}

/**
 * Service gọi API chuyên biệt cho vai trò Chuyên gia (Domain Expert).
 * Tuân thủ docs/api/api-spec.yaml và SRS Report 3 v3.1.0 (EXPERT-FR-*).
 */
export const expertApi = {
  // ── 1. Kiểm chứng Cảnh báo suy luận (EXPERT-FR-003, ALERT-FR-007, ALERT-FR-014) ──
  getInferredAlerts: (params?: InferredAlertsQueryParams) =>
    apiClient.get<ApiResponse<InferredAlert[]>>(ENDPOINTS.ALERTS, {
      params: {
        farmId: params?.farm_id,
        zoneId: params?.zone_id,
        verdict: params?.verdict,
        type: params?.type,
        severity: params?.severity,
        page: params?.page,
        limit: params?.limit,
      },
    }),

  getAlertEvidence: (alertId: string) =>
    apiClient.get<ApiResponse<AlertEvidence>>(ENDPOINTS.ALERT_EVIDENCE(alertId)),

  setAlertVerdict: (alertId: string, result: VerdictResult, note?: string) =>
    apiClient.put<ApiResponse<InferredAlert>>(ENDPOINTS.ALERT_VERDICT(alertId), { result, note }),

  getVerdictStats: (params?: { farm_id?: string; zone_id?: string }) =>
    apiClient.get<ApiResponse<ExpertVerdictStats[]>>(ENDPOINTS.ALERT_VERDICT_STATS, {
      params: {
        farmId: params?.farm_id,
        zoneId: params?.zone_id,
      },
    }),

  // ── 2. Cấu hình Ngưỡng & Tinh chỉnh Zone (EXPERT-FR-004, ENV-FR-006) ─────────────
  getZone: (zoneId: string) =>
    apiClient.get<
      ApiResponse<{
        _id: string
        name: string
        thresholds: ExpertThresholds
        fuzzy_tuning: ExpertFuzzyTuning
        detection_tuning: ExpertDetectionTuning
      }>
    >(ENDPOINTS.ZONE_DETAIL(zoneId)),

  updateThresholds: (zoneId: string, thresholds: Partial<ExpertThresholds>) =>
    apiClient.put<ApiResponse<{ _id: string; thresholds: ExpertThresholds }>>(
      ENDPOINTS.ZONE_THRESHOLDS(zoneId),
      thresholds
    ),

  resetThresholds: (zoneId: string) =>
    apiClient.put<ApiResponse<{ _id: string; thresholds: ExpertThresholds }>>(
      ENDPOINTS.ZONE_THRESHOLDS_RESET(zoneId),
      {}
    ),

  // ── 3. Tinh chỉnh Hệ số mờ Fuzzy (EXPERT-FR-004, ANALYTICS-FR-010, EXPERT-FR-011) ──
  getFuzzySuggestion: (zoneId: string) =>
    apiClient.get<ApiResponse<FuzzySuggestionResponse>>(ENDPOINTS.CONTROL_SUGGESTION, {
      params: { zoneId },
    }),

  applyFuzzySuggestion: (zoneId: string) =>
    apiClient.post<ApiResponse<{ _id: string; house_id: string; fuzzy_tuning: ExpertFuzzyTuning }>>(
      ENDPOINTS.ZONE_APPLY_SUGGESTION(zoneId),
      {}
    ),

  updateFuzzyTuning: (zoneId: string, tuning: Partial<ExpertFuzzyTuning>) =>
    apiClient.put<ApiResponse<{ _id: string; fuzzy_tuning: ExpertFuzzyTuning }>>(
      ENDPOINTS.ZONE_FUZZY_TUNING(zoneId),
      tuning
    ),

  // ── 4. Tham số Phát hiện Bất thường (EXPERT-FR-008) ────────────────────────────
  updateDetectionTuning: (zoneId: string, tuning: Partial<ExpertDetectionTuning>) =>
    apiClient.put<ApiResponse<{ _id: string; detection_tuning: ExpertDetectionTuning }>>(
      ENDPOINTS.ZONE_DETECTION_TUNING(zoneId),
      tuning
    ),

  updateHouseDetection: (houseId: string, tuning: { return_rate_drop_pct: number }) =>
    apiClient.put<ApiResponse<{ _id: string; bird_count_tuning: { return_rate_drop_pct: number } }>>(
      ENDPOINTS.HOUSE_BIRD_COUNT_TUNING(houseId),
      tuning
    ),

  // ── 5. Báo cáo Sức khỏe theo nhà & Kết luận (EXPERT-FR-005, EXPERT-FR-006, EXPERT-FR-013) ──
  // Báo cáo theo nhà (GET /health-reports?farmId|houseId&kind&hasConclusion); hàng đợi chuyên gia lọc hasConclusion=false
  getHealthReports: (params?: {
    farm_id?: string
    house_id?: string
    kind?: HouseHealthReportKind
    has_conclusion?: boolean
    page?: number
    limit?: number
  }) =>
    apiClient.get<ApiResponse<HouseHealthReportSummary[]>>(ENDPOINTS.HEALTH_REPORTS, {
      params: {
        farmId: params?.farm_id,
        houseId: params?.house_id,
        kind: params?.kind,
        hasConclusion: params?.has_conclusion,
        page: params?.page,
        limit: params?.limit,
      },
    }),

  getHealthReportDetail: (reportId: string) =>
    apiClient.get<ApiResponse<HouseHealthReport>>(ENDPOINTS.HEALTH_REPORT_DETAIL(reportId)),

  setReportConclusion: (reportId: string, text: string) =>
    apiClient.put<ApiResponse<HouseHealthReport>>(ENDPOINTS.HEALTH_REPORT_CONCLUSION(reportId), { text }),

  // ── 6. Kiểm duyệt Thay đổi của Chủ Farm (EXPERT-FR-010) ─────────────────────────
  getReviewItems: (params?: { farm_id?: string; zone_id?: string; status?: ReviewItemStatus }) =>
    apiClient.get<ApiResponse<ReviewItem[]>>(ENDPOINTS.EXPERT_REVIEWS, {
      params: {
        farmId: params?.farm_id,
        zoneId: params?.zone_id,
        status: params?.status,
      },
    }),

  takeReviewAction: (itemId: string, action: 'ACCEPT' | 'REVERT') => {
    if (action === 'ACCEPT') {
      return apiClient.put<ApiResponse<ReviewItem>>(ENDPOINTS.EXPERT_REVIEW_ACCEPT(itemId))
    }
    return apiClient.put<ApiResponse<ReviewItem>>(ENDPOINTS.EXPERT_REVIEW_REVERT(itemId))
  },

  // ── 7. Duyệt Đề xuất Hệ số mờ (EXPERT-FR-011) ──────────────────────────────────
  getProposals: (params?: { farm_id?: string; zone_id?: string; status?: ProposalStatus }) =>
    apiClient.get<ApiResponse<CoefficientProposal[]>>(ENDPOINTS.EXPERT_PROPOSALS, {
      params: {
        farmId: params?.farm_id,
        zoneId: params?.zone_id,
        status: params?.status,
      },
    }),

  takeProposalAction: (proposalId: string, action: 'APPROVE' | 'REJECT', rejectionReason?: string) => {
    if (action === 'APPROVE') {
      return apiClient.put<ApiResponse<CoefficientProposal>>(ENDPOINTS.EXPERT_PROPOSAL_APPROVE(proposalId))
    }
    return apiClient.put<ApiResponse<CoefficientProposal>>(ENDPOINTS.EXPERT_PROPOSAL_REJECT(proposalId), {
      note: rejectionReason,
    })
  },

  // ── 8. Nhật ký Hoạt động Chuyên gia (EXPERT-FR-009) ───────────────────────────
  getExpertActivity: (farmId: string, params?: ExpertActivityQueryParams) =>
    apiClient.get<ApiResponse<ExpertActivityEntry[]>>(ENDPOINTS.EXPERT_ACTIVITY, {
      params: {
        farmId,
        type: params?.action,
        page: params?.page,
        limit: params?.limit,
      },
    }),
}
