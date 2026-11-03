import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon, type Icon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const ICON_BOX_SIZE = 40

interface ProfileRowProps {
  icon: Icon
  label: string
  // Có thì nhãn thành chữ nhỏ xám phía trên và giá trị là dòng chính (thẻ thông tin); không có thì nhãn là dòng chính
  value?: string
  // Dòng phụ dưới nhãn (giải thích, trạng thái)
  caption?: string
  // Có thì cả hàng bấm được và hiện mũi tên ›
  onPress?: () => void
  // Thao tác phá huỷ (yêu cầu xoá tài khoản): chữ và icon màu cảnh báo
  isDestructive?: boolean
  // Nội dung bên phải thay mũi tên, ví dụ công tắc hoặc nhãn "Dữ liệu mẫu"
  trailing?: ReactNode
  // Kẻ đường mảnh dưới hàng, trừ hàng cuối của thẻ
  hasDivider?: boolean
  accessibilityLabel?: string
}

// Một hàng trong thẻ của trang Tài khoản: ô vuông icon + chữ + mũi tên, theo ảnh mẫu
export function ProfileRow({
  icon: RowIcon,
  label,
  value,
  caption,
  onPress,
  isDestructive = false,
  trailing,
  hasDivider = false,
  accessibilityLabel,
}: ProfileRowProps) {
  const palette = usePalette()
  const mainColor = isDestructive ? palette.alert : palette.text
  const hasValue = value !== undefined

  const content = (
    <>
      <View style={[styles.iconBox, { backgroundColor: palette.surfaceStrong }]}>
        <RowIcon size={20} color={mainColor} />
      </View>
      <View style={styles.texts}>
        {hasValue && (
          <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
            {label}
          </Text>
        )}
        <Text variant="body" weight="medium" color={mainColor} numberOfLines={1}>
          {hasValue ? value : label}
        </Text>
        {caption && (
          <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
            {caption}
          </Text>
        )}
      </View>
      {trailing}
      {onPress && !trailing && <CaretRightIcon size={16} color={palette.textSecondary} />}
    </>
  )
  const rowStyle = [
    styles.row,
    hasDivider && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider },
  ]

  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={accessibilityLabel ?? [label, value, caption].filter(Boolean).join(', ')}>
        {content}
      </View>
    )
  }

  return (
    <Pressable
      style={rowStyle}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [label, value, caption].filter(Boolean).join(', ')}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: 2 },
})
