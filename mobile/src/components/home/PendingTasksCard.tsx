import { StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePendingVerdictAlerts } from '@/hooks/alert/usePendingVerdictAlerts'
import { usePendingHealthDays } from '@/hooks/health/usePendingHealthDays'
import { usePalette } from '@/hooks/theme/usePalette'
import { summarizePendingTasks } from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'

const COUNT_BOX_SIZE = 48
const DUE_DOT_SIZE = 8

// Khối "Việc chờ bạn": ngày chờ chủ chấm + cảnh báo chờ chủ phán quyết; hết việc vẫn giữ khối, số là 0
export function PendingTasksCard() {
  const palette = usePalette()
  const { data: pendingDays = [] } = usePendingHealthDays()
  const { alerts: pendingVerdictAlerts } = usePendingVerdictAlerts()
  const tasks = summarizePendingTasks(pendingDays, pendingVerdictAlerts.length)
  const { total, isDueSoon } = tasks
  const summary = total === 0 ? t('Không có việc nào đang chờ') : tasks.summary

  return (
    // shortcut: chưa có màn danh sách việc, màn chấm ngày (Tốt / Cần theo dõi / Cần hành động) — có thì truyền onPress cho Card
    <Card style={styles.card} accessibilityLabel={t('Việc chờ bạn: {total} việc, {summary}', { total, summary })}>
      {/* Lime chỉ làm chữ trên nền Ink */}
      <View style={[styles.countBox, { backgroundColor: palette.inverse }]}>
        <Text variant="heading" weight="bold" color={palette.primary}>
          {total}
        </Text>
      </View>
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <Text variant="body" weight="semiBold">
            {t('Việc chờ bạn')}
          </Text>
          {/* Chấm cam: có ngày chờ chấm còn không quá 1 ngày là hết hạn */}
          {isDueSoon && <View style={[styles.dueDot, { backgroundColor: palette.alert }]} />}
        </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dueDot: { width: DUE_DOT_SIZE, height: DUE_DOT_SIZE, borderRadius: Radius.full },
})
