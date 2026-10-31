import { StyleSheet, View } from 'react-native'
import type { Icon } from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Vùng chạm tối thiểu 44 × 44 (MOBILE_GUIDE 3.7)
const BUTTON_SIZE = 44
const ICON_SIZE = 20
const BADGE_SIZE = 18
// Lớn hơn số này thì badge ghi "9+" cho gọn
const MAX_BADGE_COUNT = 9

interface IconButtonProps {
  icon: Icon
  // Tên nút cho trình đọc màn hình — nút chỉ có icon bắt buộc có
  label: string
  // Chưa có màn đích thì không truyền: nút vẫn hiện nhưng bị khoá
  onPress?: () => void
  // Số trên badge góc phải; 0 thì không hiện badge
  badgeCount?: number
}

// Nút chỉ có icon, không nền, kèm badge số tuỳ chọn
export function IconButton({ icon: ButtonIcon, label, onPress, badgeCount = 0 }: IconButtonProps) {
  const palette = usePalette()
  const hasBadge = badgeCount > 0
  const badgeText = badgeCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(badgeCount)

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={hasBadge ? `${label}, ${badgeText}` : label}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={styles.button}
    >
      <ButtonIcon size={ICON_SIZE} color={palette.text} />
      {hasBadge && (
        // Badge số đỏ chữ trắng — theo yêu cầu, khác badge lime của thanh tab
        <View style={[styles.badge, { backgroundColor: palette.notificationBadge, borderColor: palette.background }]}>
          <Text variant="label" weight="bold" color={palette.onInverse}>
            {badgeText}
          </Text>
        </View>
      )}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -Spacing.xs,
    right: -Spacing.xs,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: BorderWidth.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
