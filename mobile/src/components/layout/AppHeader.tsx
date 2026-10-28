import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeftIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Chiều cao thanh header, tính dưới vùng an toàn (giờ, pin, tai thỏ / Dynamic Island)
export const APP_HEADER_HEIGHT = 52
const BACK_BUTTON_SIZE = 44

interface AppHeaderProps {
  title?: string
  // Có thì hiện nút quay lại bên trái
  onBack?: () => void
  // Mặc định: có nút quay lại thì căn giữa, không có thì căn trái (tiêu đề của tab)
  titleAlign?: 'center' | 'left'
  // Nút thao tác bên phải, ví dụ lọc hoặc thêm
  right?: ReactNode
  // Màn nền tối (khung video) truyền màu riêng; mặc định theo palette
  backgroundColor?: string
  foregroundColor?: string
}

// Header dùng chung: tự chừa vùng an toàn trên cùng bằng useSafeAreaInsets, không dùng padding cứng
export function AppHeader({
  title,
  onBack,
  titleAlign = onBack ? 'center' : 'left',
  right,
  backgroundColor,
  foregroundColor,
}: AppHeaderProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const textColor = foregroundColor ?? palette.text
  const isCentered = titleAlign === 'center'

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: backgroundColor ?? palette.background }}>
      <View style={styles.bar}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            hitSlop={Spacing.xs}
            onPress={onBack}
            style={[styles.backButton, { borderColor: foregroundColor ?? palette.border }]}
          >
            <ArrowLeftIcon size={20} color={textColor} />
          </Pressable>
        )}

        {title && (
          <Text
            variant="heading"
            weight="semiBold"
            color={textColor}
            numberOfLines={1}
            accessibilityRole="header"
            style={isCentered ? styles.centeredTitle : styles.leftTitle}
          >
            {title}
          </Text>
        )}

        <View style={styles.right}>{right}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    height: APP_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  // Nút tròn viền mảnh, vùng chạm 44 × 44
  backButton: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: Radius.full,
    borderWidth: BorderWidth.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftTitle: { flex: 1 },
  // Căn giữa theo cả thanh, chừa chỗ hai bên cho nút quay lại và nút phải
  centeredTitle: {
    position: 'absolute',
    left: Spacing.lg + BACK_BUTTON_SIZE + Spacing.md,
    right: Spacing.lg + BACK_BUTTON_SIZE + Spacing.md,
    textAlign: 'center',
  },
  right: { marginLeft: 'auto', minWidth: BACK_BUTTON_SIZE, alignItems: 'flex-end' },
})
