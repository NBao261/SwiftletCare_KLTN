import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface ButtonProps {
  label: string
  onPress: () => void
  // primary: nút chính nền xanh; secondary: nền trắng viền xanh; link: chữ gạch chân, không nền
  variant?: 'primary' | 'secondary' | 'link'
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
  const isLink = variant === 'link'

  const variantStyle = {
    primary: [styles.filled, { backgroundColor: palette.primary }],
    secondary: [styles.filled, styles.outlined, { backgroundColor: palette.background, borderColor: palette.primary }],
    link: styles.link,
  }[variant]

  const textColor = {
    primary: palette.onPrimary,
    secondary: palette.text,
    link: color ?? palette.textSecondary,
  }[variant]

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={isLink ? Spacing.sm : undefined}
      style={[variantStyle, isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={isLink ? palette.textSecondary : textColor} />
      ) : (
        <Text variant="button" color={textColor} style={isLink && styles.underline}>
          {label}
        </Text>
      )}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  filled: {
    height: 52,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: { borderWidth: BorderWidth.strong },
  link: { minHeight: 32, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  disabled: { opacity: 0.5 },
})
