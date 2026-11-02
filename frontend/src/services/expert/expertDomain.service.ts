import { expertApi } from './expertApi.service'
import type {
  ExpertVerdictStats, InferredAlertItem, ExpertThresholds,
  ExpertFuzzyTuning, ExpertDetectionTuning, FuzzySuggestionResponse,
  ForecastResponse, ControlPerformanceResponse, AutonomyResponse,
  BirdCountTrendsResponse, ZoneHealthReportItem, HarvestBatchItem,
} from '@/types/expert.types'

const INFERRED_TYPES: Set<string> = new Set([
  'NOISE_ANOMALY',
  'SENSOR_ANOMALY',
  'FORECAST_BREACH',
  'LOW_RETURN_RATE',
  'MISTING_INEFFECTIVE',
])

export const expertService = {
  // ── Đọc dữ liệu (Chỉ lấy cảnh báo suy luận theo SRS EXPERT-FR-003) ───────
  async getPendingAlerts(params?: { farmId?: string; zoneId?: string }): Promise<InferredAlertItem[]> {
    const res = await expertApi.getPendingAlerts(params)
    const list = Array.isArray(res.data?.data) ? res.data.data : []
    return list.filter(item => INFERRED_TYPES.has(item.type))
  },

  async getAllAlerts(params?: { farmId?: string; zoneId?: string }): Promise<InferredAlertItem[]> {
    const res = await expertApi.getAllAlerts(params)
    const list = Array.isArray(res.data?.data) ? res.data.data : []
    return list.filter(item => INFERRED_TYPES.has(item.type))
  },

  async getVerdictStats(params?: { farmId?: string; zoneId?: string }): Promise<ExpertVerdictStats[]> {
    const res = await expertApi.getVerdictStats(params)
    return Array.isArray(res.data?.data) ? res.data.data : []
  },

  async getFuzzySuggestion(zoneId: string): Promise<FuzzySuggestionResponse> {
    const res = await expertApi.getFuzzySuggestion(zoneId)
    return res.data?.data
  },

  async getForecast(zoneId: string): Promise<ForecastResponse> {
    const res = await expertApi.getForecast(zoneId)
    return res.data?.data
  },

  async getControlPerformance(zoneId: string, range = '24h'): Promise<ControlPerformanceResponse> {
    const res = await expertApi.getControlPerformance(zoneId, range)
    return res.data?.data
  },

  async getAutonomy(zoneId: string, range = '24h'): Promise<AutonomyResponse> {
    const res = await expertApi.getAutonomy(zoneId, range)
    return res.data?.data
  },

  async getBirdCountTrends(zoneId: string, days = 30): Promise<BirdCountTrendsResponse> {
    const res = await expertApi.getBirdCountTrends(zoneId, days)
    return res.data?.data
  },

  async getHarvestBatches(params?: { farmId?: string; zoneId?: string }): Promise<HarvestBatchItem[]> {
    const res = await expertApi.getHarvestBatches(params)
    return Array.isArray(res.data?.data) ? res.data.data : []
  },

  async getHealthReports(zoneId: string, params?: { page?: number; limit?: number }): Promise<ZoneHealthReportItem[]> {
    const res = await expertApi.getHealthReports(zoneId, params)
    return Array.isArray(res.data?.data) ? res.data.data : []
  },

  async previewHealthReport(params: { zoneId: string; from: string; to?: string }): Promise<ZoneHealthReportItem> {
    const res = await expertApi.previewHealthReport(params)
    return res.data?.data
  },

  async getHealthReportPreview(zoneId: string): Promise<ZoneHealthReportItem> {
    return this.previewHealthReport({ zoneId, from: new Date(Date.now() - 7 * 86400000).toISOString() })
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

  async setReportConclusion(reportId: string, text: string): Promise<ZoneHealthReportItem> {
    const res = await expertApi.setReportConclusion(reportId, text)
    return res.data.data
  },

  async publishHealthConclusion(reportId: string, text: string): Promise<ZoneHealthReportItem> {
    return this.setReportConclusion(reportId, text)
  },
}
