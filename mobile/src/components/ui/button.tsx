import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface ButtonProps {
  label: string
  onPress: () => void
  // primary: nút chính nền xanh; link: chữ gạch chân, không nền
  variant?: 'primary' | 'link'
  loading?: boolean
  disabled?: boolean
  // Chỉ cho variant link
  color?: string
  style?: StyleProp<ViewStyle>
}

// Nút bấm theo MOBILE_GUIDE 3.5 — bo tròn hết cỡ, đang gửi request thì khoá nút
export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, color, style }: ButtonProps) {
  const palette = usePalette()
  const isDisabled = disabled || loading
  const isPrimary = variant === 'primary'

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={isPrimary ? undefined : Spacing.sm}
      style={[
        isPrimary ? [styles.primary, { backgroundColor: palette.primary }] : styles.link,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? palette.onPrimary : palette.textSecondary} />
      ) : (
        <Text
          variant="button"
          color={isPrimary ? palette.onPrimary : (color ?? palette.textSecondary)}
          style={!isPrimary && styles.underline}
        >
          {label}
        </Text>
      )}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  primary: {
    height: 52,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { minHeight: 32, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  disabled: { opacity: 0.5 },
})
