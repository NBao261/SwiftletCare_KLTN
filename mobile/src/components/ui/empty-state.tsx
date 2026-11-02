import { StyleSheet, View, type DimensionValue } from 'react-native'
import { PlusIcon } from 'phosphor-react-native'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const PLUS_CIRCLE_SIZE = 44

interface EmptyStateProps {
  // message: một câu xám ("Chưa có nhà yến", "Không tải được"); create: ô "Tạo …" viền nét đứt, bấm cả ô để tạo
  variant?: 'message' | 'create'
  // Câu hiện ra; với create là chữ "Tạo trang trại", "Tạo nhà yến"…
  message: string
  // Nút chữ bên dưới câu (chỉ variant message), ví dụ "Thử lại"
  actionLabel?: string
  // variant message: bấm nút chữ; variant create: bấm cả ô
  onAction?: () => void
  width?: DimensionValue
  height?: DimensionValue
}

// Khung rỗng / lỗi / ô tạo mới dùng chung, cùng cỡ với card thật mà nó thay chỗ
export function EmptyState({ variant = 'message', message, actionLabel, onAction, width, height }: EmptyStateProps) {
  const palette = usePalette()

  if (variant === 'create') {
    return (
      <Card
        style={[styles.state, styles.create, { width, height, borderColor: palette.secondary }]}
        onPress={onAction}
        accessibilityLabel={message}
      >
        <View style={[styles.plusCircle, { backgroundColor: palette.surfaceStrong }]}>
          <PlusIcon size={20} color={palette.text} weight="bold" />
        </View>
        <Text variant="body" weight="semiBold">
          {message}
        </Text>
      </Card>
    )
  }

  return (
    <Card style={[styles.state, { width, height }]} accessibilityLabel={message}>
      <Text variant="small" color={palette.textSecondary} center>
        {message}
      </Text>
      {actionLabel && onAction && <Button variant="link" label={actionLabel} onPress={onAction} />}
    </Card>
  )
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  // Viền nét đứt màu xám trung tính để ô tạo mới khác hẳn card có dữ liệu
  create: { gap: Spacing.sm, borderWidth: BorderWidth.strong, borderStyle: 'dashed' },
  plusCircle: {
    width: PLUS_CIRCLE_SIZE,
    height: PLUS_CIRCLE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
