import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { refetchVisibleQueries } from '@/config/queryClient'
import { CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'
import { Radius, Spacing } from '@/constants/theme'
import { usePendingVerdictAlertCount } from '@/hooks/alert/usePendingVerdictAlertCount'
import { usePendingHealthDays } from '@/hooks/health/usePendingHealthDays'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { getOldestPendingDay, summarizePendingTasks } from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'
import { canPerform } from '@/utils/permission.utils'

const COUNT_BOX_SIZE = 48
// Chiều cao khung xương / khung lỗi: ô số 48 + lề card 16×2
const CARD_HEIGHT = COUNT_BOX_SIZE + Spacing.lg * 2

// Khối "Việc chờ bạn": ngày chờ người dùng chấm (chủ trại, kỹ thuật viên) + cảnh báo chờ chủ phán quyết (chỉ chủ trại);
// hết việc vẫn giữ khối, số là 0
export function PendingTasksCard() {
  const palette = usePalette()
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const pendingDaysQuery = usePendingHealthDays()
  const pendingVerdicts = usePendingVerdictAlertCount(canPerform(user, 'viewOwnerTasks'))

  if (pendingVerdicts.isLoading || pendingDaysQuery.isLoading) {
    return <Skeleton width="100%" height={CARD_HEIGHT} delayMs={HOME_SKELETON_DELAY_MS.tasks} />
  }
  if (pendingVerdicts.isError || pendingDaysQuery.isError) {
    return (
      <EmptyState
        message={t('Không tải được việc chờ bạn')}
        actionLabel={t('Thử lại')}
        onAction={() => refetchVisibleQueries(queryClient)}
        height={CARD_HEIGHT}
      />
    )
  }

  const tasks = summarizePendingTasks(pendingDaysQuery.data, pendingVerdicts.count)
  const { total } = tasks
  const summary = total === 0 ? t('Không có việc nào đang chờ') : tasks.summary
  // Có ngày chờ chấm thì mở thẳng ngày cũ nhất (gần hết hạn nhất) để chấm (BR-31)
  const oldestPendingDay = getOldestPendingDay(pendingDaysQuery.data)
  const openOldestDay = oldestPendingDay
    ? () => router.push({ pathname: '/health/[dayId]', params: { dayId: oldestPendingDay._id } })
    : undefined

  return (
    // shortcut: chưa có màn danh sách cảnh báo chờ phán quyết — chỉ việc chấm ngày mở được từ đây
    <Card
      style={styles.card}
      onPress={openOldestDay}
      accessibilityHint={openOldestDay ? t('Mở ngày chờ đánh giá cũ nhất') : undefined}
      accessibilityLabel={t('Việc chờ bạn: {total} việc, {summary}', { total, summary })}
    >
      {/* Lime chỉ làm chữ trên nền Ink */}
      <View style={[styles.countBox, { backgroundColor: palette.inverse }]}>
        <Text variant="heading" weight="bold" color={palette.primary}>
          {total}
        </Text>
      </View>
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold">
          {t('Việc chờ bạn')}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      {openOldestDay && <CaretRightIcon size={16} color={palette.textSecondary} />}
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
