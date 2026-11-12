import { useActiveAlertList } from '@/hooks/alert/useActiveAlertList'
import { useAlertLevelCounts } from '@/hooks/alert/useAlertLevelCounts'
import type { useAlertsScope } from '@/hooks/alert/useAlertsScope'
import { usePagedAlertList } from '@/hooks/alert/usePagedAlertList'
import { useResolvedAlertList } from '@/hooks/alert/useResolvedAlertList'
import {
  ACTIVE_ALERT_STATUSES,
  CLOSED_ALERT_STATUSES,
  countBySeverityLevel,
  filterAlerts,
  sortAlerts,
  uniqueById,
} from '@/utils/alertList.utils'

// Không có sự kiện socket khi cảnh báo đổi trạng thái nên phần "Đang hiệu lực" tải lại định kỳ khi tab đang hiện
const ACTIVE_REFRESH_INTERVAL_MS = 30 * 1000

type AlertsScope = ReturnType<typeof useAlertsScope>

// Dữ liệu danh sách của tab Cảnh báo theo phạm vi và bộ lọc đang chọn: danh sách, số theo mức cho dải tóm tắt, tổng "Đang
// hiệu lực", trạng thái tải và hàm thử lại.
// Chọn một nhà: backend chưa lọc nhà gồm cả tầng nên tải đủ cảnh báo của farm rồi lọc trên máy (Known debt); còn lại
// phân trang và lọc ở server, số trên dải mức lấy từ meta.total
export function useAlertsListData(scope: AlertsScope, isFocused: boolean) {
  const isResolved = scope.segment === 'resolved'
  const isHouseMode = Boolean(scope.house)
  const serverFilter = { farmId: scope.farmId, zoneId: null, type: scope.type, verdict: scope.verdict }
  // Tab vẫn sống khi chuyển tab khác: chỉ tải lại định kỳ khi đang hiện
  const pollInterval = isFocused ? ACTIVE_REFRESH_INTERVAL_MS : false
  const serverEnabled = scope.isReady && !isHouseMode
  const pagedQuery = usePagedAlertList({
    statuses: isResolved ? CLOSED_ALERT_STATUSES : ACTIVE_ALERT_STATUSES,
    filter: serverFilter,
    level: scope.severity,
    enabled: serverEnabled,
    refetchInterval: isResolved ? false : pollInterval,
  })
  const levelCountsQuery = useAlertLevelCounts({
    statuses: isResolved ? CLOSED_ALERT_STATUSES : ACTIVE_ALERT_STATUSES,
    filter: serverFilter,
    enabled: serverEnabled,
    refetchInterval: isResolved ? false : pollInterval,
  })
  // Số trên chip "Đang hiệu lực" khi đang xem "Đã đóng" (cùng khoá với dải mức của phần đang hiệu lực)
  const activeCountsQuery = useAlertLevelCounts({
    statuses: ACTIVE_ALERT_STATUSES,
    filter: serverFilter,
    enabled: serverEnabled,
    refetchInterval: pollInterval,
  })
  const activeQuery = useActiveAlertList(scope.farmId, scope.isReady && isHouseMode, isFocused)
  const resolvedQuery = useResolvedAlertList(scope.farmId, scope.isReady && isHouseMode && isResolved)

  const houseQuery = isResolved ? resolvedQuery : activeQuery
  const baseFilter = {
    houseId: scope.house?._id ?? null,
    houseZoneIds: scope.zones.map(zone => zone._id),
    zoneId: scope.zoneId,
    type: scope.type,
    verdict: scope.verdict,
  }
  // Chế độ một nhà: dải tóm tắt đếm theo mọi bộ lọc trừ mức; danh sách lọc thêm mức đang chọn
  const houseSource = filterAlerts(houseQuery.data ?? [], baseFilter)
  const houseFiltered = filterAlerts(houseSource, { ...baseFilter, severity: scope.severity })
  const alerts = isHouseMode
    ? isResolved
      ? houseFiltered
      : sortAlerts(houseFiltered)
    : uniqueById(pagedQuery.data?.pages.flatMap(page => page.items) ?? [])
  const counts = isHouseMode ? countBySeverityLevel(houseSource) : (levelCountsQuery.data ?? null)
  const activeCounts = isHouseMode
    ? countBySeverityLevel(filterAlerts(activeQuery.data ?? [], baseFilter))
    : activeCountsQuery.data
  const activeTotal = activeCounts ? activeCounts.P1 + activeCounts.P2 + activeCounts.P3 : null
  // Không tải được danh sách farm thì query cảnh báo không bao giờ chạy: báo lỗi, không quay khung xương mãi
  const isListLoading =
    !scope.isFarmsError && (!scope.isReady || (isHouseMode ? houseQuery.isLoading : pagedQuery.isLoading))
  const isListError = scope.isFarmsError || (isHouseMode ? houseQuery.isError : pagedQuery.isError)
  const retryList = () => {
    // Tải được farm thì query cảnh báo tự chạy
    if (scope.isFarmsError) return void scope.retryFarms()
    if (isHouseMode) return void houseQuery.refetch()
    void pagedQuery.refetch()
    void levelCountsQuery.refetch()
  }

  return {
    alerts,
    counts,
    activeTotal,
    isHouseMode,
    isListLoading,
    isListError,
    // Dải mức: không tải được số thì vẫn hiện "_", không quay khung xương mãi
    isCountsError: levelCountsQuery.isError,
    retryList,
    hasNextPage: !isHouseMode && pagedQuery.hasNextPage,
    isFetchingNextPage: pagedQuery.isFetchingNextPage,
    fetchNextPage: () => void pagedQuery.fetchNextPage(),
  }
}
