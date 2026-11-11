import { ScrollView, StyleSheet } from 'react-native'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Spacing } from '@/constants/theme'

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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map(option => (
        <ChoiceChip
          key={option.id}
          label={option.label}
          isSelected={option.id === selectedId}
          onPress={() => onSelect(option.id)}
          placement={placement}
          disabled={disabled}
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm },
})
