import type { ReactNode } from 'react'
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'

// Mờ hẳn khi bàn phím mở được 60 %, sớm hơn lúc thu hết chiều cao — chữ không bị cắt dở khi còn hiện
const FULLY_FADED_AT_PROGRESS = 0.6

// Chưa đo chiều cao tự nhiên
const NOT_MEASURED = 0

interface CollapsesWithKeyboardProps {
  // Tiến trình mở bàn phím 0 → 1 (useReanimatedKeyboardAnimation)
  keyboardProgress: SharedValue<number>
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

// Khối phụ (logo, mô tả, chân trang) thu chiều cao và mờ dần cùng nhịp bàn phím, hiện lại khi bàn phím đóng
export function CollapsesWithKeyboard({ keyboardProgress, children, style }: CollapsesWithKeyboardProps) {
  const naturalHeight = useSharedValue(NOT_MEASURED)

  // Chỉ lấy chiều cao khi khối đang ở kích thước tự nhiên: chưa đo lần nào (chưa bị ép chiều cao),
  // hoặc bàn phím đóng hẳn. Lúc đang thu, chiều cao đo được là chiều cao đã bị ép — bỏ qua.
  const handleLayout = (event: LayoutChangeEvent) => {
    const isNaturalSize = naturalHeight.get() === NOT_MEASURED || keyboardProgress.get() === 0
    if (isNaturalSize) naturalHeight.set(event.nativeEvent.layout.height)
  }

  const animatedStyle = useAnimatedStyle(() => {
    const progress = keyboardProgress.get()
    const height = naturalHeight.get()
    return {
      opacity: interpolate(progress, [0, FULLY_FADED_AT_PROGRESS], [1, 0], 'clamp'),
      // Chưa đo được thì để chiều cao tự nhiên
      height: height === NOT_MEASURED ? undefined : interpolate(progress, [0, 1], [height, 0], 'clamp'),
    }
  })

  return (
    <Animated.View style={[styles.container, style, animatedStyle]} onLayout={handleLayout}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
})
