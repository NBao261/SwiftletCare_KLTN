/**
 * useZoneTuning — Custom hooks cho màn hình 03_Zone_Tuning_v3
 * Real API First → Mock fallback | SRS v2.1.4: EXPERT-FR-004/008
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expertService, expertApi } from '@/services/expert.service'
import type {
  ExpertThresholds,
  ExpertFuzzyTuning,
  ExpertDetectionTuning,
} from '@/types/expert.types'

const QK = (key: string, zoneId?: string) => ['expert', 'tuning', key, zoneId]

// ── 1. Ngưỡng vi khí hậu (Cột 1) ─────────────────────────────────────────────
export function useExpertThresholds(zoneId?: string) {
  return useQuery({
    queryKey: QK('thresholds', zoneId),
    queryFn: async (): Promise<ExpertThresholds | undefined> => {
      if (!zoneId) return undefined
      const res = await expertApi.getZone(zoneId)
      return res.data?.data?.thresholds
    },
    staleTime: 5 * 60_000,
    enabled: Boolean(zoneId),
  })
}

export function useUpdateThresholds(zoneId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (thresholds: Partial<ExpertThresholds>) => {
      if (!zoneId) throw new Error('Chưa chọn khu vực')
      return expertService.updateThresholds(zoneId, thresholds)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK('thresholds', zoneId) }),
  })
}

export function useResetThresholds(zoneId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!zoneId) throw new Error('Chưa chọn khu vực')
      return expertService.resetThresholds(zoneId)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK('thresholds', zoneId) }),
  })
}

// ── 2. Hệ số mờ Fuzzy (Cột 2) ────────────────────────────────────────────────
export function useExpertFuzzyTuning(zoneId?: string) {
  return useQuery({
    queryKey: QK('fuzzy', zoneId),
    queryFn: async (): Promise<ExpertFuzzyTuning | undefined> => {
      if (!zoneId) return undefined
      const res = await expertApi.getZone(zoneId)
      return res.data?.data?.fuzzy_tuning
    },
    staleTime: 5 * 60_000,
    enabled: Boolean(zoneId),
  })
}

export function useUpdateFuzzyTuning(zoneId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tuning: Partial<ExpertFuzzyTuning>) => {
      if (!zoneId) throw new Error('Chưa chọn khu vực')
      return expertService.updateFuzzyTuning(zoneId, tuning)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK('fuzzy', zoneId) })
      void qc.invalidateQueries({ queryKey: ['expert', 'fuzzy-suggestion'] })
    },
  })
}

// ── 3. Gợi ý thuật toán AI (Banner xanh cốm) ─────────────────────────────────
export function useExpertAiSuggestion(zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'fuzzy-suggestion', zoneId],
    queryFn: () => expertService.getFuzzySuggestion(zoneId ?? ''),
    enabled: Boolean(zoneId),
    staleTime: 10 * 60_000,
  })
}

// ── 4. Tham số phát hiện bất thường (Cột 3) ──────────────────────────────────
export function useExpertDetectionTuning(zoneId?: string) {
  return useQuery({
    queryKey: QK('detection', zoneId),
    queryFn: async (): Promise<ExpertDetectionTuning | undefined> => {
      if (!zoneId) return undefined
      const res = await expertApi.getZone(zoneId)
      return res.data?.data?.detection_tuning
    },
    staleTime: 5 * 60_000,
    enabled: Boolean(zoneId),
  })
}

export function useUpdateDetectionTuning(zoneId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tuning: Partial<ExpertDetectionTuning>) => {
      if (!zoneId) throw new Error('Chưa chọn khu vực')
      return expertService.updateDetectionTuning(zoneId, tuning)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK('detection', zoneId) }),
  })
}
