import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Cao bằng nút lớn (MOBILE_GUIDE 3.5)
const BAR_MIN_HEIGHT = 56

interface SettingsActionBarProps {
  // Chữ trắng bên trái ("Lưu thay đổi", "Thiết bị online")
  label: string
  // Chữ lime đậm bên phải ("2/3", "TẠO"); không truyền thì label là một chữ lime đậm căn giữa (nút "Cập nhật")
  value?: string
  // Có thì cả thanh là nút bấm; không có thì chỉ để xem
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  accessibilityLabel?: string
}

// Thanh đen như "Total due" trong ảnh mẫu: nền Ink, chữ lime trên nền Ink (đúng luật màu).
// Chế độ sửa là nút Lưu; chế độ xem hiện con số chính của mục
export function SettingsActionBar({
  label,
  value,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: SettingsActionBarProps) {
  const palette = usePalette()
  const isCentered = value === undefined
  const content = isCentered ? (
    loading ? (
      <ActivityIndicator color={palette.primary} />
    ) : (
      <Text variant="heading" weight="bold" color={palette.primary} numberOfLines={1}>
        {label}
      </Text>
    )
  ) : (
    <>
      <Text variant="body" color={palette.onInverse} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : (
        <Text variant="heading" weight="bold" color={palette.primary} style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
    </>
  )

  if (!onPress) {
    return (
      <View
        style={[styles.bar, isCentered && styles.centered, { backgroundColor: palette.inverse }]}
        accessible
        accessibilityLabel={accessibilityLabel ?? (isCentered ? label : `${label}: ${value}`)}
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
        isCentered && styles.centered,
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
    gap: Spacing.md,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  centered: { justifyContent: 'center' },
  label: { flex: 1 },
  value: { fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.5 },
})
