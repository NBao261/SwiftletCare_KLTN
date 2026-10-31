import { StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'
import { Radius, Spacing } from '@/constants/theme'
import { usePendingVerdictAlertCount } from '@/hooks/alert/usePendingVerdictAlertCount'
import { HAS_PENDING_HEALTH_DAYS_API, usePendingHealthDays } from '@/hooks/health/usePendingHealthDays'
import { usePalette } from '@/hooks/theme/usePalette'
import { summarizePendingTasks } from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'

const COUNT_BOX_SIZE = 48
// Chiều cao khung xương / khung lỗi: ô số 48 + lề card 16×2
const CARD_HEIGHT = COUNT_BOX_SIZE + Spacing.lg * 2

// Khối "Việc chờ bạn": ngày chờ chủ chấm + cảnh báo chờ chủ phán quyết; hết việc vẫn giữ khối, số là 0
export function PendingTasksCard() {
  const palette = usePalette()
  const queryClient = useQueryClient()
  const pendingDaysQuery = usePendingHealthDays()
  const pendingVerdicts = usePendingVerdictAlertCount()

  if (pendingVerdicts.isLoading || pendingDaysQuery.isLoading) {
    return <Skeleton width="100%" height={CARD_HEIGHT} delayMs={HOME_SKELETON_DELAY_MS.tasks} />
  }
  if (pendingVerdicts.isError || pendingDaysQuery.isError) {
    return (
      <EmptyState
        message={t('Không tải được việc chờ bạn')}
        actionLabel={t('Thử lại')}
        onAction={() => queryClient.refetchQueries({ type: 'active' })}
        height={CARD_HEIGHT}
      />
    )
  }

  const tasks = summarizePendingTasks(pendingDaysQuery.data ?? [], pendingVerdicts.count)
  const { total } = tasks
  // Chưa có API ngày chờ chấm: chỉ nói về cảnh báo chờ phán quyết, phần đánh giá ngày ghi "Sắp có"
  const emptyText = HAS_PENDING_HEALTH_DAYS_API ? t('Không có việc nào đang chờ') : t('Không có cảnh báo chờ phán quyết')
  const summary = total === 0 ? emptyText : tasks.summary
  const comingSoonText = HAS_PENDING_HEALTH_DAYS_API ? null : t('Đánh giá ngày: Sắp có')

  return (
    // shortcut: chưa có màn danh sách việc, màn chấm ngày (Tốt / Cần theo dõi / Cần hành động) — có thì truyền onPress cho Card
    <Card
      style={styles.card}
      accessibilityLabel={t('Việc chờ bạn: {total} việc, {summary}', {
        total,
        summary: comingSoonText ? `${summary}, ${comingSoonText}` : summary,
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
          {t('Việc chờ bạn')}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
          {summary}
        </Text>
        {comingSoonText && (
          <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
            {comingSoonText}
          </Text>
        )}
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
