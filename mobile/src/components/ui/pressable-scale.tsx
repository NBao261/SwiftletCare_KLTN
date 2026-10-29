import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  // Tỉ lệ co lại khi nhấn
  scaleTo?: number
}

// Nút co lại khi nhấn rồi bật về bằng spring; bỏ hiệu ứng khi máy bật "Giảm chuyển động"
export function PressableScale({ scaleTo = 0.96, style, onPressIn, onPressOut, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1)
  const isReducedMotion = useReducedMotion()
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  return (
    <AnimatedPressable
      {...props}
      style={[animatedStyle, style]}
      onPressIn={event => {
        if (!isReducedMotion) scale.set(withSpring(scaleTo))
        onPressIn?.(event)
      }}
      onPressOut={event => {
        if (!isReducedMotion) scale.set(withSpring(1))
        onPressOut?.(event)
      }}
    />
  )
}
