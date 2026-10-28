import { useEffect } from 'react'
import { Dimensions, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import * as SplashScreen from 'expo-splash-screen'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { Colors, Radius, Spacing } from '@/constants/theme'

// Tỉ lệ ảnh gốc logo chữ (mobile-scare-text.png)
const TEXT_SOURCE = { width: 1492, height: 342 }

// Icon khối vuông nhỏ gọn bo góc mềm, logo chữ cân theo icon
const ICON_SIZE = 120
const TEXT_WIDTH = 200
const TEXT_HEIGHT = TEXT_SOURCE.height * (TEXT_WIDTH / TEXT_SOURCE.width)

// View gốc của app dừng trên thanh điều hướng Android — phủ đúng kích thước màn hình để căn giữa cả màn hình
const SCREEN = Dimensions.get('screen')

// Logo hiện tối thiểu một lúc trước khi mờ, tránh loé lên rồi mất khi nạp quá nhanh
const MIN_VISIBLE_DURATION = 800
const FADE_DURATION = 600

const ICON_IMAGE = require('@/assets/images/mobile-scare-icon.png')
const TEXT_IMAGE = require('@/assets/images/mobile-scare-text.png')

interface AnimatedSplashProps {
  // Font và phiên đăng nhập đã nạp xong
  isReady: boolean
  // Splash đã mờ hết, gỡ splash để lộ màn auth
  onFinish: () => void
}

// Splash: cụm icon + logo chữ căn giữa màn hình trắng, nạp xong thì mờ dần
export function AnimatedSplash({ isReady, onFinish }: AnimatedSplashProps) {
  const opacity = useSharedValue(1)

  // Nạp xong thì mờ dần cả splash
  useEffect(() => {
    if (!isReady) return
    opacity.value = withDelay(
      MIN_VISIBLE_DURATION,
      withTiming(
        0,
        { duration: FADE_DURATION, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System },
        finished => {
          if (finished) scheduleOnRN(onFinish)
        },
      ),
    )
  }, [isReady, opacity, onFinish])

  // Splash JS đã vẽ xong thì mới ẩn splash gốc, tránh nháy màn trắng
  const handleLayout = () => {
    SplashScreen.hideAsync()
  }

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      onLayout={handleLayout}
      accessible
      accessibilityLabel="Đang tải SwiftletCare"
    >
      <Image source={ICON_IMAGE} style={styles.icon} contentFit="cover" />
      <Image source={TEXT_IMAGE} style={styles.text} contentFit="contain" />
    </Animated.View>
  )
}

// Splash luôn nền trắng ở cả sáng/tối — chữ "Care" màu đen không đọc được trên nền tối
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN.width,
    height: SCREEN.height,
    backgroundColor: Colors.raw.pureWhite,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  icon: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: Radius.lg },
  text: { width: TEXT_WIDTH, height: TEXT_HEIGHT },
})
