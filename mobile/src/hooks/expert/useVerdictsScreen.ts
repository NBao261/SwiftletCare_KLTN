import { useCallback, useEffect, useMemo, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { expertApi } from '@/services/api/expert.api'
import { useSetAlertVerdict, useVerdictStats } from '@/hooks/expert/useInferredAlerts'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { onNotificationNew } from '@/services/socket/socketClient'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { InferredAlert, VerdictResult } from '@/types'
import { t } from '@/utils/i18n.utils'

const PAGE_SIZE = 20

// Chỉ 3 trạng thái kiểm chứng (backend lọc inferred-only khi có verdict) — không còn "Tất cả" trộn lẫn
// cảnh báo thiết bị. KPI tổng vẫn hiển thị nhờ cộng từ verdict-stats.
export type VerdictFilter = 'PENDING' | 'CONFIRMED' | 'REJECTED'

const VERDICT_PARAM: Record<VerdictFilter, 'pending' | 'confirmed' | 'rejected'> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
}

/**
 * Logic nghiệp vụ màn Thẩm định (EXPERT-FR-003): KPI lấy từ /alerts/verdict-stats (toàn bộ, mọi trang),
 * danh sách lọc theo verdict ở server và tải thêm theo meta (không cắt trên máy), ghi phán quyết kèm toast.
 * Lọc zone_id dùng chung cho cả KPI và danh sách: cảnh báo cấp nhà (LOW_RETURN_RATE) chỉ hiện khi chọn "Tất cả tầng".
 */
export function useVerdictsScreen() {
  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)
  const selectedZoneId = useExpertScopeStore(state => state.selectedZoneId)

  const [statusFilter, setStatusFilter] = useState<VerdictFilter>('PENDING')
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL')

  const toast = useToastMessage()
  const setAlertVerdict = useSetAlertVerdict()
  const queryClient = useQueryClient()

  // Realtime: thông báo mới (cảnh báo suy luận mới / đổi phán quyết) làm mới danh sách và thống kê (EXPERT-FR-007)
  useEffect(() => {
    const unsubscribe = onNotificationNew(() => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'inferred-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'verdict-stats'] })
    })
    return unsubscribe
  }, [queryClient])

  const farmId = selectedFarmId || undefined
  const zoneId = selectedZoneId || undefined

  const statsQuery = useVerdictStats({ farm_id: farmId, zone_id: zoneId })

  const listParams = useMemo(
    () => ({
      farm_id: farmId,
      zone_id: zoneId,
      verdict: VERDICT_PARAM[statusFilter],
      type: selectedType !== 'ALL' ? selectedType : undefined,
      severity: selectedSeverity !== 'ALL' ? selectedSeverity : undefined,
    }),
    [farmId, zoneId, statusFilter, selectedType, selectedSeverity]
  )

  const listQuery = useInfiniteQuery({
    queryKey: ['expert', 'inferred-alerts', 'paged', listParams],
    queryFn: ({ pageParam }) =>
      expertApi.getInferredAlerts({ ...listParams, page: pageParam, limit: PAGE_SIZE }).then(res => res.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
  })

  // Cộng theo loại từ verdict-stats để ra tổng thật, không phụ thuộc trang đầu của danh sách
  const kpi = useMemo(() => {
    const stats = statsQuery.data?.data ?? []
    let pending = 0
    let confirmed = 0
    let rejected = 0
    for (const row of stats) {
      pending += row.pending
      confirmed += row.confirmed
      rejected += row.rejected
    }
    const reviewed = confirmed + rejected
    return {
      total: pending + confirmed + rejected,
      pending,
      confirmed,
      rejected,
      confirmRate: reviewed > 0 ? Math.round((confirmed / reviewed) * 100) : 0,
    }
  }, [statsQuery.data])

  const alerts = useMemo<InferredAlert[]>(
    () => listQuery.data?.pages.flatMap(page => page.data) ?? [],
    [listQuery.data]
  )

  const submitVerdict = useCallback(
    async (alertId: string, result: VerdictResult, note?: string) => {
      try {
        await setAlertVerdict.mutateAsync({ alertId, result, note })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
        toast.show(
          result === 'CONFIRMED'
            ? t('Đã xác nhận cảnh báo đúng')
            : t('Đã bác bỏ cảnh báo ảo và gửi lý do')
        )
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
        toast.show(t('Không thể lưu kết luận thẩm định, vui lòng thử lại'))
      }
    },
    [setAlertVerdict, toast]
  )

  const refetchAll = useCallback(() => {
    void listQuery.refetch()
    void statsQuery.refetch()
  }, [listQuery, statsQuery])

  return {
    kpi,
    alerts,
    statusFilter,
    setStatusFilter,
    selectedType,
    setSelectedType,
    selectedSeverity,
    setSelectedSeverity,
    hasAdvancedFilter: selectedType !== 'ALL' || selectedSeverity !== 'ALL',
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    isRefetching: listQuery.isRefetching,
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    fetchNextPage: listQuery.fetchNextPage,
    refetchAll,
    submitVerdict,
    isSubmitting: setAlertVerdict.isPending,
    toastMessage: toast.message,
  }
}
