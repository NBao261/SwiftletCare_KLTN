import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { BUTTON_HEIGHTS } from '@/components/ui/button'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Cùng khung nút lớn của app (MOBILE_GUIDE 3.5): cao 52, bo tròn hết cỡ
const BAR_MIN_HEIGHT = BUTTON_HEIGHTS.lg

interface SettingsActionBarProps {
  // Chữ của thanh ("Cập nhật", "Đang trực tuyến")
  label: string
  // Con số / giá trị đi liền sau label trên cùng một dòng ("2/3"); không truyền thì label là chữ lime đậm (nút "Cập nhật")
  value?: string
  // Có thì cả thanh là nút bấm; không có thì chỉ để xem
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  accessibilityLabel?: string
}

// Thanh đen như "Total due" trong ảnh mẫu: nền Ink, chữ lime trên nền Ink (đúng luật màu). Luôn một dòng chữ căn giữa, không
// chia hai bên (người dùng yêu cầu 2026-11-19): nút thì một chữ lime đậm; chế độ xem thì "nhãn trắng + giá trị lime" liền nhau
export function SettingsActionBar({
  label,
  value,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: SettingsActionBarProps) {
  const palette = usePalette()
  const hasValue = value !== undefined
  const content = loading ? (
    <ActivityIndicator color={palette.primary} />
  ) : hasValue ? (
    <Text variant="body" weight="semiBold" color={palette.onInverse} numberOfLines={1} center style={styles.text}>
      {`${label} `}
      <Text variant="body" weight="bold" color={palette.primary}>
        {value}
      </Text>
    </Text>
  ) : (
    <Text variant="heading" weight="bold" color={palette.primary} numberOfLines={1} center style={styles.text}>
      {label}
    </Text>
  )

  if (!onPress) {
    return (
      <View
        style={[styles.bar, { backgroundColor: palette.inverse }]}
        accessible
        accessibilityLabel={accessibilityLabel ?? (hasValue ? `${label}: ${value}` : label)}
      >
        {content}
      </View>
    )
  }

  const isDisabled = disabled || loading
  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.bar,
        { backgroundColor: palette.inverse },
        isDisabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {content}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  bar: {
    minHeight: BAR_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  text: { flexShrink: 1 },
  disabled: { opacity: 0.5 },
})
