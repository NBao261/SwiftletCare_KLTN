import { StyleSheet, View } from 'react-native'
import type { Icon, IconWeight } from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Vùng chạm tối thiểu 44 × 44 (MOBILE_GUIDE 3.7)
const BUTTON_SIZE = 44
const ICON_SIZE = 20
// Badge cao 20: trừ viền 1,5 mỗi bên còn 17, đủ cho dòng chữ 14 của "9+" không bị chật
const BADGE_SIZE = 20
const BADGE_FONT_SIZE = 11
const BADGE_LINE_HEIGHT = 14
// Neo badge vào góc trên bên phải của chính icon (không phải góc vùng chạm 44 × 44): cạnh trái ở giữa icon, nhô lên nửa badge
// trừ 2 px để đè nhẹ lên vai chuông. Số dài ("9+") nở sang phải, không che thân chuông
const BADGE_OFFSET_LEFT = ICON_SIZE / 2
const BADGE_OFFSET_TOP = -(BADGE_SIZE / 2) + 2
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
  // Nét icon: 'fill' cho trạng thái đang bật (ví dụ đã ghim)
  weight?: IconWeight
  // Màu icon, chỉ truyền token của palette (ví dụ palette.alert cho nút gỡ); mặc định palette.text
  color?: string
}

// Nút chỉ có icon, không nền, kèm badge số tuỳ chọn
export function IconButton({ icon: ButtonIcon, label, onPress, badgeCount = 0, weight = 'regular', color }: IconButtonProps) {
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
      <View style={styles.iconWrap}>
        <ButtonIcon size={ICON_SIZE} color={color ?? palette.text} weight={weight} />
        {hasBadge && (
          // Badge số đỏ chữ trắng (khác badge lime của thanh tab); viền màu nền header tách badge khỏi nét chuông
          <View style={[styles.badge, { backgroundColor: palette.notificationBadge, borderColor: palette.background }]}>
            <Text variant="label" weight="bold" color={palette.onInverse} style={styles.badgeText}>
              {badgeText}
            </Text>
          </View>
        )}
      </View>
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
  iconWrap: { width: ICON_SIZE, height: ICON_SIZE },
  // Một chữ số: tròn 20 × 20; "9+": viên thuốc gọn nhờ minWidth + padding ngang nhỏ
  badge: {
    position: 'absolute',
    top: BADGE_OFFSET_TOP,
    left: BADGE_OFFSET_LEFT,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    paddingHorizontal: Spacing.xs - BorderWidth.strong,
    borderRadius: Radius.full,
    borderWidth: BorderWidth.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Chữ nằm đúng giữa badge: Android bỏ khoảng đệm trên dưới của font
  badgeText: {
    fontSize: BADGE_FONT_SIZE,
    lineHeight: BADGE_LINE_HEIGHT,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
})
