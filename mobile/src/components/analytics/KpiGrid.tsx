import { StyleSheet, View } from 'react-native'
import { KpiTile } from '@/components/analytics/KpiTile'
import { Spacing } from '@/constants/theme'
import type { useAnalyticsKpis } from '@/hooks/analytics/useAnalyticsKpis'
import type { AnalyticsTab } from '@/stores/farmPrefsStore'
import { getSeverityLabel } from '@/utils/label.utils'
import { formatDecimal, formatPercentValue } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

interface KpiGridProps {
  kpis: ReturnType<typeof useAnalyticsKpis>
  // "Tất cả tầng": ô theo tầng ghi tên tầng thấp nhất
  isAllZones: boolean
  onSelectTab: (tab: AnalyticsTab) => void
  onOpenAlerts: () => void
}

// Bốn ô tổng quan 2×2 (đặc tả §3.2): tỉ lệ về tổ, trong ngưỡng, tự động, cảnh báo
export function KpiGrid({ kpis, isAllZones, onSelectTab, onOpenAlerts }: KpiGridProps) {
  const { returnRate, inRange, auto, alerts } = kpis
  const isAlertWarning = alerts.highestSeverity === 'CRITICAL' || alerts.highestSeverity === 'HIGH'
  const inRangeMetric = inRange ? (inRange.metric === 'humidity' ? t('Độ ẩm') : t('Nhiệt độ')) : null

  return (
    <View style={styles.grid}>
      <View style={styles.cell}>
        <KpiTile
          label={t('Tỉ lệ về tổ')}
          value={returnRate.value === null ? '_' : formatPercentValue(returnRate.value)}
          caption={
            returnRate.previous === null
              ? t('Chưa có kỳ trước')
              : t('Kỳ trước {value}', { value: formatPercentValue(returnRate.previous) })
          }
          trend={returnRate.trend}
          isLoading={kpis.isBirdLoading}
          onPress={() => onSelectTab('birds')}
          accessibilityHint={t('Mở biểu đồ đàn chim')}
        />
      </View>
      <View style={styles.cell}>
        <KpiTile
          label={t('Trong ngưỡng')}
          value={inRange ? formatPercentValue(inRange.value) : '_'}
          caption={
            inRange ? (isAllZones ? `${inRangeMetric} · ${inRange.zoneName}` : (inRangeMetric ?? undefined)) : undefined
          }
          isLoading={kpis.isControlLoading}
          onPress={() => onSelectTab('control')}
          accessibilityHint={t('Mở hiệu quả điều khiển')}
        />
      </View>
      <View style={styles.cell}>
        <KpiTile
          label={t('Tự động')}
          value={auto ? formatPercentValue(auto.value) : '_'}
          caption={
            auto
              ? t('{count} lần điều khiển tay', { count: formatDecimal(auto.overrideCount) }) +
                (isAllZones ? ` · ${auto.zoneName}` : '')
              : undefined
          }
          isLoading={kpis.isAutoLoading}
          onPress={() => onSelectTab('control')}
          accessibilityHint={t('Mở hiệu quả điều khiển')}
        />
      </View>
      <View style={styles.cell}>
        <KpiTile
          label={t('Cảnh báo')}
          value={t('{count} đang mở', { count: formatDecimal(alerts.total) })}
          caption={alerts.highestSeverity ? getSeverityLabel(alerts.highestSeverity) : t('Không có cảnh báo')}
          isWarning={isAlertWarning}
          isLoading={kpis.isAlertLoading}
          onPress={onOpenAlerts}
          accessibilityHint={t('Mở tab Cảnh báo')}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  // Hai cột: mỗi ô gần nửa hàng, khoảng giữa do gap
  cell: { flexGrow: 1, flexBasis: '40%' },
})
