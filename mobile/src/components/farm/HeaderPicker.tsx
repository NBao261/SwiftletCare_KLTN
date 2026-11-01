import { Pressable, StyleSheet } from 'react-native'
import { CaretDownIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface HeaderPickerProps {
  title: string
  // Không truyền thì chỉ là tiêu đề, không có ▾ (chỉ có một farm/nhà để chọn)
  onPress?: () => void
  accessibilityLabel: string
}

// Tiêu đề trên thanh trên kèm ▾: chạm để mở sheet chọn farm hoặc chọn nhà
export function HeaderPicker({ title, onPress, accessibilityLabel }: HeaderPickerProps) {
  const palette = usePalette()

  return (
    <Pressable
      style={styles.picker}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={Spacing.xs}
      accessibilityRole={onPress ? 'button' : 'header'}
      accessibilityLabel={accessibilityLabel}
    >
      <Text variant="heading" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {onPress && <CaretDownIcon size={16} color={palette.text} weight="bold" />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  picker: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minWidth: 0 },
  title: { flexShrink: 1 },
})
