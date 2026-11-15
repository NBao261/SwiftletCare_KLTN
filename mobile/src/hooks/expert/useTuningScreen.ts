import { useCallback, useEffect, useMemo, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { useControlPerformances } from '@/hooks/analytics/useControlPerformances'
import { useInferredAlerts } from '@/hooks/expert/useInferredAlerts'
import { useExpertReviewItems } from '@/hooks/expert/useExpertReviews'
import {
  useApplyFuzzySuggestion,
  useFuzzySuggestion,
  useResetThresholds,
  useUpdateDetectionTuning,
  useUpdateFuzzyTuning,
  useUpdateHouseDetection,
  useUpdateThresholds,
  useZoneTuning,
} from '@/hooks/expert/useZoneTuning'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useZonesOfHouses } from '@/hooks/farm/useZonesOfHouses'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { ExpertDetectionTuning, ExpertFuzzyTuning, ExpertThresholds } from '@/types'
import { t } from '@/utils/i18n.utils'
import { DEFAULT_DETECTION, DEFAULT_FUZZY, DEFAULT_THRESHOLDS, TUNING_RANGES } from '@/utils/tuning.utils'

export type TuningChipKey = 'thresholds' | 'fuzzy' | 'detection'

/**
 * Logic nghiệp vụ màn Tham số (EXPERT-FR-004/008/011): tải cấu hình zone, giữ bản nháp chỉnh sửa (diff
 * với giá trị server), lưu/áp dụng, khôi phục dải chuẩn và áp dụng gợi ý hệ số từ AI. Màn chỉ render.
 */
export function useTuningScreen(paramZoneId?: string) {
  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)
  const selectedHouseId = useExpertScopeStore(state => state.selectedHouseId)
  const selectedZoneId = useExpertScopeStore(state => state.selectedZoneId)
  const setZoneId = useExpertScopeStore(state => state.setZoneId)

  const { zones } = useZonesOfHouses(selectedHouseId ? [selectedHouseId] : [])

  // Link sâu mang theo zoneId; nếu chưa chọn tầng thì tự chọn tầng đầu của nhà
  useEffect(() => {
    if (paramZoneId && paramZoneId !== selectedZoneId) setZoneId(paramZoneId)
  }, [paramZoneId, selectedZoneId, setZoneId])

  useEffect(() => {
    if (!selectedZoneId && zones.length > 0) setZoneId(zones[0]._id)
  }, [selectedZoneId, setZoneId, zones])

  const activeZoneId = selectedZoneId || ''

  const zoneQuery = useZoneTuning(activeZoneId)
  const { data: fuzzySuggestionResponse } = useFuzzySuggestion(activeZoneId)
  const fuzzySuggestion = fuzzySuggestionResponse?.data

  const controlPerformances = useControlPerformances(activeZoneId ? [activeZoneId] : [], '7d')
  const { data: activeAlertsResponse } = useInferredAlerts({ farm_id: selectedFarmId || undefined, zone_id: activeZoneId || undefined, verdict: 'pending' })
  const { data: reviewItemsResponse } = useExpertReviewItems({ farm_id: selectedFarmId || undefined, status: 'PENDING_REVIEW' })

  const { houses } = useAllHouses()
  const currentHouse = useMemo(() => houses.find(h => h._id === selectedHouseId), [houses, selectedHouseId])

  const zoneData = zoneQuery.data?.data

  const serverThresholds = useMemo<ExpertThresholds>(() => ({ ...DEFAULT_THRESHOLDS, ...(zoneData?.thresholds ?? {}) }), [zoneData])
  const serverFuzzy = useMemo<ExpertFuzzyTuning>(() => ({ ...DEFAULT_FUZZY, ...(zoneData?.fuzzy_tuning ?? {}) }), [zoneData])
  const serverDetection = useMemo<ExpertDetectionTuning>(() => ({ ...DEFAULT_DETECTION, ...(zoneData?.detection_tuning ?? {}) }), [zoneData])
  const serverHouseRate = currentHouse?.bird_count_tuning?.return_rate_drop_pct ?? TUNING_RANGES.return_rate_drop_pct.default

  const [prevZoneId, setPrevZoneId] = useState(activeZoneId)
  const [thresholdEdits, setThresholdEdits] = useState<Partial<ExpertThresholds>>({})
  const [fuzzyEdits, setFuzzyEdits] = useState<Partial<ExpertFuzzyTuning>>({})
  const [detectionEdits, setDetectionEdits] = useState<Partial<ExpertDetectionTuning>>({})
  const [houseReturnRateEdit, setHouseReturnRateEdit] = useState<number | null>(null)

  const clearAllEdits = useCallback(() => {
    setThresholdEdits({})
    setFuzzyEdits({})
    setDetectionEdits({})
    setHouseReturnRateEdit(null)
  }, [])

  // Đổi tầng thì bỏ bản nháp của tầng cũ
  if (activeZoneId !== prevZoneId) {
    setPrevZoneId(activeZoneId)
    clearAllEdits()
  }

  const localThresholds = useMemo<ExpertThresholds>(() => ({ ...serverThresholds, ...thresholdEdits }), [serverThresholds, thresholdEdits])
  const localFuzzy = useMemo<ExpertFuzzyTuning>(() => ({ ...serverFuzzy, ...fuzzyEdits }), [serverFuzzy, fuzzyEdits])
  const localDetection = useMemo<ExpertDetectionTuning>(() => ({ ...serverDetection, ...detectionEdits }), [serverDetection, detectionEdits])
  const localHouseReturnRate = houseReturnRateEdit ?? serverHouseRate

  const handleParamChange = useCallback(
    (chip: TuningChipKey, key: string, value: number) => {
      if (chip === 'thresholds') {
        const k = key as keyof ExpertThresholds
        setThresholdEdits(prev => (value === serverThresholds[k] ? (({ [k]: _removed, ...rest }) => rest)(prev) : { ...prev, [k]: value }))
      } else if (chip === 'fuzzy') {
        const k = key as keyof ExpertFuzzyTuning
        setFuzzyEdits(prev => (value === serverFuzzy[k] ? (({ [k]: _removed, ...rest }) => rest)(prev) : { ...prev, [k]: value }))
      } else if (chip === 'detection') {
        if (key === 'return_rate_drop_pct') {
          setHouseReturnRateEdit(value === serverHouseRate ? null : value)
        } else {
          const k = key as keyof ExpertDetectionTuning
          setDetectionEdits(prev => (value === serverDetection[k] ? (({ [k]: _removed, ...rest }) => rest)(prev) : { ...prev, [k]: value }))
        }
      }
    },
    [serverThresholds, serverFuzzy, serverDetection, serverHouseRate]
  )

  // Toggle lọc tín hiệu cảm biến (fuzzy_input_filter là boolean, không đi qua handleParamChange số)
  const toggleFuzzyInputFilter = useCallback(() => {
    setFuzzyEdits(prev => {
      const next = !(prev.fuzzy_input_filter ?? serverFuzzy.fuzzy_input_filter)
      if (next === serverFuzzy.fuzzy_input_filter) {
        const { fuzzy_input_filter: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, fuzzy_input_filter: next }
    })
  }, [serverFuzzy.fuzzy_input_filter])

  const getFieldValue = useCallback(
    (chip: TuningChipKey, key: string, defVal: number): number => {
      if (chip === 'thresholds') return localThresholds[key as keyof ExpertThresholds] ?? defVal
      if (chip === 'fuzzy') return (localFuzzy[key as keyof ExpertFuzzyTuning] as number) ?? defVal
      return key === 'return_rate_drop_pct' ? localHouseReturnRate : ((localDetection[key as keyof ExpertDetectionTuning] as number) ?? defVal)
    },
    [localThresholds, localFuzzy, localDetection, localHouseReturnRate]
  )

  const totalDirtyCount =
    Object.keys(thresholdEdits).length +
    Object.keys(fuzzyEdits).length +
    Object.keys(detectionEdits).length +
    (houseReturnRateEdit !== null ? 1 : 0)
  const isDirty = totalDirtyCount > 0

  const updateThresholdsMutation = useUpdateThresholds()
  const resetThresholdsMutation = useResetThresholds()
  const updateFuzzyMutation = useUpdateFuzzyTuning()
  const applyFuzzySuggestionMutation = useApplyFuzzySuggestion()
  const updateDetectionMutation = useUpdateDetectionTuning()
  const updateHouseDetectionMutation = useUpdateHouseDetection()

  const isSaving =
    updateThresholdsMutation.isPending ||
    updateFuzzyMutation.isPending ||
    updateDetectionMutation.isPending ||
    updateHouseDetectionMutation.isPending

  const toast = useToastMessage()

  const saveAndApply = useCallback(async () => {
    if (!activeZoneId || !isDirty) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    const promises: Promise<unknown>[] = []

    if (Object.keys(thresholdEdits).length > 0) promises.push(updateThresholdsMutation.mutateAsync({ zoneId: activeZoneId, thresholds: thresholdEdits }))
    if (Object.keys(fuzzyEdits).length > 0) promises.push(updateFuzzyMutation.mutateAsync({ zoneId: activeZoneId, tuning: fuzzyEdits }))
    if (Object.keys(detectionEdits).length > 0) promises.push(updateDetectionMutation.mutateAsync({ zoneId: activeZoneId, tuning: detectionEdits }))
    if (houseReturnRateEdit !== null && selectedHouseId) promises.push(updateHouseDetectionMutation.mutateAsync({ houseId: selectedHouseId, returnRateDropPct: localHouseReturnRate }))

    try {
      await Promise.all(promises)
      clearAllEdits()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      toast.show(t('Đã lưu và áp dụng tham số vận hành'))
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      toast.show(t('Không thể lưu tham số, vui lòng thử lại'))
    }
  }, [activeZoneId, clearAllEdits, detectionEdits, fuzzyEdits, houseReturnRateEdit, isDirty, localHouseReturnRate, selectedHouseId, toast, thresholdEdits, updateDetectionMutation, updateFuzzyMutation, updateHouseDetectionMutation, updateThresholdsMutation])

  const resetSystemDefaults = useCallback(async () => {
    if (!activeZoneId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    try {
      await resetThresholdsMutation.mutateAsync(activeZoneId)
      clearAllEdits()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      toast.show(t('Đã khôi phục dải chuẩn SwiftletCare'))
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      toast.show(t('Không thể khôi phục dải chuẩn, vui lòng thử lại'))
    }
  }, [activeZoneId, clearAllEdits, resetThresholdsMutation, toast])

  const suggestedValues = fuzzySuggestion?.suggestion ?? fuzzySuggestion?.suggested_values ?? null
  const aiR2 = fuzzySuggestion?.model?.r2 ?? fuzzySuggestion?.r_squared ?? null
  const aiInRangeNow = fuzzySuggestion?.predicted?.inRangeNow
  const aiInRangeSuggested = fuzzySuggestion?.predicted?.inRangeSuggested
  const aiDeltaPct =
    fuzzySuggestion?.predicted_in_range_pct ??
    (aiInRangeNow != null && aiInRangeSuggested != null ? aiInRangeSuggested - aiInRangeNow : null)
  const aiReasonText = fuzzySuggestion?.reason ?? fuzzySuggestion?.reasoning ?? null

  const applyAiFuzzySuggestion = useCallback(async () => {
    if (!suggestedValues) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    if (activeZoneId && fuzzySuggestion?.suggestion) {
      try {
        await applyFuzzySuggestionMutation.mutateAsync(activeZoneId)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
        toast.show(t('Đã áp dụng gợi ý hệ số mờ từ AI'))
        return
      } catch {
        // Fallback: điền vào form cục bộ nếu endpoint trả lỗi
      }
    }
    setFuzzyEdits(prev => ({ ...prev, ...suggestedValues }))
  }, [activeZoneId, applyFuzzySuggestionMutation, fuzzySuggestion?.suggestion, toast, suggestedValues])

  const kpiInRangePct = useMemo<number | null>(() => {
    const stats = controlPerformances.byZone.get(activeZoneId)?.stats
    return stats?.humidityInRangePct ?? stats?.temperatureInRangePct ?? null
  }, [controlPerformances.byZone, activeZoneId])

  const kpiBreachedCount = useMemo(() => (activeAlertsResponse?.meta?.total ?? (activeAlertsResponse?.data || []).length), [activeAlertsResponse])
  const kpiOwnerReviewsCount = useMemo(
    () => (reviewItemsResponse?.data || []).filter(it => it.zone_id === activeZoneId).length,
    [activeZoneId, reviewItemsResponse?.data]
  )
  const kpiAiAvailable = useMemo(() => Boolean(suggestedValues && (aiR2 ?? 0) >= 0.3), [aiR2, suggestedValues])

  return {
    activeZoneId,
    hasZoneData: Boolean(zoneQuery.data),
    isZoneLoading: zoneQuery.isLoading,
    isZoneError: zoneQuery.isError,
    isRefetching: zoneQuery.isRefetching,
    refetch: zoneQuery.refetch,
    getFieldValue,
    handleParamChange,
    fuzzyInputFilter: localFuzzy.fuzzy_input_filter,
    toggleFuzzyInputFilter,
    isDirty,
    totalDirtyCount,
    isSaving,
    saveAndApply,
    resetLocal: clearAllEdits,
    resetSystemDefaults,
    isResetting: resetThresholdsMutation.isPending,
    isApplyingSuggestion: applyFuzzySuggestionMutation.isPending,
    suggestedValues,
    aiR2,
    aiInRangeNow,
    aiInRangeSuggested,
    aiDeltaPct,
    aiReasonText,
    applyAiFuzzySuggestion,
    kpiInRangePct,
    kpiBreachedCount,
    kpiOwnerReviewsCount,
    kpiAiAvailable,
    toastMessage: toast.message,
  }
}
