import { useEffect, type ReactNode } from 'react'
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ScreenOrientation from 'expo-screen-orientation'
import { ArrowsInIcon } from 'phosphor-react-native'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Phần trên dành cho tiêu đề và nút thoát
const HEADER_HEIGHT = 52

interface ChartFullscreenModalProps {
  visible: boolean
  title: string
  onClose: () => void
  // Vẽ biểu đồ theo khung toàn màn (ngang)
  children: (width: number, height: number) => ReactNode
}

// Xem biểu đồ toàn màn hình, xoay ngang như trình phát camera; đóng thì khoá lại màn dọc
export function ChartFullscreenModal({ visible, title, onClose, children }: ChartFullscreenModalProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  // Lúc vừa mở có thể vẫn đo theo màn dọc: lấy cạnh dài làm chiều rộng
  const landscapeWidth = Math.max(width, height) - insets.left - insets.right - Spacing.lg * 2
  const landscapeHeight = Math.min(width, height) - HEADER_HEIGHT - insets.bottom - Spacing.lg

  useEffect(() => {
    if (!visible) return
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined)
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined)
    }
  }, [visible])

  return (
    <Modal
      visible={visible}
      animationType="fade"
      supportedOrientations={['landscape', 'portrait']}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.screen,
          {
            backgroundColor: palette.background,
            paddingLeft: insets.left + Spacing.lg,
            paddingRight: insets.right + Spacing.lg,
          },
        ]}
      >
        <View style={styles.header}>
          <Text variant="body" weight="semiBold" style={styles.flex} numberOfLines={1}>
            {title}
          </Text>
          <IconButton icon={ArrowsInIcon} label={t('Thoát toàn màn hình')} onPress={onClose} />
        </View>
        {visible && landscapeHeight > 0 ? children(landscapeWidth, landscapeHeight) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
})
