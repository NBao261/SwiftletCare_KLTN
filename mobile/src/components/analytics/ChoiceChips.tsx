import { Pressable, ScrollView, StyleSheet } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

export interface ChoiceOption<T extends string> {
  id: T
  label: string
}

interface ChoiceChipsProps<T extends string> {
  options: ChoiceOption<T>[]
  selectedId: T | null
  onSelect: (id: T) => void
  // Chip nằm trên nền Paper (thanh lọc) hay trong card trắng: chip chưa chọn lấy nền ngược với chỗ đặt để vẫn thấy
  placement?: 'screen' | 'card'
  // Mờ và không bấm được (chip tầng ở tab Đàn chim: đàn chim tính theo nhà)
  disabled?: boolean
  accessibilityLabel: string
}

// Hàng chip chọn một, cuộn ngang — cùng kiểu tab tầng của màn Farm (ZoneTabs): chip chọn nền Ink chữ trắng,
// chip khác nền trắng (trên Paper) hoặc Paper (trong card), bo tròn hết cỡ
export function ChoiceChips<T extends string>({
  options,
  selectedId,
  onSelect,
  placement = 'screen',
  disabled = false,
  accessibilityLabel,
}: ChoiceChipsProps<T>) {
  const palette = usePalette()
  const idleColor = placement === 'screen' ? palette.surface : palette.surfaceStrong

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={disabled && styles.disabled}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map(option => {
        const isSelected = option.id === selectedId
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            disabled={disabled}
            style={[styles.chip, { backgroundColor: isSelected ? palette.inverse : idleColor }]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={option.label}
          >
            <Text variant="body" weight="semiBold" color={isSelected ? palette.onInverse : palette.text}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm },
  chip: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  disabled: { opacity: 0.4 },
})
