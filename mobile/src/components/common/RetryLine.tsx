import { StyleSheet, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

interface RetryLineProps {
  // Câu ngắn báo lỗi, ví dụ "Không tải được"
  message: string
  onRetry: () => void
  isRetrying?: boolean
}

// Một dòng lỗi trong card kèm nút "Thử lại" dạng link (cùng kiểu Button link của EmptyState), vùng chạm đủ lớn và có vai
// trò nút cho trình đọc màn hình — thay cho chữ "Chạm để thử lại" bấm được
export function RetryLine({ message, onRetry, isRetrying = false }: RetryLineProps) {
  const palette = usePalette()
  return (
    <View style={styles.row}>
      <Text variant="small" color={palette.textSecondary} style={styles.message}>
        {message}
      </Text>
      <Button variant="link" size="sm" label={t('Thử lại')} onPress={onRetry} loading={isRetrying} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  message: { flex: 1 },
})
