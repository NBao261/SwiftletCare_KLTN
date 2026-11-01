import { ChoiceChips, type ChoiceOption } from '@/components/analytics/ChoiceChips'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import type { AnalyticsRange } from '@/types'
import { t } from '@/utils/i18n.utils'

// Tab không dùng khoảng thời gian: Sản lượng gộp theo tháng / quý / năm, Báo cáo theo tuần
const TABS_WITHOUT_RANGE = new Set(['harvest', 'reports'])

function getRangeOptions(isEnvironment: boolean): ChoiceOption<AnalyticsRange>[] {
  const common: ChoiceOption<AnalyticsRange>[] = [
    { id: '24h', label: t('24 giờ') },
    { id: '7d', label: t('7 ngày') },
    { id: '30d', label: t('30 ngày') },
  ]
  // 1 giờ, 6 giờ chỉ ở tab Môi trường (ANALYTICS-FR-001)
  return isEnvironment ? [{ id: '1h', label: t('1 giờ') }, { id: '6h', label: t('6 giờ') }, ...common] : common
}

interface AnalyticsRangeChipsProps {
  scope: AnalyticsScope
}

// Chip khoảng thời gian ngay dưới hàng tab nội bộ, dính cùng hàng tab khi cuộn — đi với nội dung tab đang mở
// (ô KPI cũng tính theo khoảng này); ẩn ở tab không dùng khoảng thời gian
export function AnalyticsRangeChips({ scope }: AnalyticsRangeChipsProps) {
  if (TABS_WITHOUT_RANGE.has(scope.tab)) return null
  const isEnvironment = scope.tab === 'env'

  return (
    <ChoiceChips
      options={getRangeOptions(isEnvironment)}
      selectedId={isEnvironment ? scope.storedRange : scope.range}
      onSelect={scope.selectRange}
      accessibilityLabel={t('Chọn khoảng thời gian')}
    />
  )
}
