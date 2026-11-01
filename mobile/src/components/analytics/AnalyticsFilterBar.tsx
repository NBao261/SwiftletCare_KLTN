import { ChoiceChips, type ChoiceOption } from '@/components/analytics/ChoiceChips'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import { t } from '@/utils/i18n.utils'

// Giá trị chip "Tất cả tầng"
const ALL_ZONES = '__all__'

interface AnalyticsFilterBarProps {
  scope: AnalyticsScope
}

// Chip tầng ở đầu màn Phân tích (đặc tả §3.1), dùng chung mọi tab và cả 4 ô KPI: ẩn khi nhà một tầng,
// mờ ở tab Đàn chim vì đàn chim tính theo nhà. Chip khoảng thời gian nằm dưới hàng tab (AnalyticsRangeChips)
export function AnalyticsFilterBar({ scope }: AnalyticsFilterBarProps) {
  if (scope.zones.length < 2) return null

  const zoneOptions: ChoiceOption<string>[] = [
    { id: ALL_ZONES, label: t('Tất cả tầng') },
    ...scope.zones.map(zone => ({ id: zone._id, label: zone.name })),
  ]

  return (
    <ChoiceChips
      options={zoneOptions}
      selectedId={scope.selectedZoneId ?? ALL_ZONES}
      onSelect={id => scope.selectZone(id === ALL_ZONES ? null : id)}
      disabled={scope.tab === 'birds'}
      accessibilityLabel={t('Chọn tầng')}
    />
  )
}
