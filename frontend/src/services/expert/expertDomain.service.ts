import { expertApi } from './expertApi.service'
import type {
  ExpertVerdictStats, InferredAlertItem, ExpertThresholds,
  ExpertFuzzyTuning, ExpertDetectionTuning, FuzzySuggestionResponse,
  AutonomyResponse,
  AlertEvidence, ExpertActivityEntry, ExpertActivityQuery, InferredAlertQuery,
} from '@/types/expert.types'

export const expertService = {
  // ── Đọc dữ liệu (Chỉ lấy cảnh báo suy luận theo SRS EXPERT-FR-003) ───────
  async getInferredAlerts(params: InferredAlertQuery): Promise<{ records: InferredAlertItem[]; total: number }> {
    const res = await expertApi.listInferredAlerts(params)
    return { records: res.data.data ?? [], total: res.data.meta?.total ?? 0 }
  },

  async getVerdictStats(params?: { farmId?: string; zoneId?: string }): Promise<ExpertVerdictStats[]> {
    const res = await expertApi.getVerdictStats(params)
    return Array.isArray(res.data?.data) ? res.data.data : []
  },

  async getAlertEvidence(alertId: string): Promise<AlertEvidence> {
    const res = await expertApi.getAlertEvidence(alertId)
    return res.data.data
  },

  async getExpertActivity(params: ExpertActivityQuery): Promise<{ records: ExpertActivityEntry[]; total: number; page: number; limit: number }> {
    const res = await expertApi.getExpertActivity(params)
    const records = Array.isArray(res.data?.data) ? res.data.data : []
    const meta = res.data?.meta ?? { total: records.length, page: 1, limit: 10 }
    return { records, total: meta.total, page: meta.page, limit: meta.limit }
  },

  async getFuzzySuggestion(zoneId: string): Promise<FuzzySuggestionResponse> {
    const res = await expertApi.getFuzzySuggestion(zoneId)
    return res.data?.data
  },

  async getAutonomy(zoneId: string, range = '24h'): Promise<AutonomyResponse> {
    const res = await expertApi.getAutonomy(zoneId, range)
    return res.data?.data
  },

  // ── Thao tác ghi (Không nuốt lỗi - throw lỗi thật để UI hiển thị) ───────
  async setAlertVerdict(alertId: string, result: 'CONFIRMED' | 'REJECTED', note?: string): Promise<InferredAlertItem> {
    const res = await expertApi.setAlertVerdict(alertId, result, note)
    return res.data.data
  },

  async updateThresholds(zoneId: string, thresholds: Partial<ExpertThresholds>): Promise<ExpertThresholds> {
    const res = await expertApi.updateThresholds(zoneId, thresholds)
    return res.data.data.thresholds
  },

  async resetThresholds(zoneId: string): Promise<ExpertThresholds> {
    const res = await expertApi.resetThresholds(zoneId)
    return res.data.data.thresholds
  },

  async updateFuzzyTuning(zoneId: string, tuning: Partial<ExpertFuzzyTuning>): Promise<ExpertFuzzyTuning> {
    const res = await expertApi.updateFuzzyTuning(zoneId, tuning)
    return res.data.data.fuzzy_tuning
  },

  async updateDetectionTuning(zoneId: string, tuning: Partial<ExpertDetectionTuning>): Promise<ExpertDetectionTuning> {
    const res = await expertApi.updateDetectionTuning(zoneId, tuning)
    return res.data.data.detection_tuning
  },

  async resetDetectionTuning(zoneId: string): Promise<ExpertDetectionTuning> {
    const res = await expertApi.resetDetectionTuning(zoneId)
    return res.data.data.detection_tuning
  },
}
