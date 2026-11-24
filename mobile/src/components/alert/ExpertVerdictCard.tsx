import { StyleSheet, View } from 'react-native'
import { SealCheckIcon, XCircleIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertVerdict } from '@/types'
import { getVerdictActorName } from '@/utils/alertDetail.utils'
import { formatDateTime } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

interface ExpertVerdictCardProps {
  verdict: AlertVerdict
}

// Kết luận kiểm chứng của cảnh báo suy luận (EXPERT-FR-003), đặt đầu chi tiết cảnh báo: đúng hay bác bỏ, ai, lúc nào và ghi
// chú / hướng dẫn hiện đủ. Farm chưa có chuyên gia thì chủ trại kết luận (BR-22) nên không ghi "Chuyên gia". Màu chữ thường,
// không dùng xanh / cam (quy tắc màu: lime cho thiết bị bật, cam cho cảnh báo)
export function ExpertVerdictCard({ verdict }: ExpertVerdictCardProps) {
  const palette = usePalette()
  const isConfirmed = verdict.result === 'CONFIRMED'
  const isOwnerVerdict = verdict.role === 'FARM_OWNER'
  const VerdictIcon = isConfirmed ? SealCheckIcon : XCircleIcon
  const resultText = isOwnerVerdict
    ? isConfirmed
      ? t('Đã kiểm chứng: đúng')
      : t('Đã bác bỏ')
    : isConfirmed
      ? t('Chuyên gia đã kiểm chứng: đúng')
      : t('Chuyên gia đã bác bỏ')

  return (
    <Card style={styles.card}>
      <Text variant="small" color={palette.textSecondary}>
        {isOwnerVerdict ? t('Kết luận kiểm chứng') : t('Chuyên gia đánh giá')}
      </Text>
      <View style={styles.resultRow}>
        <VerdictIcon size={20} color={palette.text} weight="fill" />
        <Text variant="body" weight="semiBold" style={styles.flex}>
          {resultText}
        </Text>
      </View>
      <Text variant="small" color={palette.textSecondary}>
        {t('Kết luận lúc {time} bởi {name}', { time: formatDateTime(verdict.at), name: getVerdictActorName(verdict) })}
      </Text>
      {verdict.note ? <Text variant="body">{verdict.note}</Text> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1, minWidth: 0 },
})
