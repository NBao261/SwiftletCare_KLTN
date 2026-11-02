import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface LoadingOverlayProps {
  visible: boolean
  message: string
}

// Màn chờ phủ toàn màn hình (kể cả thanh tab và vùng giờ/pin): nền Paper, giữa màn vòng tải và một câu;
// che hẳn nội dung đang dựng lại bên dưới và chặn mọi thao tác trong lúc chờ
export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const palette = usePalette()

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View
        style={[styles.screen, { backgroundColor: palette.background }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={message}
      >
        <ActivityIndicator size="large" color={palette.text} />
        <Text variant="body" weight="semiBold" center>
          {message}
        </Text>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
})
