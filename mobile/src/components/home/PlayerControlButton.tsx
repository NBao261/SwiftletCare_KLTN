import { Pressable, StyleSheet, View } from 'react-native'
import type { Icon } from 'phosphor-react-native'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const DEFAULT_SIZE = 36
// Nút từ cỡ này trở lên (nút phát giữa khung) dùng icon 32, còn lại icon 16 — đúng thang cỡ icon
const LARGE_BUTTON_SIZE = 56
const BACKDROP_OPACITY = 0.55

interface PlayerControlButtonProps {
  icon: Icon
  label: string
  onPress: () => void
  // Đường kính nút; nút phát/tạm dừng giữa khung to hơn
  size?: number
}

// Nút tròn trên video: nền mực mờ để icon trắng luôn rõ trên mọi khung hình
export function PlayerControlButton({ icon: IconComponent, label, onPress, size = DEFAULT_SIZE }: PlayerControlButtonProps) {
  const palette = usePalette()

  return (
    <Pressable
      style={[styles.button, { width: size, height: size }]}
      onPress={onPress}
      hitSlop={Spacing.xs}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: palette.inverse }]} />
      <IconComponent size={size >= LARGE_BUTTON_SIZE ? 32 : 16} color={palette.onInverse} weight="fill" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  backdrop: { opacity: BACKDROP_OPACITY },
})
