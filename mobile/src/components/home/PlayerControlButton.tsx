import { Pressable, StyleSheet } from 'react-native'
import type { Icon, IconWeight } from 'phosphor-react-native'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const DEFAULT_SIZE = 36
// Nút từ cỡ này trở lên (nút phát giữa khung) dùng icon 32, còn lại icon 16 — đúng thang cỡ icon
const LARGE_BUTTON_SIZE = 56

interface PlayerControlButtonProps {
  icon: Icon
  label: string
  onPress: () => void
  // Đường kính nút; nút phát/tạm dừng giữa khung to hơn
  size?: number
  // Cỡ icon theo thang; không truyền thì 32 cho nút lớn, 16 cho nút thường
  iconSize?: 16 | 20 | 24 | 32
  // Nét icon; mặc định đặc (fill). Cột nút của khung camera dùng nét rỗng 'bold' cho cùng một kiểu
  iconWeight?: IconWeight
}

// Nút tròn trên video: nền mực mờ (videoControlBackdrop) để icon trắng luôn rõ trên mọi khung hình
export function PlayerControlButton({ icon: IconComponent, label, onPress, size = DEFAULT_SIZE, iconSize, iconWeight = 'fill' }: PlayerControlButtonProps) {
  const palette = usePalette()

  return (
    <Pressable
      style={[styles.button, { width: size, height: size, backgroundColor: palette.videoControlBackdrop }]}
      onPress={onPress}
      hitSlop={Spacing.xs}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconComponent size={iconSize ?? (size >= LARGE_BUTTON_SIZE ? 32 : 16)} color={palette.onInverse} weight={iconWeight} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
})
