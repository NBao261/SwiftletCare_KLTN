import { StyleSheet, View } from 'react-native'
import { HealthStatusBadge } from '@/components/health/HealthStatusBadge'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HouseHealthDay } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { formatHealthReason } from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'

interface HealthStatusSummaryProps {
  day: HouseHealthDay
}

// Trạng thái và lý do hệ thống tính cho một ngày (BR-29): dùng ở chi tiết ngày và ở đầu form chấm, vì người chấm xem trạng
// thái trước rồi mới xác nhận hoặc sửa (BR-31, Report 3 4.2.14)
export function HealthStatusSummary({ day }: HealthStatusSummaryProps) {
  const palette = usePalette()

  return (
    <Card accessibilityLabel={t('Trạng thái của hệ thống')}>
      <View style={styles.statusRow}>
        <Text variant="body" weight="semiBold" style={styles.flex}>
          {t('Trạng thái của hệ thống')}
        </Text>
        <HealthStatusBadge status={day.current_status} />
      </View>
      {day.computed_at && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Tính lúc {time}', { time: formatDateTime(day.computed_at) })}
        </Text>
      )}

      <Text variant="small" weight="semiBold">
        {t('Lý do')}
      </Text>
      {day.current_reasons.length === 0 ? (
        <Text variant="small" color={palette.textSecondary}>
          _
        </Text>
      ) : (
        day.current_reasons.map((reason, index) => (
          <Text key={`${reason.code}-${reason.source ?? 'none'}-${index}`} variant="small">
            {`• ${formatHealthReason(reason)}`}
          </Text>
        ))
      )}

      <Text variant="small" color={palette.textSecondary}>
        {t('Trạng thái là chỉ báo từ dữ liệu, không phải chẩn đoán.')}
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
})
