import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { Icon } from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Chiều cao theo MOBILE_GUIDE 3.5: sm 36 · md 44 · lg 52
const BUTTON_HEIGHTS = { sm: 36, md: 44, lg: 52 } as const
const BUTTON_PADDINGS = { sm: Spacing.lg, md: Spacing.lg, lg: Spacing.xl } as const

interface ButtonProps {
  label: string
  onPress: () => void
  // primary: nền lime; secondary: nền trắng không viền; inverse: nền Ink chữ trắng (trên khối màu); link: chữ gạch chân
  variant?: 'primary' | 'secondary' | 'inverse' | 'link'
  size?: keyof typeof BUTTON_HEIGHTS
  // Icon đứng sau chữ, ví dụ mũi tên "Xử lý ngay →"
  trailingIcon?: Icon
  loading?: boolean
  disabled?: boolean
  // Chỉ cho variant link
  color?: string
  // Câu đọc cho trình đọc màn hình khi cần rõ hơn chữ trên nút
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

// Nút bấm theo MOBILE_GUIDE 3.5 — bo tròn hết cỡ, đang gửi request thì khoá nút
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  trailingIcon: TrailingIcon,
  loading = false,
  disabled = false,
  color,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const palette = usePalette()
  const isDisabled = disabled || loading
  const isLink = variant === 'link'
  const filledStyle = [styles.filled, { height: BUTTON_HEIGHTS[size], paddingHorizontal: BUTTON_PADDINGS[size] }]

  const variantStyle = {
    primary: [filledStyle, { backgroundColor: palette.primary }],
    secondary: [filledStyle, { backgroundColor: palette.surface }],
    inverse: [filledStyle, { backgroundColor: palette.inverse }],
    link: styles.link,
  }[variant]

  const textColor = {
    primary: palette.onPrimary,
    secondary: palette.text,
    inverse: palette.onInverse,
    link: color ?? palette.textSecondary,
  }[variant]

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={isLink ? Spacing.sm : undefined}
      style={[variantStyle, isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={isLink ? palette.textSecondary : textColor} />
      ) : (
        <>
          <Text variant="button" color={textColor} style={isLink && styles.underline}>
            {label}
          </Text>
          {TrailingIcon && <TrailingIcon size={16} color={textColor} weight="bold" />}
        </>
      )}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  filled: {
    flexDirection: 'row',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { minHeight: 32, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  disabled: { opacity: 0.5 },
})
