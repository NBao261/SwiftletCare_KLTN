import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface HomeSectionProps {
  title: string
  // Chữ nút bên phải tiêu đề, ví dụ "Xem tất cả"; không truyền thì không hiện
  actionLabel?: string
  onAction?: () => void
  children: ReactNode
}

// Một khối của Trang chủ: tiêu đề + nút phụ bên phải + nội dung bên dưới
export function HomeSection({ title, actionLabel, onAction, children }: HomeSectionProps) {
  const palette = usePalette()

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="heading" weight="semiBold" accessibilityRole="header">
          {title}
        </Text>
        {actionLabel && onAction && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={Spacing.md}
            onPress={onAction}
          >
            <Text variant="small" color={palette.textSecondary}>
              {actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
