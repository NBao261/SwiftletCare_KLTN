import type { ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import Animated, { SlideInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const HANDLE_WIDTH = 40
const HANDLE_HEIGHT = 4

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: ReactNode
}

// Bảng trượt từ đáy màn lên: nền mờ hiện dần, bảng trắng bo 2 góc trên; chạm nền mờ hoặc nút Back thì đóng
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Nền mờ dùng token secondary (Ink mờ 55%) — không thêm màu mới */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.secondary }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('Đóng')}
        />
        {/* Hiệu ứng trượt tự bỏ khi máy bật "Giảm chuyển động" (mặc định của reanimated) */}
        <Animated.View
          entering={SlideInDown.duration(250)}
          style={[styles.sheet, { backgroundColor: palette.surface, paddingBottom: Spacing.lg + insets.bottom }]}
        >
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: Radius.full,
  },
})
