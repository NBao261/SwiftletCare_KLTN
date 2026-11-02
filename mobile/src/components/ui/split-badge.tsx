import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'

const INNER_HEIGHT = 24

interface SplitBadgeProps {
  // Chữ trong viên trắng bên trái
  left: string
  // Chữ trên nền viên ngoài, bên phải viên trắng; không có thì chỉ còn viên trắng trong viền màu
  right?: string
  color: string
  textColor: string
  innerColor: string
  innerTextColor: string
  // Chiều rộng cố định của viên trong, để các nội dung khác độ dài vẫn cùng một cỡ
  leftWidth?: number
}

// Nhãn 2 phần: viên ngoài màu đậm, bên trái lồng một viên nhạt chứa nội dung chính
export function SplitBadge({ left, right, color, textColor, innerColor, innerTextColor, leftWidth }: SplitBadgeProps) {
  return (
    <View
      style={[styles.badge, { backgroundColor: color }]}
      accessible
      accessibilityLabel={right ? `${left}, ${right}` : left}
    >
      <View style={[styles.inner, { backgroundColor: innerColor }, leftWidth !== undefined && { width: leftWidth }]}>
        <Text variant="label" weight="bold" color={innerTextColor} numberOfLines={1} center>
          {left}
        </Text>
      </View>
      {right && (
        <Text variant="label" weight="bold" color={textColor} numberOfLines={1} style={styles.rightText}>
          {right}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Không co lại: nội dung đã được giới hạn độ dài (ô trái cố định, chữ phải đã cắt) nên luôn hiện đủ
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    padding: Spacing.xs,
  },
  inner: {
    height: INNER_HEIGHT,
    justifyContent: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
  },
  rightText: { paddingHorizontal: Spacing.md },
})
