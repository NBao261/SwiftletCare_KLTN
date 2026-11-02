import { useEffect, type ComponentRef, type RefObject } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BorderWidth } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Độ nhoè của lớp kính (1–100)
const BLUR_INTENSITY = 10
const ANIMATION_DURATION = 200

interface StatusBarGlassProps {
  // Android chỉ làm nhoè được nội dung nằm trong BlurTargetView mà ref này trỏ tới
  blurTarget: RefObject<ComponentRef<typeof View> | null>
  // Đã cuộn khỏi đầu trang: hiện đường kẻ xám dưới đáy kính
  isScrolled: boolean
}

// Kính mờ phủ đúng vùng giờ/pin: nội dung cuộn lên vẫn thấy nhoè phía dưới, chữ thanh trạng thái vẫn đọc được
export function StatusBarGlass({ blurTarget, isScrolled }: StatusBarGlassProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  // 0 = đang ở đầu trang, 1 = đã cuộn
  const scrolledProgress = useSharedValue(0)

  useEffect(() => {
    scrolledProgress.set(withTiming(isScrolled ? 1 : 0, { duration: ANIMATION_DURATION }))
  }, [isScrolled, scrolledProgress])

  const lineStyle = useAnimatedStyle(() => ({ opacity: scrolledProgress.get() }))

  return (
    <View style={[styles.container, { height: insets.top }]} pointerEvents="none">
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        tint="light"
        intensity={BLUR_INTENSITY}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.line, { backgroundColor: palette.border }, lineStyle]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0, height: BorderWidth.hairline },
})
