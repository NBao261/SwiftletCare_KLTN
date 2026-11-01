import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { Icon } from 'phosphor-react-native'
import { PlayerControlButton } from '@/components/home/PlayerControlButton'
import { Spacing } from '@/constants/theme'

// Cùng một kiểu cho mọi nút trong cột: nút 40, icon 24 nét rỗng — to hơn nút tròn mặc định (36, icon 16)
const BUTTON_SIZE = 40
const ICON_SIZE = 24

export interface CameraControl {
  icon: Icon
  label: string
  onPress: () => void
}

interface CameraControlColumnProps {
  controls: CameraControl[]
  // Khoảng cách tới mép phải; màn toàn màn hình cộng thêm vùng an toàn (tai thỏ khi xoay ngang)
  style?: StyleProp<ViewStyle>
}

// Cột nút dọc sát mép phải, căn giữa theo chiều cao khung — khung camera ở Màn B và màn toàn màn hình dùng chung
export function CameraControlColumn({ controls, style }: CameraControlColumnProps) {
  return (
    <View style={[styles.column, style]} pointerEvents="box-none">
      {controls.map(control => (
        <PlayerControlButton
          key={control.label}
          icon={control.icon}
          label={control.label}
          onPress={control.onPress}
          size={BUTTON_SIZE}
          iconSize={ICON_SIZE}
          iconWeight="bold"
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  // 4 nút 40 + 3 khoảng 4 (172) vừa khung 16:9 trên màn hẹp 360 (khoảng 184)
  column: { position: 'absolute', top: 0, bottom: 0, right: Spacing.sm, justifyContent: 'center', gap: Spacing.xs },
})
