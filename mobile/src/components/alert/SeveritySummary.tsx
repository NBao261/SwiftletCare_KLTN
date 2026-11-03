import { Pressable, StyleSheet, View } from 'react-native'
import { getSeverityStyle, SEVERITY_DOT_SIZE } from '@/components/alert/SeverityLabel'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'
import { getSeverityLevelLabel, SEVERITY_LEVELS, type SeverityLevel } from '@/utils/severity.utils'

const TILE_HEIGHT = 64

interface SeveritySummaryProps {
  counts: Record<SeverityLevel, number>
  selected: SeverityLevel | null
  onToggle: (level: SeverityLevel) => void
  isLoading: boolean
}

// Dải tóm tắt theo 3 cấp như web (Khẩn cấp · Cao · Thường), cũng là bộ lọc nhanh (đặc tả §2.2): chạm một ô để chỉ xem
// cấp đó, chạm lại để bỏ lọc. Màu mỗi ô là màu badge của cấp, giữ nguyên cả khi số 0; ô đang chọn có viền Ink
export function SeveritySummary({ counts, selected, onToggle, isLoading }: SeveritySummaryProps) {
  const palette = usePalette()
  if (isLoading) return <Skeleton width="100%" height={TILE_HEIGHT} radius={Radius.md} />

  return (
    <View style={styles.row}>
      {SEVERITY_LEVELS.map(level => {
        const style = getSeverityStyle(level, palette)
        const isSelected = selected === level
        const count = counts[level]
        const label = getSeverityLevelLabel(level)
        return (
          <Pressable
            key={level}
            onPress={() => onToggle(level)}
            style={[styles.tile, { backgroundColor: style.background, borderColor: isSelected ? palette.text : 'transparent' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={t('{severity}: {count} cảnh báo', { severity: label, count })}
          >
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: style.dot }]} />
              <Text variant="small" weight="semiBold" color={style.text} numberOfLines={1} style={styles.flex}>
                {label}
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: SEVERITY_DOT_SIZE, height: SEVERITY_DOT_SIZE, borderRadius: Radius.full },
  flex: { flex: 1 },
})
