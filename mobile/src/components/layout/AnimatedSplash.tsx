import { useEffect } from 'react'
import { Dimensions, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
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
import { TextLogo } from '@/components/layout/TextLogo'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Icon khối vuông nhỏ gọn bo góc mềm, logo chữ cân theo icon
const ICON_SIZE = 88
const TEXT_LOGO_WIDTH = 200

// View gốc của app dừng trên thanh điều hướng Android — phủ đúng kích thước màn hình để căn giữa cả màn hình
const SCREEN = Dimensions.get('screen')

// Logo hiện tối thiểu một lúc trước khi mờ, tránh loé lên rồi mất khi nạp quá nhanh
const MIN_VISIBLE_DURATION = 600
const FADE_DURATION = 500

const ICON_IMAGE = require('@/assets/images/mobile-scare-icon.png')

// Nền loang từ trên xuống: lime (primary) ở mép trên nhạt dần, tới khoảng giữa màn thì thành trắng (surface), theo ảnh mẫu
const GRADIENT_LOCATIONS = [0, 0.55] as const

interface AnimatedSplashProps {
  // Font và phiên đăng nhập đã nạp xong
  isReady: boolean
  // Splash đã mờ hết, gỡ splash để lộ màn auth
  onFinish: () => void
}

// Splash: cụm icon + logo chữ căn giữa nền loang lime → trắng, nạp xong thì mờ dần
export function AnimatedSplash({ isReady, onFinish }: AnimatedSplashProps) {
  const palette = usePalette()
  const opacity = useSharedValue(1)

  // Nạp xong thì mờ dần cả splash
  useEffect(() => {
    if (!isReady) return
    opacity.set(
      withDelay(
        MIN_VISIBLE_DURATION,
        withTiming(
          0,
          { duration: FADE_DURATION, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System },
          finished => {
            if (finished) scheduleOnRN(onFinish)
          },
        ),
      ),
    )
  }, [isReady, opacity, onFinish])

  // Splash JS đã vẽ xong thì mới ẩn splash gốc, tránh nháy màn trắng
  const handleLayout = () => {
    SplashScreen.hideAsync()
  }

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: palette.surface }, containerStyle]}
      onLayout={handleLayout}
      accessible
      accessibilityLabel={t('Đang tải SwiftletCare')}
    >
      <LinearGradient colors={[palette.primary, palette.surface]} locations={GRADIENT_LOCATIONS} style={StyleSheet.absoluteFill} />
      <Image source={ICON_IMAGE} style={styles.icon} contentFit="cover" />
      <TextLogo width={TEXT_LOGO_WIDTH} />
    </Animated.View>
  )
}

// Phủ đúng kích thước màn hình; nền trắng (surface) dưới lớp loang để phần dưới màn vẫn trắng như splash gốc
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN.width,
    height: SCREEN.height,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  icon: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: Radius.lg },
})
