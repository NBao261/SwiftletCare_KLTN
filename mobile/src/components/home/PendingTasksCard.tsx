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
import { summarizePendingTasks } from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'
import { canPerform } from '@/utils/permission.utils'

const COUNT_BOX_SIZE = 48
// Chiều cao khung xương / khung lỗi: ô số 48 + lề card 16×2
const CARD_HEIGHT = COUNT_BOX_SIZE + Spacing.lg * 2

// Khối "Đánh giá ngày": ngày chờ người dùng chấm (chủ trại, kỹ thuật viên) + cảnh báo chờ chủ phán quyết (chỉ chủ trại);
// hết việc vẫn giữ khối, số là 0. Còn việc thì bấm mở màn "Đánh giá ngày": mọi ngày chờ chấm (chia theo nhà, mới nhất trước) và
// cảnh báo chờ phán quyết hiện ngay, không phải chọn nhà trước
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
        message={t('Không tải được việc đánh giá')}
        actionLabel={t('Thử lại')}
        onAction={() => refetchVisibleQueries(queryClient)}
        height={CARD_HEIGHT}
      />
    )
  }

  const tasks = summarizePendingTasks(pendingDaysQuery.data, pendingVerdicts.count)
  const { total } = tasks
  const summary = total === 0 ? t('Không có việc nào đang chờ') : tasks.summary
  const openTasks = total > 0 ? () => router.push('/pending-tasks') : undefined

  return (
    <Card
      style={styles.card}
      onPress={openTasks}
      accessibilityHint={openTasks ? t('Mở danh sách đánh giá') : undefined}
      accessibilityLabel={t('Đánh giá ngày: {total} việc, {summary}', {
        total,
        summary,
      })}
    >
      {/* Lime chỉ làm chữ trên nền Ink */}
      <View style={[styles.countBox, { backgroundColor: palette.inverse }]}>
        <Text variant="heading" weight="bold" color={palette.primary}>
          {total}
        </Text>
      </View>
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold">
          {t('Đánh giá ngày')}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      {openTasks && <CaretRightIcon size={16} color={palette.textSecondary} />}
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
