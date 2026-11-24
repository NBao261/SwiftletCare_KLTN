import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { ReportMetrics } from '@/components/analytics/ReportMetrics'
import { StatRow } from '@/components/analytics/StatRow'
import { RemindExpertButton } from '@/components/common/RemindExpertButton'
import { HealthDayRow } from '@/components/health/HealthDayRow'
import { HealthStatusBadge } from '@/components/health/HealthStatusBadge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HealthDayStatus, HouseHealthReport } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { formatDecimal, formatPercentValue } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

const STATUS_ORDER: readonly HealthDayStatus[] = ['GOOD', 'WATCH', 'ACTION', 'INSUFFICIENT_DATA']

interface HouseReportDetailProps {
  report: HouseHealthReport
  // Farm có chuyên gia thì luôn có mục kết luận (kể cả khi chưa viết)
  hasExpert: boolean
  // Chuyên gia viết / sửa kết luận (EXPERT-FR-006); không truyền thì chỉ xem
  onEditConclusion?: () => void
  // Farm Owner trên farm có chuyên gia nhắc chuyên gia viết kết luận khi chưa có (BR-22 nhóm C)
  canRemindExpert?: boolean
}

// Phần mở rộng của một báo cáo theo nhà (EXPERT-FR-005/006): trạng thái các ngày, đàn chim,
// thời tiết, các ngày, từng Zone, kết luận của chuyên gia
export function HouseReportDetail({ report, hasExpert, onEditConclusion, canRemindExpert = false }: HouseReportDetailProps) {
  const palette = usePalette()
  const counts = STATUS_ORDER.flatMap(status => {
    const count = report.status_counts?.[status] ?? 0
    return count > 0 ? [{ status, count }] : []
  })
  const metrics = report.house_metrics
  const weather = metrics?.weather ?? null
  const incompleteDays = (metrics?.return_rate_trend ?? []).filter(item => !item.complete).length
  const days = report.days ?? []
  const zones = report.zone_sections ?? []
  const conclusion = report.expert_conclusion

  return (
    <View style={styles.detail}>
      <View style={styles.section}>
        <Text variant="small" weight="semiBold">
          {t('Trạng thái các ngày')}
        </Text>
        {counts.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            _
          </Text>
        ) : (
          <View style={styles.badges}>
            {counts.map(({ status, count }) => (
              <View key={status} style={styles.badgeCount}>
                <HealthStatusBadge status={status} />
                <Text variant="small" weight="semiBold">
                  {formatDecimal(count)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="small" weight="semiBold">
          {t('Đàn chim')}
        </Text>
        <StatRow
          label={t('Tỉ lệ về tổ trung bình')}
          value={metrics?.avg_return_rate === null || metrics?.avg_return_rate === undefined ? '_' : formatPercentValue(metrics.avg_return_rate)}
        />
        {incompleteDays > 0 && (
          <Text variant="small" color={palette.textSecondary}>
            {t('{count} ngày thiếu phiên đếm', { count: incompleteDays })}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="small" weight="semiBold">
          {t('Thời tiết')}
        </Text>
        {weather ? (
          <>
            <StatRow
              label={t('Nhiệt độ')}
              value={
                weather.temperature_min === null || weather.temperature_max === null
                  ? '_'
                  : `${formatDecimal(weather.temperature_min, 1)} – ${formatDecimal(weather.temperature_max, 1)} °C`
              }
            />
            <StatRow
              label={t('Lượng mưa')}
              value={weather.precipitation_mm === null ? '_' : `${formatDecimal(weather.precipitation_mm, 1)} mm`}
            />
            <StatRow label={t('Số ngày mưa')} value={formatDecimal(weather.rain_days)} />
          </>
        ) : (
          <Text variant="small" color={palette.textSecondary}>
            {t('Không có dữ liệu thời tiết')}
          </Text>
        )}
      </View>

      {days.length > 0 && (
        <View style={styles.section}>
          <Text variant="small" weight="semiBold">
            {t('Các ngày')}
          </Text>
          {days.map((day, index) => (
            <HealthDayRow
              key={day._id}
              day={day}
              hasDivider={index < days.length - 1}
              onPress={() => router.push({ pathname: '/health/[dayId]', params: { dayId: day._id } })}
            />
          ))}
        </View>
      )}

      {zones.map(section => (
        <View key={section.zone_id} style={[styles.section, styles.zone, { borderTopColor: palette.divider }]}>
          <Text variant="small" weight="semiBold">
            {section.zone_name}
          </Text>
          <ReportMetrics section={section} />
        </View>
      ))}

      {/* Farm chưa có chuyên gia thì không có mục kết luận */}
      {(hasExpert || conclusion) && (
        <View style={[styles.conclusion, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold">
            {t('Kết luận của chuyên gia')}
          </Text>
          {conclusion ? (
            <>
              <Text variant="body">{conclusion.text}</Text>
              <Text variant="small" color={palette.textSecondary}>
                {`${conclusion.by.full_name} · ${formatDateTime(conclusion.edited_at ?? conclusion.at)}`}
              </Text>
            </>
          ) : (
            <>
              <Text variant="small" color={palette.textSecondary}>
                {t('Chưa có kết luận')}
              </Text>
              {canRemindExpert && (
                <RemindExpertButton kind="health_report" id={report._id} remindedAt={report.expert_reminded_at} />
              )}
            </>
          )}
          {onEditConclusion && (
            <Button label={conclusion ? t('Sửa kết luận') : t('Viết kết luận')} variant="link" onPress={onEditConclusion} />
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  detail: { gap: Spacing.lg, paddingBottom: Spacing.md },
  section: { gap: Spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  badgeCount: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  zone: { borderTopWidth: BorderWidth.hairline, paddingTop: Spacing.md },
  conclusion: { borderRadius: Radius.sm, padding: Spacing.md, gap: Spacing.xs },
})
