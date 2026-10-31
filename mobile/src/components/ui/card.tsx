import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface CardProps {
  children: ReactNode
  // inverse: card tối nền Ink cho khối nổi bật; mặc định card trắng
  tone?: 'default' | 'inverse'
  // Có thì cả card là một nút bấm (co lại khi nhấn)
  onPress?: () => void
  // Câu đọc cho trình đọc màn hình: có thì cả card được đọc thành một câu
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
}

// Khung card dùng chung: bo góc lớn, không viền, không bóng; truyền onPress thì card bấm được
export function Card({ children, tone = 'default', onPress, accessibilityLabel, accessibilityHint, style }: CardProps) {
  const palette = usePalette()
  const backgroundColor = tone === 'inverse' ? palette.inverse : palette.surface
  const cardStyle = [styles.card, { backgroundColor }, style]

  if (onPress) {
    return (
      <PressableScale
        style={cardStyle}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {children}
      </PressableScale>
    )
  }

  return (
    <View
      style={cardStyle}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
})
