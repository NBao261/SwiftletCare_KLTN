import { StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { StatRow } from '@/components/analytics/StatRow'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { OnsiteCheck } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { getOnsiteObservationLabel } from '@/utils/label.utils'
import { isOnsiteCheckAnswered } from '@/utils/workOrder.utils'
import { t } from '@/utils/i18n.utils'

const PHOTO_HEIGHT = 180

interface OnsiteCheckCardProps {
  check: OnsiteCheck
}

// Yêu cầu kiểm tra tại chỗ của cảnh báo suy luận và câu trả lời của thợ (EXPERT-FR-021): ai được yêu cầu, lúc nào; đã trả lời thì
// điều quan sát được, ghi chú, ảnh (URL tạm 1 giờ). Câu trả lời đi vào bằng chứng trước khi chuyên gia kết luận
export function OnsiteCheckCard({ check }: OnsiteCheckCardProps) {
  const palette = usePalette()
  const technicianName = check.technician_id?.full_name ?? t('Kỹ thuật viên nhà yến')
  const isAnswered = isOnsiteCheckAnswered(check)

  return (
    <Card style={styles.card}>
      <Text variant="body" weight="semiBold">
        {t('Kiểm tra tại chỗ')}
      </Text>
      <StatRow label={t('Yêu cầu')} value={`${technicianName} · ${formatDateTime(check.requested_at)}`} />
      {isAnswered ? (
        <>
          <StatRow label={t('Quan sát')} value={check.observation ? getOnsiteObservationLabel(check.observation) : '_'} />
          <StatRow
            label={t('Trả lời')}
            value={[check.answered_by?.full_name, check.answered_at ? formatDateTime(check.answered_at) : null]
              .filter(Boolean)
              .join(' · ') || '_'}
          />
          {check.note ? (
            <Text variant="small" color={palette.textSecondary}>
              {check.note}
            </Text>
          ) : null}
          {check.photo_url ? (
            <Image
              source={{ uri: check.photo_url }}
              style={[styles.photo, { backgroundColor: palette.surfaceStrong }]}
              contentFit="cover"
              accessibilityLabel={t('Ảnh kiểm tra tại chỗ')}
            />
          ) : null}
        </>
      ) : (
        <StatRow label={t('Quan sát')} value={t('Chờ kỹ thuật viên trả lời')} isWarning />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  photo: { width: '100%', height: PHOTO_HEIGHT, borderRadius: Radius.md },
})
