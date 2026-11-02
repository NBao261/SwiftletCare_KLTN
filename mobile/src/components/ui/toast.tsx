import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { CheckIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const ICON_CIRCLE_SIZE = 28

interface ToastProps {
  message: string
  // Khoảng cách từ đáy màn — màn tab truyền phần thanh tab đè lên để toast nằm trên thanh tab
  bottomOffset: number
}

// Thông báo nổi ngắn ở đáy màn: nền Paper viền mảnh, chữ Ink, dấu tích Ink trong vòng nền lime (lime chỉ làm nền).
// Màn gọi tự ẩn sau vài giây bằng cách bỏ render; hiện/ẩn có trượt nhẹ (tự bỏ khi máy bật "Giảm chuyển động")
export function Toast({ message, bottomOffset }: ToastProps) {
  const palette = usePalette()

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      style={[styles.toast, { bottom: bottomOffset, backgroundColor: palette.background, borderColor: palette.border }]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.iconCircle, { backgroundColor: palette.primary }]}>
        <CheckIcon size={16} color={palette.onPrimary} weight="bold" />
      </View>
      <Text variant="body" weight="semiBold" numberOfLines={2} style={styles.message}>
        {message}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { flex: 1 },
})
