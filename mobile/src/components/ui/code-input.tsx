import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  hasError?: boolean
  disabled?: boolean
  autoFocus?: boolean
  // Đổi giá trị này để rung các ô một lần (mã bị backend từ chối)
  shakeKey?: number
}

const SHAKE_OFFSET = 8
const SHAKE_STEP_MS = 50

// Ô nhập mã số chia từng ô vuông; một TextInput ẩn phía sau nhận bàn phím, dán mã và tự điền mã từ tin nhắn
export function CodeInput({
  value,
  onChange,
  length = 6,
  hasError = false,
  disabled = false,
  autoFocus = false,
  shakeKey = 0,
}: CodeInputProps) {
  const palette = usePalette()
  const [isFocused, setFocused] = useState(false)
  const offsetX = useSharedValue(0)
  const isReducedMotion = useReducedMotion()
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offsetX.get() }] }))

  useEffect(() => {
    if (shakeKey === 0 || isReducedMotion) return
    offsetX.set(
      withSequence(
        withTiming(-SHAKE_OFFSET, { duration: SHAKE_STEP_MS }),
        withTiming(SHAKE_OFFSET, { duration: SHAKE_STEP_MS }),
        withTiming(-SHAKE_OFFSET, { duration: SHAKE_STEP_MS }),
        withTiming(0, { duration: SHAKE_STEP_MS }),
      ),
    )
  }, [shakeKey, isReducedMotion, offsetX])

  const digits = Array.from({ length }, (_, index) => value[index] ?? '')

  return (
    <View>
      <Animated.View style={[styles.row, shakeStyle]}>
        {digits.map((digit, index) => {
          const isActive = isFocused && index === Math.min(value.length, length - 1)
          const borderColor = hasError ? palette.alert : isActive ? palette.primary : 'transparent'
          return (
            <View key={index} style={[styles.cell, { backgroundColor: palette.surface, borderColor }]}>
              <Text variant="heading" center>
                {digit}
              </Text>
            </View>
          )
        })}
      </Animated.View>
      <TextInput
        value={value}
        // Không đặt maxLength: dán "123 456" sẽ bị cắt trước khi bỏ dấu cách — lọc chữ số rồi mới cắt đủ độ dài
        onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        editable={!disabled}
        caretHidden
        accessibilityLabel={`Mã xác thực ${length} số`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hiddenInput}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  cell: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
  },
  // Phủ lên các ô, trong suốt: chạm vào đâu cũng mở bàn phím
  hiddenInput: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 },
})
