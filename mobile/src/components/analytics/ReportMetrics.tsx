import { StyleSheet, View } from 'react-native'
import { StatRow } from '@/components/analytics/StatRow'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertType, ZoneHealthMetrics } from '@/types'
import { getAlertTypeShortLabel } from '@/utils/label.utils'
import { formatDecimal, formatPercentValue } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

// Phần trăm hoặc "_"
function percent(value: number | null): string {
  return value === null ? '_' : formatPercentValue(value)
}

// "12,3 / 25,0 ppm"; thiếu thì "_"
function averageAndMax(average: number | null, max: number | null): string {
  if (average === null && max === null) return '_'
  const format = (value: number | null) => (value === null ? '_' : formatDecimal(value, 1))
  return `${format(average)} / ${format(max)} ppm`
}

// Số liệu một kỳ báo cáo (EXPERT-FR-005), đúng các trường backend tính (healthReport.service buildZoneMetrics)
export function ReportMetrics({ metrics }: { metrics: ZoneHealthMetrics }) {
  const palette = usePalette()
  const alertEntries = (Object.entries(metrics.alerts_by_type) as [AlertType, number][]).filter(
    ([, count]) => count > 0,
  )

  return (
    <View style={styles.metrics}>
      <StatRow label={t('Độ ẩm trong ngưỡng')} value={percent(metrics.humidity_in_range_pct)} />
      <StatRow label={t('Nhiệt độ trong ngưỡng')} value={percent(metrics.temp_in_range_pct)} />
      <StatRow label={t('Thời gian tự động')} value={percent(metrics.auto_mode_pct)} />
      <StatRow
        label={t('Đóng ngắt phun sương')}
        value={t('{count} lần', { count: formatDecimal(metrics.misting_switches) })}
      />
      <StatRow
        label={t('Đóng ngắt quạt')}
        value={t('{count} lần', { count: formatDecimal(metrics.ventilation_switches) })}
      />
      <StatRow label={t('Tỉ lệ về tổ trung bình')} value={percent(metrics.avg_return_rate)} />
      <StatRow label={t('NH₃ trung bình / cao nhất')} value={averageAndMax(metrics.nh3_avg, metrics.nh3_max)} />
      <StatRow label={t('CO₂ trung bình / cao nhất')} value={averageAndMax(metrics.co2_avg, metrics.co2_max)} />
      <Text variant="small" weight="semiBold" color={palette.text}>
        {t('Cảnh báo theo loại')}
      </Text>
      {alertEntries.length === 0 ? (
        <Text variant="small" color={palette.textSecondary}>
          {t('Không có cảnh báo trong kỳ')}
        </Text>
      ) : (
        alertEntries.map(([type, count]) => (
          <StatRow key={type} label={getAlertTypeShortLabel(type)} value={formatDecimal(count)} isWarning />
        ))
      )}
      {/* Báo cáo chưa chia cảnh báo suy luận theo xác nhận / bác bỏ / chờ */}
      <ComingSoonAction label={t('Cảnh báo suy luận theo kết quả kiểm chứng')} />
    </View>
  )
}

const styles = StyleSheet.create({
  metrics: { gap: Spacing.sm },
})
