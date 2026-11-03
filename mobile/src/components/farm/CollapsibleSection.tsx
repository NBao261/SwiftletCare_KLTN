import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { CaretDownIcon, CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface CollapsibleSectionProps {
  title: string
  // Tóm tắt hiện cả khi thu gọn, ví dụ "AUTO" hoặc "1 đang điều khiển tay"
  caption?: string
  captionColor?: string
  children: ReactNode
}

// Khối thu gọn mặc định: chỉ xem tiêu đề + tóm tắt; chạm mới mở ra phần chỉnh, tránh bấm nhầm khi chỉ muốn xem
export function CollapsibleSection({ title, caption, captionColor, children }: CollapsibleSectionProps) {
  const palette = usePalette()
  const [isExpanded, setExpanded] = useState(false)
  const CaretIcon = isExpanded ? CaretDownIcon : CaretRightIcon

  return (
    <Card style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded(current => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={caption ? `${title}, ${caption}` : title}
      >
        <CaretIcon size={16} color={palette.text} weight="bold" />
        <Text variant="body" weight="semiBold" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {caption && (
          <Text variant="small" weight="semiBold" color={captionColor ?? palette.textSecondary} numberOfLines={1}>
            {caption}
          </Text>
        )}
      </Pressable>
      {isExpanded && <View style={styles.body}>{children}</View>}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: Spacing.xl },
  title: { flex: 1 },
  body: { gap: Spacing.md, paddingTop: Spacing.md },
})
