import { expertApi } from './expertApi.service'
import type {
  ExpertVerdictStats, InferredAlertItem, ExpertThresholds,
  ExpertFuzzyTuning, ExpertDetectionTuning, FuzzySuggestionResponse,
  ForecastResponse, ControlPerformanceResponse, AutonomyResponse,
  BirdCountTrendsResponse, ZoneHealthReportItem, HarvestBatchItem,
} from '@/types/expert.types'
import {
  MOCK_EXPERT_VERDICT_STATS, MOCK_INFERRED_ALERTS, MOCK_EXPERT_THRESHOLDS,
  MOCK_EXPERT_FUZZY_TUNING, MOCK_EXPERT_DETECTION_TUNING, MOCK_FUZZY_SUGGESTION,
  MOCK_FORECAST_RESPONSE, MOCK_CONTROL_PERFORMANCE, MOCK_AUTONOMY,
  MOCK_BIRD_COUNT_TRENDS, MOCK_HARVEST_BATCHES, MOCK_HEALTH_REPORTS,
} from '@/data/expertMock.data'

export const expertService = {
  async getPendingAlerts(params?: { farmId?: string; zoneId?: string }): Promise<InferredAlertItem[]> {
    try {
      const res = await expertApi.getPendingAlerts(params)
      return (Array.isArray(res.data?.data) && res.data.data.length > 0) ? res.data.data : MOCK_INFERRED_ALERTS
    } catch {
      return MOCK_INFERRED_ALERTS
    }
  },

  async getVerdictStats(params?: { farmId?: string; zoneId?: string }): Promise<ExpertVerdictStats[]> {
    try {
      const res = await expertApi.getVerdictStats(params)
      return (Array.isArray(res.data?.data) && res.data.data.length > 0) ? res.data.data : MOCK_EXPERT_VERDICT_STATS
    } catch {
      return MOCK_EXPERT_VERDICT_STATS
    }
  },

  async setAlertVerdict(alertId: string, result: 'CONFIRMED' | 'REJECTED', note?: string): Promise<InferredAlertItem> {
    try {
      const res = await expertApi.setAlertVerdict(alertId, result, note)
      return res.data.data
    } catch {
      return {
        ...MOCK_INFERRED_ALERTS[0],
        _id: alertId,
        expert_verdict: {
          result,
          note,
          by: { _id: 'current_user', full_name: 'Chuyên gia nuôi yến' },
          at: new Date().toISOString(),
        },
      }
    }
  },

  async updateThresholds(zoneId: string, thresholds: Partial<ExpertThresholds>): Promise<ExpertThresholds> {
    try {
      const res = await expertApi.updateThresholds(zoneId, thresholds)
      return res.data.data.thresholds
    } catch {
      return { ...MOCK_EXPERT_THRESHOLDS, ...thresholds }
    }
  },

  async resetThresholds(zoneId: string): Promise<ExpertThresholds> {
    try {
      const res = await expertApi.resetThresholds(zoneId)
      return res.data.data.thresholds
    } catch {
      return { ...MOCK_EXPERT_THRESHOLDS }
    }
  },

  async getFuzzySuggestion(zoneId: string): Promise<FuzzySuggestionResponse> {
    try {
      const res = await expertApi.getFuzzySuggestion(zoneId)
      return res.data?.data ?? MOCK_FUZZY_SUGGESTION
    } catch {
      return MOCK_FUZZY_SUGGESTION
    }
  },

  async updateFuzzyTuning(zoneId: string, tuning: Partial<ExpertFuzzyTuning>): Promise<ExpertFuzzyTuning> {
    try {
      const res = await expertApi.updateFuzzyTuning(zoneId, tuning)
      return res.data.data.fuzzy_tuning
    } catch {
      return { ...MOCK_EXPERT_FUZZY_TUNING, ...tuning }
    }
  },

  async updateDetectionTuning(zoneId: string, tuning: Partial<ExpertDetectionTuning>): Promise<ExpertDetectionTuning> {
    try {
      const res = await expertApi.updateDetectionTuning(zoneId, tuning)
      return res.data.data.detection_tuning
    } catch {
      return { ...MOCK_EXPERT_DETECTION_TUNING, ...tuning }
    }
  },

  async getForecast(zoneId: string): Promise<ForecastResponse> {
    return expertApi.getForecast(zoneId).then(r => r.data?.data ?? MOCK_FORECAST_RESPONSE).catch(() => MOCK_FORECAST_RESPONSE)
  },

  async getControlPerformance(zoneId: string, range = '24h'): Promise<ControlPerformanceResponse> {
    return expertApi.getControlPerformance(zoneId, range).then(r => r.data?.data ?? MOCK_CONTROL_PERFORMANCE).catch(() => MOCK_CONTROL_PERFORMANCE)
  },

  async getAutonomy(zoneId: string, range = '24h'): Promise<AutonomyResponse> {
    return expertApi.getAutonomy(zoneId, range).then(r => r.data?.data ?? MOCK_AUTONOMY).catch(() => MOCK_AUTONOMY)
  },

  async getBirdCountTrends(zoneId: string, days = 30): Promise<BirdCountTrendsResponse> {
    return expertApi.getBirdCountTrends(zoneId, days).then(r => r.data?.data ?? MOCK_BIRD_COUNT_TRENDS).catch(() => MOCK_BIRD_COUNT_TRENDS)
  },

  async getHarvestBatches(params?: { farmId?: string; zoneId?: string }): Promise<HarvestBatchItem[]> {
    try {
      const res = await expertApi.getHarvestBatches(params)
      return (Array.isArray(res.data?.data) && res.data.data.length > 0) ? res.data.data : MOCK_HARVEST_BATCHES
    } catch {
      return MOCK_HARVEST_BATCHES
    }
  },

  async getHealthReports(zoneId: string, params?: { page?: number; limit?: number }): Promise<ZoneHealthReportItem[]> {
    try {
      const res = await expertApi.getHealthReports(zoneId, params)
      return (Array.isArray(res.data?.data) && res.data.data.length > 0) ? res.data.data : MOCK_HEALTH_REPORTS
    } catch {
      return MOCK_HEALTH_REPORTS
    }
  },

  async previewHealthReport(params: { zoneId: string; from: string; to?: string }): Promise<ZoneHealthReportItem> {
    try {
      return (await expertApi.previewHealthReport(params)).data?.data ?? MOCK_HEALTH_REPORTS[0]
    } catch {
      return MOCK_HEALTH_REPORTS[0]
    }
  },

  async setReportConclusion(reportId: string, text: string): Promise<ZoneHealthReportItem> {
    if (!/^[0-9a-fA-F]{24}$/.test(reportId)) {
      const idx = MOCK_HEALTH_REPORTS.findIndex(r => r._id === reportId)
      const existing = idx >= 0 ? MOCK_HEALTH_REPORTS[idx] : MOCK_HEALTH_REPORTS[0]
      const updated: ZoneHealthReportItem = {
        ...existing,
        expert_conclusion: {
          text,
          by: { _id: 'current_user', full_name: 'Chuyên gia nuôi yến' },
          at: new Date().toISOString(),
        },
      }
      if (idx >= 0) MOCK_HEALTH_REPORTS[idx] = updated
      return updated
    }
    try {
      return (await expertApi.setReportConclusion(reportId, text)).data.data
    } catch {
      const existing = MOCK_HEALTH_REPORTS.find(r => r._id === reportId) ?? MOCK_HEALTH_REPORTS[0]
      return {
        ...existing,
        expert_conclusion: {
          text,
          by: { _id: 'current_user', full_name: 'Chuyên gia nuôi yến' },
          at: new Date().toISOString(),
        },
      }
    }
  },

  async getHealthReportPreview(zoneId: string): Promise<ZoneHealthReportItem> {
    return this.previewHealthReport({ zoneId, from: new Date(Date.now() - 7 * 86400000).toISOString() })
  },

  async publishHealthConclusion(reportId: string, text: string): Promise<ZoneHealthReportItem> {
    return this.setReportConclusion(reportId, text)
  },
}
