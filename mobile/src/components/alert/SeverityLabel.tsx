import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertSeverity } from '@/types'
import { getSeverityLabel } from '@/utils/label.utils'
import { getSeverityLevel, getSeverityLevelColors, type SeverityLevel } from '@/utils/severity.utils'

export const SEVERITY_DOT_SIZE = 8

// Màu theo cấp, đúng web (frontend/src/constants/severity.ts): Khẩn cấp cam đặc chữ trắng, Cao cam nhạt chữ cam đậm,
// Thường xám ấm. Chấm lấy màu chữ của cấp; luôn kèm chữ, không chỉ màu
export function getSeverityStyle(level: SeverityLevel, palette: ReturnType<typeof usePalette>) {
  const colors = getSeverityLevelColors(level, palette)
  return { background: colors.background, text: colors.text, dot: colors.text }
}

interface SeverityLabelProps {
  severity: AlertSeverity
}

// Nhãn mức nghiêm trọng: chấm màu + chữ viết hoa trong viên bo tròn
export function SeverityLabel({ severity }: SeverityLabelProps) {
  const palette = usePalette()
  const style = getSeverityStyle(getSeverityLevel(severity), palette)

  return (
    <View style={[styles.pill, { backgroundColor: style.background }]}>
      <View style={[styles.dot, { backgroundColor: style.dot }]} />
      <Text variant="small" weight="semiBold" color={style.text} style={styles.label}>
        {getSeverityLabel(severity)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dot: { width: SEVERITY_DOT_SIZE, height: SEVERITY_DOT_SIZE, borderRadius: Radius.full },
  label: { textTransform: 'uppercase' },
})
