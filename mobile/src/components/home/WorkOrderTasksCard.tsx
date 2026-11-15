import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useOpenWorkOrderCount } from '@/hooks/work-order/useOpenWorkOrderCount'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const COUNT_BOX_SIZE = 48
// Chiều cao khung xương / khung lỗi: ô số 48 + lề card 16×2
const CARD_HEIGHT = COUNT_BOX_SIZE + Spacing.lg * 2

// Khối "Work Order" ở Trang chủ (G-21, OPS-FR-001…004): kỹ thuật viên thấy số việc giao cho mình còn mở, chủ trại thấy số việc còn
// mở của farm; chạm để mở danh sách. Hết việc vẫn giữ khối, số là 0
export function WorkOrderTasksCard() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const onlyMine = canPerform(user, 'viewAssignedWorkOrdersOnly')
  const countQuery = useOpenWorkOrderCount(onlyMine, canPerform(user, 'viewWorkOrders'))

  if (countQuery.isLoading) return <Skeleton width="100%" height={CARD_HEIGHT} />
  if (countQuery.isError) {
    return (
      <EmptyState
        message={t('Không tải được Work Order')}
        actionLabel={t('Thử lại')}
        onAction={() => countQuery.refetch()}
        height={CARD_HEIGHT}
      />
    )
  }

  const count = countQuery.data ?? 0
  const title = onlyMine ? t('Work Order giao cho bạn') : t('Work Order đang mở')
  const summary =
    count === 0
      ? t('Không có Work Order nào đang mở')
      : onlyMine
        ? t('{n} việc sửa chữa đang chờ bạn', { n: count })
        : t('{n} việc sửa chữa chưa đóng', { n: count })

  return (
    <Card
      style={styles.card}
      onPress={() => router.push('/work-orders')}
      accessibilityLabel={`${title}: ${summary}`}
      accessibilityHint={t('Mở danh sách Work Order')}
    >
      {/* Lime chỉ làm chữ trên nền Ink */}
      <View style={[styles.countBox, { backgroundColor: palette.inverse }]}>
        <Text variant="heading" weight="bold" color={palette.primary}>
          {count}
        </Text>
      </View>
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold">
          {title}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
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
