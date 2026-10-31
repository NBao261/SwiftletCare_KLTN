import { Pressable, StyleSheet } from 'react-native'
import type { Icon } from 'phosphor-react-native'
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
}

// Nút tròn trên video: nền mực mờ (videoControlBackdrop) để icon trắng luôn rõ trên mọi khung hình
export function PlayerControlButton({ icon: IconComponent, label, onPress, size = DEFAULT_SIZE }: PlayerControlButtonProps) {
  const palette = usePalette()

  return (
    <Pressable
      style={[styles.button, { width: size, height: size, backgroundColor: palette.videoControlBackdrop }]}
      onPress={onPress}
      hitSlop={Spacing.xs}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconComponent size={size >= LARGE_BUTTON_SIZE ? 32 : 16} color={palette.onInverse} weight="fill" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
})
