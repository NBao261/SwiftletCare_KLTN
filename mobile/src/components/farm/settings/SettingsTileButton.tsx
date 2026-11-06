import { ActivityIndicator, StyleSheet } from 'react-native'
import type { Icon } from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Radius } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const TILE_SIZE = 52

export interface SettingsTileAction {
  icon: Icon
  // Tên ô cho trình đọc màn hình
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}

// Ô vuông nền Paper chứa icon 32 ở chân card, như ô mã QR góc dưới ảnh mẫu: quét QR, lấy vị trí, đặt lại mặc định
export function SettingsTileButton({
  icon: TileIcon,
  label,
  onPress,
  disabled = false,
  loading = false,
}: SettingsTileAction) {
  const palette = usePalette()
  const isDisabled = disabled || loading

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.tile, { backgroundColor: palette.surfaceStrong }, isDisabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? <ActivityIndicator color={palette.text} /> : <TileIcon size={32} color={palette.text} />}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
})
