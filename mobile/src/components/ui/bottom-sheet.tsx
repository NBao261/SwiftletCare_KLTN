import { useEffect, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import Animated, {
  ReduceMotion,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const HANDLE_WIDTH = 40
const HANDLE_HEIGHT = 4
// Vùng kéo ở đầu bảng: cao đủ ngón tay (44) dù thanh nắm chỉ cao 4
const GRAB_AREA_HEIGHT = 28
// Kéo xuống quá 120 px hoặc vuốt nhanh hơn 800 px/s thì đóng — thông số giao diện
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 800
// Màn không đóng bảng (đang gửi dở) thì sau 300 ms kéo bảng về chỗ cũ
const CLOSE_FALLBACK_MS = 300
const SLIDE_OUT = { duration: 200, reduceMotion: ReduceMotion.System }
const SPRING_BACK = { damping: 20, stiffness: 220, reduceMotion: ReduceMotion.System }
// Ô đang nhập cách mép trên bàn phím một khoảng để thấy cả câu lỗi dưới ô
const KEYBOARD_GAP = Spacing.xl

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: ReactNode
}

// Bảng trượt từ đáy màn lên: nền mờ hiện dần, bảng trắng bo 2 góc trên. Đóng bằng chạm nền mờ, nút Back hoặc kéo thanh nắm
// xuống. Nội dung cuộn trong bảng (bảng cao tối đa tới dưới thanh trạng thái); bàn phím mở thì ô đang nhập tự cuộn lên trên bàn
// phím (react-native-keyboard-controller theo dõi được bàn phím cả trong Modal), nút bấm được ngay lần chạm đầu
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const translateY = useSharedValue(0)
  const maxHeight = windowHeight - insets.top - Spacing.xl

  // Mỗi lần mở bảng bắt đầu ở đúng chỗ, không giữ độ kéo của lần trước
  useEffect(() => {
    if (visible) translateY.set(0)
  }, [visible, translateY])

  const requestClose = () => {
    onClose()
    setTimeout(() => translateY.set(withSpring(0, SPRING_BACK)), CLOSE_FALLBACK_MS)
  }

  const pan = usePanGesture({
    onUpdate: event => {
      'worklet'
      translateY.set(Math.max(0, event.translationY))
    },
    onDeactivate: event => {
      'worklet'
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        translateY.set(withTiming(windowHeight, SLIDE_OUT, () => scheduleOnRN(requestClose)))
        return
      }
      translateY.set(withSpring(0, SPRING_BACK))
    },
  })

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }))

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Modal là cây giao diện riêng: cử chỉ kéo chỉ chạy khi có GestureHandlerRootView trong đó */}
      <GestureHandlerRootView style={styles.container}>
        {/* Nền mờ dùng token secondary (Ink mờ 55%) — không thêm màu mới */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.secondary }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('Đóng')}
        />
        {/* Hiệu ứng trượt vào tự bỏ khi máy bật "Giảm chuyển động" (mặc định của reanimated) */}
        <Animated.View entering={SlideInDown.duration(250)} style={{ maxHeight }}>
          <Animated.View style={[styles.sheet, { backgroundColor: palette.surface, maxHeight }, dragStyle]}>
            <GestureDetector gesture={pan}>
              <View
                style={styles.grabArea}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t('Kéo xuống để đóng')}
              >
                <View style={[styles.handle, { backgroundColor: palette.border }]} />
              </View>
            </GestureDetector>
            <KeyboardAwareScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + insets.bottom }]}
              bottomOffset={KEYBOARD_GAP}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </KeyboardAwareScrollView>
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  grabArea: { height: GRAB_AREA_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: Radius.full,
  },
  // Bảng cao vừa nội dung, chỉ cuộn khi nội dung dài hơn chiều cao tối đa
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
})
