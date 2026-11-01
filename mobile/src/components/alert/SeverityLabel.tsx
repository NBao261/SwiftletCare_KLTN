import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertSeverity } from '@/types'
import { getSeverityLabel } from '@/utils/label.utils'

export const SEVERITY_DOT_SIZE = 8

// Màu theo mức (đặc tả §2.2) bằng token sẵn có: Nghiêm trọng nền cam đặc, Cao nền cam nhạt,
// Trung bình chấm cam, Thấp chấm xám. Luôn có chữ, không chỉ màu
export function getSeverityStyle(severity: AlertSeverity, palette: ReturnType<typeof usePalette>) {
  if (severity === 'CRITICAL')
    return { background: palette.severityP1, text: palette.severityP1Text, dot: palette.severityP1Text }
  if (severity === 'HIGH') return { background: palette.severityP2, text: palette.severityP2Text, dot: palette.alert }
  if (severity === 'MEDIUM') return { background: palette.surfaceStrong, text: palette.text, dot: palette.alert }
  return { background: palette.surfaceStrong, text: palette.text, dot: palette.textSecondary }
}

interface SeverityLabelProps {
  severity: AlertSeverity
}

// Nhãn mức nghiêm trọng: chấm màu + chữ viết hoa trong viên bo tròn
export function SeverityLabel({ severity }: SeverityLabelProps) {
  const palette = usePalette()
  const style = getSeverityStyle(severity, palette)

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
