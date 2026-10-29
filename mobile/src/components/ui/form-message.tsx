import { StyleSheet, View } from 'react-native'
import { CheckCircleIcon, WarningCircleIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface FormMessageProps {
  message: string | null | undefined
  // error: cam alert (lỗi); success: xanh primary (đã xong)
  tone?: 'error' | 'success'
}

// Một dòng thông báo của cả form; không có nội dung thì không chiếm chỗ
export function FormMessage({ message, tone = 'error' }: FormMessageProps) {
  const palette = usePalette()
  if (!message) return null

  const color = tone === 'error' ? palette.alert : palette.primary
  const StatusIcon = tone === 'error' ? WarningCircleIcon : CheckCircleIcon

  return (
    <View
      style={styles.row}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
    >
      <StatusIcon size={16} color={color} weight="fill" />
      <Text variant="small" color={color} style={styles.text}>
        {message}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  text: { flex: 1 },
})
