import { useEffect } from 'react'
import type { DimensionValue } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Radius } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const APPEAR_DURATION_MS = 200
const PULSE_DURATION_MS = 800
const PULSE_MIN_OPACITY = 0.5

interface SkeletonProps {
  width: DimensionValue
  height: DimensionValue
  // Bo góc theo hình của khối thật, mặc định bằng card
  radius?: number
  // Màu của khung thật mà khung xương thay chỗ (card trắng, khối Ink, thẻ lime…); mặc định card trắng
  color?: string
  // Trễ trước khi hiện — các khối xếp chồng truyền trễ tăng dần để khung xương hiện lần lượt từ trên xuống
  delayMs?: number
}

// Khung xương lúc đang tải: đúng hình và màu khung thật, hiện dần rồi nhấp nháy nhẹ; máy bật "Giảm chuyển động" thì đứng yên
export function Skeleton({ width, height, radius = Radius.lg, color, delayMs = 0 }: SkeletonProps) {
  const palette = usePalette()
  const isReducedMotion = useReducedMotion()
  const opacity = useSharedValue(isReducedMotion ? 1 : 0)

  useEffect(() => {
    if (isReducedMotion) {
      opacity.set(1)
      return
    }
    opacity.set(
      withDelay(
        delayMs,
        withSequence(
          withTiming(1, { duration: APPEAR_DURATION_MS }),
          withRepeat(withTiming(PULSE_MIN_OPACITY, { duration: PULSE_DURATION_MS }), -1, true),
        ),
      ),
    )
  }, [isReducedMotion, delayMs, opacity])

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: color ?? palette.surface }, pulseStyle]}
      accessibilityLabel={t('Đang tải')}
    />
  )
}
