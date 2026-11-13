import { StyleSheet, View } from 'react-native'
import { StatRow } from '@/components/analytics/StatRow'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertType, HealthReportZoneSection } from '@/types'
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

// Tên ngắn của loại cảnh báo; loại backend thêm sau mà app chưa có tên thì hiện nguyên mã
function alertTypeLabel(type: string): string {
  return getAlertTypeShortLabel(type as AlertType) || type
}

// Các loại có số lớn hơn 0
function countEntries(counts: Partial<Record<string, number>> | undefined): [string, number][] {
  return Object.entries(counts ?? {}).flatMap(([type, count]) => (count && count > 0 ? [[type, count] as [string, number]] : []))
}

// Số liệu một Zone trong báo cáo theo nhà (EXPERT-FR-005, schema HouseHealthReport.zone_sections)
export function ReportMetrics({ section }: { section: HealthReportZoneSection }) {
  const palette = usePalette()
  const alertEntries = countEntries(section.alerts_by_type)
  const faultEntries = countEntries(section.device_faults)
  const inferred = section.inferred_alerts

  return (
    <View style={styles.metrics}>
      <StatRow label={t('Độ ẩm trong ngưỡng')} value={percent(section.humidity_in_range_pct)} />
      <StatRow label={t('Nhiệt độ trong ngưỡng')} value={percent(section.temp_in_range_pct)} />
      <StatRow label={t('Thời gian tự động')} value={percent(section.auto_mode_pct)} />
      <StatRow label={t('Đóng ngắt phun sương')} value={t('{count} lần', { count: formatDecimal(section.misting_switches) })} />
      <StatRow label={t('Đóng ngắt quạt')} value={t('{count} lần', { count: formatDecimal(section.ventilation_switches) })} />
      <StatRow label={t('NH₃ trung bình / cao nhất')} value={averageAndMax(section.nh3_avg, section.nh3_max)} />
      <StatRow label={t('CO₂ trung bình / cao nhất')} value={averageAndMax(section.co2_avg, section.co2_max)} />
      <Text variant="small" weight="semiBold" color={palette.text}>
        {t('Cảnh báo theo loại')}
      </Text>
      {alertEntries.length === 0 ? (
        <Text variant="small" color={palette.textSecondary}>
          {t('Không có cảnh báo trong kỳ')}
        </Text>
      ) : (
        alertEntries.map(([type, count]) => (
          <StatRow key={type} label={alertTypeLabel(type)} value={formatDecimal(count)} isWarning />
        ))
      )}
      {inferred && (
        <StatRow
          label={t('Cảnh báo suy luận: đúng / bác bỏ / chờ')}
          value={`${formatDecimal(inferred.confirmed)} / ${formatDecimal(inferred.dismissed)} / ${formatDecimal(inferred.pending)}`}
        />
      )}
      {faultEntries.length > 0 && (
        <>
          <Text variant="small" weight="semiBold" color={palette.text}>
            {t('Lỗi thiết bị')}
          </Text>
          {faultEntries.map(([type, count]) => (
            <StatRow key={type} label={alertTypeLabel(type)} value={formatDecimal(count)} isWarning />
          ))}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  metrics: { gap: Spacing.sm },
})
