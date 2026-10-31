import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeftIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Chiều cao thanh header, tính dưới vùng an toàn (giờ, pin, tai thỏ / Dynamic Island)
export const APP_HEADER_HEIGHT = 52
const BACK_BUTTON_SIZE = 44

interface AppHeaderProps {
  title?: string
  // Nội dung bên trái thay cho tiêu đề, ví dụ ảnh đại diện + tên ở Trang chủ
  leading?: ReactNode
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
  leading,
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
            accessibilityLabel={t('Quay lại')}
            hitSlop={Spacing.xs}
            onPress={onBack}
            style={[
              styles.backButton,
              // Nền sáng: nút tròn trắng không viền; nền tối (khung video) giữ viền màu chữ
              foregroundColor ? { borderWidth: BorderWidth.regular, borderColor: foregroundColor } : { backgroundColor: palette.surface },
            ]}
          >
            <ArrowLeftIcon size={20} color={textColor} />
          </Pressable>
        )}

        {leading && <View style={styles.leading}>{leading}</View>}

        {!leading && title && (
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
  // Nút tròn, vùng chạm 44 × 44
  backButton: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftTitle: { flex: 1 },
  leading: { flex: 1 },
  // Căn giữa theo cả thanh, chừa chỗ hai bên cho nút quay lại và nút phải
  centeredTitle: {
    position: 'absolute',
    left: Spacing.lg + BACK_BUTTON_SIZE + Spacing.md,
    right: Spacing.lg + BACK_BUTTON_SIZE + Spacing.md,
    textAlign: 'center',
  },
  right: { marginLeft: 'auto', minWidth: BACK_BUTTON_SIZE, alignItems: 'flex-end' },
})
