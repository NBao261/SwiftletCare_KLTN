import { useState } from 'react'
import { router } from 'expo-router'
import { ThermometerIcon } from 'phosphor-react-native'
import { MAX_DETAIL_ITEMS, StatDetailSheet } from '@/components/home/StatDetailSheet'
import { StatTile, type StatTone } from '@/components/home/StatTile'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useZonesOfHouses } from '@/hooks/farm/useZonesOfHouses'
import { useLatestTelemetryOfZones } from '@/hooks/telemetry/useLatestTelemetryOfZones'
import type { Zone } from '@/types'
import { getMetricLabel } from '@/utils/label.utils'
import { getBreachedMetrics, isRecentReading, type ThresholdMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

interface ZoneBreach {
  zone: Zone
  metrics: ThresholdMetric[]
}

// Các chỉ số đang lệch, nối bằng dấu phẩy ("Nhiệt độ, Độ ẩm")
function joinMetricLabels(metrics: Iterable<ThresholdMetric>): string {
  return [...metrics].map(getMetricLabel).join(', ')
}

// Câu tóm tắt: một tầng thì "chỉ số · tên tầng", nhiều tầng thì gộp các chỉ số đang lệch
function getBreachSummary(zoneCount: number, breaches: ZoneBreach[]): string {
  if (zoneCount === 0) return t('Chưa có tầng')
  if (breaches.length === 0) return t('Tất cả trong ngưỡng')
  if (breaches.length === 1) return `${joinMetricLabels(breaches[0].metrics)} · ${breaches[0].zone.name}`
  return joinMetricLabels(new Set(breaches.flatMap(breach => breach.metrics)))
}

// Icon cam khi có tầng lệch; còn lại giữ màu trung tính (xanh chỉ dành cho thiết bị online)
function getBreachTone(isReady: boolean, breachCount: number): StatTone {
  return isReady && breachCount > 0 ? 'problem' : 'neutral'
}

// Ô 3: số tầng có số đo mới nhất nằm ngoài ngưỡng của tầng, cộng mọi Farm
export function ZoneThresholdStatTile() {
  const [isSheetOpen, setSheetOpen] = useState(false)
  const housesQuery = useAllHouses()
  const zonesQuery = useZonesOfHouses(housesQuery.houses.map(house => house._id))
  const telemetryQuery = useLatestTelemetryOfZones(zonesQuery.zones.map(zone => zone._id))

  const isReady = ![housesQuery, zonesQuery, telemetryQuery].some(query => query.isLoading || query.isError)
  const zoneCount = zonesQuery.zones.length
  // Tầng chưa có số đo, hoặc số đo đã cũ (thiết bị ngừng gửi), thì bỏ qua
  const breaches: ZoneBreach[] = zonesQuery.zones.flatMap(zone => {
    const record = telemetryQuery.latestByZoneId.get(zone._id)
    const metrics = record && isRecentReading(record) ? getBreachedMetrics(record, zone.thresholds) : []
    return metrics.length > 0 ? [{ zone, metrics }] : []
  })
  const value = isReady ? String(breaches.length) : '_'

  // Một tầng lệch thì vào thẳng tầng đó
  const handleViewAll = () => {
    if (breaches.length === 1) {
      router.push({ pathname: '/zone/[zoneId]', params: { zoneId: breaches[0].zone._id } })
      return
    }
    // shortcut: chưa có màn danh sách tầng lệch nhóm theo nhà — tạm mở tab Trang trại
    router.navigate('/(tabs)/farms')
  }

  return (
    <>
      <StatTile
        icon={ThermometerIcon}
        tone={getBreachTone(isReady, breaches.length)}
        label={t('Ngưỡng')}
        value={value}
        onPress={() => setSheetOpen(true)}
        isLoading={[housesQuery, zonesQuery, telemetryQuery].some(query => query.isLoading)}
      />
      <StatDetailSheet
        visible={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('Khu vực vượt ngưỡng')}
        value={value}
        summary={isReady ? getBreachSummary(zoneCount, breaches) : '_'}
        items={breaches.slice(0, MAX_DETAIL_ITEMS).map(({ zone, metrics }) => ({
          key: zone._id,
          title: zone.name,
          description: joinMetricLabels(metrics),
          isProblem: true,
        }))}
        hiddenCount={Math.max(0, breaches.length - MAX_DETAIL_ITEMS)}
        onViewAll={handleViewAll}
      />
    </>
  )
}
