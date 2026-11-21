import { StyleSheet, View } from 'react-native'
import { HealthStatusBadge } from '@/components/health/HealthStatusBadge'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HealthDisagreementDay } from '@/types'
import { formatHealthDate, formatHealthReason, getHealthStatusLabel } from '@/utils/healthDay.utils'
import { getRoleLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

interface DisagreementDayRowProps {
  day: HealthDisagreementDay
  hasDivider: boolean
}

// Một ngày có đánh giá lệch (EXPERT-FR-022): ngày, trạng thái hiện tại của hệ thống, rồi từng người chấm — họ chọn gì, hệ thống
// lúc đó ra gì, lý do của hệ thống và ghi chú của người chấm. Giúp người quyết định mức thấy mức nào không khớp thực tế
export function DisagreementDayRow({ day, hasDivider }: DisagreementDayRowProps) {
  const palette = usePalette()

  return (
    <View style={[styles.row, hasDivider && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider }]}>
      <View style={styles.header}>
        <Text variant="body" weight="semiBold" style={styles.flex}>
          {formatHealthDate(day.date)}
        </Text>
        <HealthStatusBadge status={day.current_status} />
      </View>
      {day.disagreements.map(item => (
        <View key={`${item.at}-${item.assessor.role}`} style={[styles.item, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold">
            {t('{name} ({role}) chấm {rating}, hệ thống lúc đó {system}', {
              name: item.assessor.full_name ?? '_',
              role: getRoleLabel(item.assessor.role),
              rating: getHealthStatusLabel(item.rating),
              system: getHealthStatusLabel(item.snapshot_status),
            })}
          </Text>
          {item.snapshot_reasons.map(reason => (
            <Text key={`${reason.code}-${reason.source ?? ''}`} variant="small" color={palette.textSecondary}>
              {`· ${formatHealthReason(reason)}`}
            </Text>
          ))}
          {item.note ? (
            <Text variant="small">{t('Ghi chú: {note}', { note: item.note })}</Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm, paddingVertical: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  item: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.md },
})
