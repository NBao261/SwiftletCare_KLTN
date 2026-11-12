import { Pressable, StyleSheet } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { truncateText } from '@/utils/name.utils'

// Chip cao 36, nới vùng chạm thêm 4 mỗi phía cho đủ 44 (MOBILE_GUIDE 3.7)
const CHIP_MIN_HEIGHT = 36
const HIT_SLOP = (44 - CHIP_MIN_HEIGHT) / 2
// Chữ trên chip tối đa ~30 ký tự rồi "…" (tên khu vực, nhà dài tới 50 ký tự): chip không phình đẩy chip khác ra khỏi hàng.
// Dùng chung cho mọi hàng chip chọn khu vực (ZoneTabs, ZoneSettingsTabs, AlertFilterChips); trình đọc màn hình vẫn đọc đủ tên
export const CHIP_LABEL_MAX_LENGTH = 30

interface ChoiceChipProps {
  label: string
  isSelected: boolean
  onPress: () => void
  // Chip nằm trên nền Paper (thanh lọc) hay trong card/sheet trắng: chip chưa chọn lấy nền ngược với chỗ đặt để vẫn thấy
  placement?: 'screen' | 'card'
  disabled?: boolean
  accessibilityLabel?: string
}

// Một chip chọn dùng chung (lọc, tab tầng, BẬT/TẮT, thời lượng, nút "Sửa"): chọn thì nền Ink chữ trắng, chưa chọn nền
// trắng (trên Paper) hoặc Paper (trong card), bo tròn hết cỡ
export function ChoiceChip({
  label,
  isSelected,
  onPress,
  placement = 'card',
  disabled = false,
  accessibilityLabel,
}: ChoiceChipProps) {
  const palette = usePalette()
  const idleColor = placement === 'screen' ? palette.surface : palette.surfaceStrong

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      style={[styles.chip, { backgroundColor: isSelected ? palette.inverse : idleColor }, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text variant="body" weight="semiBold" color={isSelected ? palette.onInverse : palette.text} numberOfLines={1}>
        {truncateText(label, CHIP_LABEL_MAX_LENGTH)}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_MIN_HEIGHT,
    justifyContent: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
  },
  disabled: { opacity: 0.4 },
})
