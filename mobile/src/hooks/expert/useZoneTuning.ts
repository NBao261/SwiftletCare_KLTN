import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expertApi } from '@/services/api/expert.api'
import type {
  ExpertDetectionTuning,
  ExpertFuzzyTuning,
  ExpertThresholds,
} from '@/types'

/**
 * Hook lấy cấu hình chi tiết của một Zone (Ngưỡng, Fuzzy, Phát hiện bất thường)
 */
export function useZoneTuning(zoneId: string) {
  return useQuery({
    queryKey: ['expert', 'zone-tuning', zoneId],
    queryFn: () => expertApi.getZone(zoneId).then(res => res.data),
    enabled: Boolean(zoneId),
  })
}

/**
 * Hook cập nhật ngưỡng vi khí hậu an toàn của Zone (EXPERT-FR-004, ENV-FR-006)
 */
export function useUpdateThresholds() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      zoneId,
      thresholds,
    }: {
      zoneId: string
      thresholds: Partial<ExpertThresholds>
    }) => expertApi.updateThresholds(zoneId, thresholds),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expert', 'zone-tuning', vars.zoneId] })
      queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
  })
}

/**
 * Hook khôi phục ngưỡng vi khí hậu mặc định của Zone (SYSTEM-FR-002, ENV-FR-007)
 */
export function useResetThresholds() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (zoneId: string) => expertApi.resetThresholds(zoneId),
    onSuccess: (_, zoneId) => {
      queryClient.invalidateQueries({ queryKey: ['expert', 'zone-tuning', zoneId] })
    },
  })
}

/**
 * Hook lấy gợi ý hệ số mờ Fuzzy Logic từ hệ thống AI (ANALYTICS-FR-010, BR-06)
 */
export function useFuzzySuggestion(zoneId: string) {
  return useQuery({
    queryKey: ['expert', 'fuzzy-suggestion', zoneId],
    queryFn: () => expertApi.getFuzzySuggestion(zoneId).then(res => res.data),
    enabled: Boolean(zoneId),
  })
}

/**
 * Hook cập nhật hệ số điều khiển mờ Sugeno Fuzzy của Zone (EXPERT-FR-004, BR-05)
 */
export function useUpdateFuzzyTuning() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      zoneId,
      tuning,
    }: {
      zoneId: string
      tuning: Partial<ExpertFuzzyTuning>
    }) => expertApi.updateFuzzyTuning(zoneId, tuning),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expert', 'zone-tuning', vars.zoneId] })
    },
  })
}

/**
 * Hook cập nhật tham số phát hiện bất thường cấp Zone (EXPERT-FR-008, BR-09a-e)
 */
export function useUpdateDetectionTuning() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      zoneId,
      tuning,
    }: {
      zoneId: string
      tuning: Partial<ExpertDetectionTuning>
    }) => expertApi.updateDetectionTuning(zoneId, tuning),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expert', 'zone-tuning', vars.zoneId] })
    },
  })
}

/**
 * Hook cập nhật tham số phát hiện bất thường sụt giảm chim về cấp Nhà yến (EXPERT-FR-008, BR-09f)
 */
export function useUpdateHouseDetection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      houseId,
      returnRateDropPct,
    }: {
      houseId: string
      returnRateDropPct: number
    }) => expertApi.updateHouseDetection(houseId, { return_rate_drop_pct: returnRateDropPct }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert'] })
    },
  })
}
