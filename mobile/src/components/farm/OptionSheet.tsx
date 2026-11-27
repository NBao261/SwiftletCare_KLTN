import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { CheckIcon, PlusIcon, type Icon } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

export interface SheetOption {
  id: string
  label: string
  caption?: string
  // Số nổi bật bên phải dòng, ví dụ tỷ lệ về tổ của nhà
  value?: string
}

interface OptionSheetProps {
  visible: boolean
  title: string
  options: SheetOption[]
  selectedId?: string
  onSelect: (id: string) => void
  onClose: () => void
  // Dòng thao tác cuối bảng, ví dụ "Tạo trang trại"
  // icon mặc định là dấu + ("Tạo trang trại"); thao tác khác truyền icon riêng (mũi tên "Đổi trang trại")
  footerAction?: { label: string; onPress: () => void; icon?: Icon }
  // Khối giữa tiêu đề và danh sách, ví dụ chip sắp xếp
  header?: ReactNode
}

// Bảng chọn một mục từ danh sách (đổi farm, đổi nhà): mục đang chọn có dấu tích
export function OptionSheet({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  footerAction,
  header,
}: OptionSheetProps) {
  const palette = usePalette()

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="heading">{title}</Text>
      {header}
      <ScrollView style={styles.list}>
        {options.map((option, index) => {
          const isSelected = option.id === selectedId
          return (
            <Pressable
              key={option.id}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider },
              ]}
              onPress={() => onSelect(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={[option.label, option.value, option.caption].filter(Boolean).join(', ')}
            >
              <View style={styles.texts}>
                <Text variant="body" weight={isSelected ? 'semiBold' : 'regular'} numberOfLines={1}>
                  {option.label}
                </Text>
                {option.caption && (
                  // Chú thích dài (tên trang trại kèm số chim) xuống tối đa 2 dòng thay vì bị cắt
                  <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
                    {option.caption}
                  </Text>
                )}
              </View>
              {option.value !== undefined && (
                <Text variant="body" weight="semiBold">
                  {option.value}
                </Text>
              )}
              {isSelected && <CheckIcon size={20} color={palette.text} weight="bold" />}
            </Pressable>
          )
        })}
      </ScrollView>
      {footerAction && (
        <Pressable
          style={[styles.row, { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }]}
          onPress={footerAction.onPress}
          accessibilityRole="button"
          accessibilityLabel={footerAction.label}
        >
          {footerAction.icon ? (
            <footerAction.icon size={20} color={palette.text} weight="bold" />
          ) : (
            <PlusIcon size={20} color={palette.text} weight="bold" />
          )}
          <Text variant="body" weight="semiBold" style={styles.texts}>
            {footerAction.label}
          </Text>
        </Pressable>
      )}
    </BottomSheet>
  )
}

// Danh sách dài thì cuộn trong bảng, không đẩy bảng cao quá nửa màn
const LIST_MAX_HEIGHT = 360

const styles = StyleSheet.create({
  list: { maxHeight: LIST_MAX_HEIGHT },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
