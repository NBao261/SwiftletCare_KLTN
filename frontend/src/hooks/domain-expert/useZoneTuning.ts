// Hook của trang Ngưỡng & hệ số mờ (/domain-expert/tuning): ngưỡng, hệ số mờ, gợi ý hệ số, tham số phát hiện
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { birdCountTuningApi } from '@/apis/domain-expert/birdCountTuning.api'
import { expertService, expertApi } from '@/services/expert.service'
import type {
  ExpertThresholds,
  ExpertFuzzyTuning,
  ExpertDetectionTuning,
} from '@/types/expert.types'

const QK = (key: string, zoneId?: string) => ['expert', 'tuning', key, zoneId]

// Trang này là nơi duy nhất sửa ngưỡng và hệ số mờ, nên làm mới cả dữ liệu Zone mà các trang Farm Owner đọc
function invalidateZoneCaches(qc: ReturnType<typeof useQueryClient>, zoneId?: string) {
  void qc.invalidateQueries({ queryKey: ['zones'] })
  void qc.invalidateQueries({ queryKey: ['zone', zoneId] })
  void qc.invalidateQueries({ queryKey: ['all-zones'] })
  void qc.invalidateQueries({ queryKey: ['analytics', 'control-performance', zoneId] })
}

// 1. Ngưỡng vi khí hậu (Cột 1)
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
      if (!zoneId) throw new Error('Chưa chọn Zone')
      return expertService.updateThresholds(zoneId, thresholds)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK('thresholds', zoneId) })
      invalidateZoneCaches(qc, zoneId)
    },
  })
}

export function useResetThresholds(zoneId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!zoneId) throw new Error('Chưa chọn Zone')
      return expertService.resetThresholds(zoneId)
    },
    // Chờ đọc lại xong rồi mới báo thành công: ô đang sửa dở được đặt lại theo đúng số vừa khôi phục, không nháy số cũ
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK('thresholds', zoneId) })
      invalidateZoneCaches(qc, zoneId)
    },
  })
}

// 2. Hệ số mờ Fuzzy (Cột 2)
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
      if (!zoneId) throw new Error('Chưa chọn Zone')
      return expertService.updateFuzzyTuning(zoneId, tuning)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK('fuzzy', zoneId) })
      void qc.invalidateQueries({ queryKey: ['expert', 'fuzzy-suggestion'] })
      invalidateZoneCaches(qc, zoneId)
    },
  })
}

// 3. Gợi ý hệ số mờ từ dữ liệu
export function useFuzzySuggestion(zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'fuzzy-suggestion', zoneId],
    queryFn: () => expertService.getFuzzySuggestion(zoneId ?? ''),
    enabled: Boolean(zoneId),
    staleTime: 10 * 60_000,
  })
}

// 4. Tham số phát hiện bất thường (Cột 3)
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
      if (!zoneId) throw new Error('Chưa chọn Zone')
      return expertService.updateDetectionTuning(zoneId, tuning)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK('detection', zoneId) }),
  })
}

export function useResetDetectionTuning(zoneId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!zoneId) throw new Error('Chưa chọn Zone')
      return expertService.resetDetectionTuning(zoneId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK('detection', zoneId) }),
  })
}

// 4. Mức giảm tỷ lệ chim về: tham số của nhà chứa Zone đang chọn
export function useZoneHouseId(zoneId?: string) {
  return useQuery({
    queryKey: QK('house-of-zone', zoneId),
    queryFn: async () => (await expertApi.getZone(zoneId!)).data.data.house_id,
    staleTime: 5 * 60_000,
    enabled: Boolean(zoneId),
  })
}

// Lưu hoặc khôi phục mặc định; thành công thì đọc lại danh sách nhà (bird_count_tuning nằm trong House)
export function useSaveReturnRateDrop(farmId?: string | null) {
  const qc = useQueryClient()
  // Chờ đọc lại xong: ô đang sửa dở được đặt lại theo số vừa khôi phục
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['houses', farmId] })
  return {
    update: useMutation({
      mutationFn: ({ houseId, value }: { houseId: string; value: number }) => birdCountTuningApi.update(houseId, value),
      onSuccess,
    }),
    reset: useMutation({ mutationFn: (houseId: string) => birdCountTuningApi.reset(houseId), onSuccess }),
  }
}
