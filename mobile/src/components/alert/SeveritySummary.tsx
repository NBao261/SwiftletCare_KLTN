import { Pressable, StyleSheet, View } from 'react-native'
import { getSeverityStyle, SEVERITY_DOT_SIZE } from '@/components/alert/SeverityLabel'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertSeverity } from '@/types'
import { SEVERITIES } from '@/utils/alertList.utils'
import { getSeverityLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

const TILE_HEIGHT = 64

interface SeveritySummaryProps {
  counts: Record<AlertSeverity, number>
  selected: AlertSeverity | null
  onToggle: (severity: AlertSeverity) => void
  isLoading: boolean
}

// Dải tóm tắt theo mức, cũng là bộ lọc nhanh (đặc tả §2.2): chạm một ô để chỉ xem mức đó, chạm lại để bỏ lọc;
// ô số 0 mờ nhưng vẫn chạm được; ô đang chọn có viền Ink
export function SeveritySummary({ counts, selected, onToggle, isLoading }: SeveritySummaryProps) {
  const palette = usePalette()
  if (isLoading) return <Skeleton width="100%" height={TILE_HEIGHT} radius={Radius.md} />

  return (
    <View style={styles.row}>
      {SEVERITIES.map(severity => {
        const style = getSeverityStyle(severity, palette)
        const isSelected = selected === severity
        const count = counts[severity]
        // Ô Trung bình, Thấp nền trắng để nổi trên nền Paper
        const background = severity === 'MEDIUM' || severity === 'LOW' ? palette.surface : style.background
        return (
          <Pressable
            key={severity}
            onPress={() => onToggle(severity)}
            style={[
              styles.tile,
              { backgroundColor: background, borderColor: isSelected ? palette.text : 'transparent' },
              count === 0 && !isSelected && styles.empty,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={t('{severity}: {count} cảnh báo', { severity: getSeverityLabel(severity), count })}
          >
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: style.dot }]} />
              <Text variant="small" weight="semiBold" color={style.text} numberOfLines={1} style={styles.flex}>
                {getSeverityLabel(severity)}
              </Text>
            </View>
            <Text variant="heading" weight="semiBold" color={style.text}>
              {count}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    flex: 1,
    height: TILE_HEIGHT,
    borderRadius: Radius.md,
    borderWidth: BorderWidth.strong,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    justifyContent: 'space-between',
  },
  empty: { opacity: 0.5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: SEVERITY_DOT_SIZE, height: SEVERITY_DOT_SIZE, borderRadius: Radius.full },
  flex: { flex: 1 },
})
