import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon, type Icon } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const ICON_TILE_SIZE = 40

export interface MenuAction {
  icon: Icon
  label: string
  // Dòng phụ giải thích thao tác sẽ làm gì
  caption?: string
  onPress: () => void
}

interface ActionMenuSheetProps {
  visible: boolean
  title: string
  actions: MenuAction[]
  onClose: () => void
}

// Bảng thao tác mở từ nút ⋮: mỗi dòng một thao tác (icon, tên, dòng phụ), bấm thì đóng bảng rồi làm
export function ActionMenuSheet({ visible, title, actions, onClose }: ActionMenuSheetProps) {
  const palette = usePalette()

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="heading">{title}</Text>
      <View>
        {actions.map((action, index) => {
          const ActionIcon = action.icon
          return (
            <Pressable
              key={action.label}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider },
              ]}
              onPress={() => {
                onClose()
                action.onPress()
              }}
              accessibilityRole="button"
              accessibilityLabel={action.caption ? `${action.label}, ${action.caption}` : action.label}
            >
              <View style={[styles.iconTile, { backgroundColor: palette.surfaceStrong }]}>
                <ActionIcon size={20} color={palette.text} />
              </View>
              <View style={styles.texts}>
                <Text variant="body" weight="semiBold">
                  {action.label}
                </Text>
                {action.caption && (
                  <Text variant="small" color={palette.textSecondary}>
                    {action.caption}
                  </Text>
                )}
              </View>
              <CaretRightIcon size={16} color={palette.textSecondary} weight="bold" />
            </Pressable>
          )
        })}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  iconTile: {
    width: ICON_TILE_SIZE,
    height: ICON_TILE_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
