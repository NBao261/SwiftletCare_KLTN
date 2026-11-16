import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useDueMaintenance } from '@/hooks/maintenance/useDueMaintenance'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const COUNT_BOX_SIZE = 48
// Chiều cao khung xương / khung lỗi: ô số 48 + lề card 16×2
const CARD_HEIGHT = COUNT_BOX_SIZE + Spacing.lg * 2

// Khối "Bảo trì đến hạn" ở Trang chủ (G-22, OPS-FR-006): số kế hoạch đến hạn hoặc quá hạn của các nhà người dùng được xem, ghi rõ
// số quá hạn; chạm để mở màn Bảo trì. Không còn kế hoạch nào thì vẫn giữ khối, số là 0
export function MaintenanceDueCard() {
  const palette = usePalette()
  const dueQuery = useDueMaintenance()

  if (dueQuery.isLoading) return <Skeleton width="100%" height={CARD_HEIGHT} />
  if (dueQuery.isError) {
    return (
      <EmptyState
        message={t('Không tải được kế hoạch bảo trì')}
        actionLabel={t('Thử lại')}
        onAction={() => dueQuery.refetch()}
        height={CARD_HEIGHT}
      />
    )
  }

  const plans = dueQuery.data ?? []
  const overdue = plans.filter(plan => plan.state === 'OVERDUE').length
  const summary =
    plans.length === 0
      ? t('Không có kế hoạch nào đến hạn')
      : overdue > 0
        ? t('{n} kế hoạch cần bảo trì, {overdue} quá hạn', { n: plans.length, overdue })
        : t('{n} kế hoạch cần bảo trì', { n: plans.length })

  return (
    <Card
      style={styles.card}
      onPress={() => router.push('/maintenance')}
      accessibilityLabel={`${t('Bảo trì đến hạn')}: ${summary}`}
      accessibilityHint={t('Mở màn bảo trì')}
    >
      {/* Lime chỉ làm chữ trên nền Ink */}
      <View style={[styles.countBox, { backgroundColor: palette.inverse }]}>
        <Text variant="heading" weight="bold" color={palette.primary}>
          {plans.length}
        </Text>
      </View>
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold">
          {t('Bảo trì đến hạn')}
        </Text>
        <Text variant="small" color={overdue > 0 ? palette.alert : palette.textSecondary} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      <CaretRightIcon size={16} color={palette.textSecondary} />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  countBox: {
    width: COUNT_BOX_SIZE,
    height: COUNT_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
