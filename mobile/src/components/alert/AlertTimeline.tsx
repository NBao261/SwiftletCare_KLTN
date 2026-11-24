import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertTimelineEntry } from '@/utils/alertDetail.utils'
import { formatDateTime } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

const DOT_SIZE = 8

interface AlertTimelineProps {
  entries: AlertTimelineEntry[]
  // Dòng thêm dưới cùng, ví dụ "Phán quyết: Chờ phán quyết" của cảnh báo suy luận chưa có kết luận
  footer?: ReactNode
}

// Lịch sử xử lý của cảnh báo theo thời gian: mỗi mục một chấm trên đường dọc, ghi ai, làm gì, lúc nào và ghi chú nếu có
export function AlertTimeline({ entries, footer }: AlertTimelineProps) {
  const palette = usePalette()

  return (
    <Card style={styles.card}>
      <Text variant="body" weight="semiBold">
        {t('Lịch sử xử lý')}
      </Text>
      {entries.map((entry, index) => (
        <View key={entry.key} style={styles.entry}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: palette.text }]} />
            {index < entries.length - 1 && <View style={[styles.line, { backgroundColor: palette.divider }]} />}
          </View>
          <View style={styles.texts}>
            <Text variant="small" weight="semiBold">
              {`${entry.actor} · ${entry.action}`}
            </Text>
            <Text variant="small" color={palette.textSecondary}>
              {formatDateTime(entry.at)}
            </Text>
            {entry.note ? <Text variant="small">{entry.note}</Text> : null}
          </View>
        </View>
      ))}
      {footer}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  entry: { flexDirection: 'row', gap: Spacing.sm },
  rail: { alignItems: 'center', paddingTop: Spacing.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: Radius.full },
  line: { flex: 1, width: BorderWidth.regular, marginTop: Spacing.xs },
  texts: { flex: 1, minWidth: 0, paddingBottom: Spacing.xs },
})
