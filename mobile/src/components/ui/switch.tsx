import { useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Radius } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const TRACK_WIDTH = 52
const TRACK_HEIGHT = 32
const KNOB_INSET = 3
const KNOB_SIZE = TRACK_HEIGHT - KNOB_INSET * 2
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2
// Track cao 32, nới vùng chạm thêm 6 mỗi phía cho đủ 44 (MOBILE_GUIDE 3.7)
const HIT_SLOP = (44 - TRACK_HEIGHT) / 2
const SLIDE = { duration: 160, reduceMotion: ReduceMotion.System }

interface SwitchProps {
  value: boolean
  onValueChange: (nextValue: boolean) => void
  // Tên nút cho trình đọc màn hình, ví dụ "Phun sương"
  accessibilityLabel: string
  disabled?: boolean
  // Đang gửi lệnh / chờ thiết bị: núm hiện vòng xoay và khoá chạm
  isPending?: boolean
}

// Nút gạt bật/tắt tự vẽ để dùng token của app (Switch gốc của React Native mang màu mặc định của hệ điều hành).
// Bật: nền lime, núm Ink (lime = thiết bị đang bật); tắt: nền Paper, núm trắng
export function Switch({ value, onValueChange, accessibilityLabel, disabled = false, isPending = false }: SwitchProps) {
  const palette = usePalette()
  const offset = useSharedValue(value ? KNOB_TRAVEL : 0)
  const isLocked = disabled || isPending

  useEffect(() => {
    offset.set(withTiming(value ? KNOB_TRAVEL : 0, SLIDE))
  }, [offset, value])

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }))

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={isLocked}
      hitSlop={HIT_SLOP}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: isLocked, busy: isPending }}
      style={[
        styles.track,
        { backgroundColor: value ? palette.primary : palette.surfaceStrong, borderColor: palette.border },
        disabled && styles.disabled,
      ]}
    >
      <Animated.View style={[styles.knob, { backgroundColor: value ? palette.inverse : palette.surface }, knobStyle]}>
        {isPending && <ActivityIndicator size="small" color={value ? palette.primary : palette.text} />}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    padding: KNOB_INSET - StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
})
