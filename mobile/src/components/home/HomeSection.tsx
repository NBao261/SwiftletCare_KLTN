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
  // Trang dạng danh sách cài đặt (Tài khoản): tiêu đề nhỏ hơn, sát nội dung hơn
  isCompact?: boolean
  children: ReactNode
}

// Một khối của Trang chủ: tiêu đề + nút phụ bên phải + nội dung bên dưới
export function HomeSection({ title, actionLabel, onAction, isCompact = false, children }: HomeSectionProps) {
  const palette = usePalette()

  return (
    <View style={[styles.section, isCompact && styles.compactSection]}>
      <View style={[styles.header, isCompact && styles.compactHeader]}>
        <Text
          variant={isCompact ? 'body' : 'heading'}
          weight="semiBold"
          accessibilityRole="header"
        >
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
  compactSection: { gap: Spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactHeader: { paddingHorizontal: Spacing.xs },
})
