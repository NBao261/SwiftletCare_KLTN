import { getScopeKey, useActiveAlertsOfScopes } from '@/hooks/alert/useActiveAlertsOfScopes'
import { useAutonomies } from '@/hooks/analytics/useAutonomies'
import { useBirdDaily } from '@/hooks/analytics/useBirdDaily'
import { useControlPerformances } from '@/hooks/analytics/useControlPerformances'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import type { AlertSeverity } from '@/types'
import { getHighestSeverity } from '@/utils/alert.utils'
import { averageReturnRate, compareWithPrevious, getRangeDays, type Trend } from '@/utils/analytics.utils'

export interface InRangeKpi {
  // Số thấp hơn giữa % độ ẩm và % nhiệt độ trong ngưỡng — đều là số backend trả (ANALYTICS-FR-008)
  value: number
  metric: 'humidity' | 'temperature'
  zoneName: string
}

export interface AutoKpi {
  value: number
  zoneName: string
  overrideCount: number
}

// Bốn ô tổng quan đầu màn Phân tích (đặc tả §3.2). "Tất cả tầng": ô theo tầng hiện tầng thấp nhất.
// Chỉ tải dữ liệu của ô; nội dung tab tải khi mở tab
export function useAnalyticsKpis(scope: AnalyticsScope, today: string) {
  const houseId = scope.house?._id ?? ''
  const zoneIds = scope.selectedZoneId ? [scope.selectedZoneId] : scope.zones.map(zone => zone._id)
  const zoneName = (zoneId: string) => scope.zones.find(zone => zone._id === zoneId)?.name ?? '_'

  const birdQuery = useBirdDaily(houseId, getRangeDays(scope.range), today)
  const performances = useControlPerformances(zoneIds, scope.range)
  const autonomies = useAutonomies(zoneIds, scope.range)
  const alerts = useActiveAlertsOfScopes(
    houseId ? [{ houseId }, ...scope.zones.map(zone => ({ zoneId: zone._id }))] : [],
  )

  const currentRate = birdQuery.data ? averageReturnRate(birdQuery.data.current) : null
  const previousRate = birdQuery.data ? averageReturnRate(birdQuery.data.previous) : null
  const rateTrend: Trend | null = compareWithPrevious(currentRate, previousRate)

  let inRange: InRangeKpi | null = null
  for (const zoneId of zoneIds) {
    const stats = performances.byZone.get(zoneId)?.stats
    const candidates = [
      { metric: 'humidity' as const, value: stats?.humidityInRangePct ?? null },
      { metric: 'temperature' as const, value: stats?.temperatureInRangePct ?? null },
    ].filter((item): item is { metric: 'humidity' | 'temperature'; value: number } => item.value !== null)
    for (const candidate of candidates) {
      if (!inRange || candidate.value < inRange.value) inRange = { ...candidate, zoneName: zoneName(zoneId) }
    }
  }

  let auto: AutoKpi | null = null
  let overrideCount = 0
  for (const zoneId of zoneIds) {
    const result = autonomies.byZone.get(zoneId)
    if (!result) continue
    overrideCount += result.override_count
    if (result.auto_mode_pct !== null && (!auto || result.auto_mode_pct < auto.value)) {
      auto = { value: result.auto_mode_pct, zoneName: zoneName(zoneId), overrideCount: 0 }
    }
  }
  if (auto) auto = { ...auto, overrideCount }

  const scopeAlerts = houseId
    ? [{ houseId }, ...scope.zones.map(zone => ({ zoneId: zone._id }))].map(item =>
        alerts.byScopeKey.get(getScopeKey(item)),
      )
    : []
  const alertTotal = scopeAlerts.reduce((total, item) => total + (item?.total ?? 0), 0)
  const highestSeverity: AlertSeverity | null = getHighestSeverity(scopeAlerts.flatMap(item => item?.alerts ?? []))

  return {
    returnRate: { value: currentRate, previous: previousRate, trend: rateTrend },
    inRange,
    auto,
    alerts: { total: alertTotal, highestSeverity },
    isBirdLoading: birdQuery.isLoading,
    isControlLoading: performances.isLoading,
    isAutoLoading: autonomies.isLoading,
    isAlertLoading: alerts.isLoading,
  }
}
