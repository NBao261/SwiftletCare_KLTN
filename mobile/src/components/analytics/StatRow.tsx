import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface StatRowProps {
  label: string
  // Không có dữ liệu thì "_"
  value: string
  // Số cần chú ý (ngoài ngưỡng, cảnh báo) tô cam
  isWarning?: boolean
}

// Một dòng tên – số trong card của màn Phân tích
export function StatRow({ label, value, isWarning = false }: StatRowProps) {
  const palette = usePalette()
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="small" color={palette.textSecondary} style={styles.label}>
        {label}
      </Text>
      <Text variant="small" weight="semiBold" color={isWarning ? palette.alert : palette.text} style={styles.value}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  label: { flex: 1 },
  value: { fontVariant: ['tabular-nums'] },
})
