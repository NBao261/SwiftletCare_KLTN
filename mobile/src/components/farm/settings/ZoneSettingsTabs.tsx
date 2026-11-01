import { Pressable, ScrollView, StyleSheet } from 'react-native'
import { PlusIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Zone } from '@/types'
import { t } from '@/utils/i18n.utils'

interface ZoneSettingsTabsProps {
  zones: Zone[]
  selectedZoneId: string | null
  onSelect: (zoneId: string) => void
  // Có quyền tạo zone thì có thẻ "+ Thêm tầng" cuối hàng
  onAdd?: () => void
}

// Hàng tab tầng của trang cài đặt (cùng kiểu tab tầng ở chi tiết nhà): luôn hiện, kể cả nhà một tầng, để có chỗ thêm tầng
export function ZoneSettingsTabs({ zones, selectedZoneId, onSelect, onAdd }: ZoneSettingsTabsProps) {
  const palette = usePalette()

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {zones.map(zone => {
        const isSelected = zone._id === selectedZoneId
        return (
          <Pressable
            key={zone._id}
            onPress={() => onSelect(zone._id)}
            style={[styles.tab, { backgroundColor: isSelected ? palette.inverse : palette.surface }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={zone.name}
          >
            <Text variant="body" weight="semiBold" color={isSelected ? palette.onInverse : palette.text}>
              {zone.name}
            </Text>
          </Pressable>
        )
      })}
      {onAdd && (
        <Pressable
          onPress={onAdd}
          style={[styles.tab, styles.addTab, { borderColor: palette.text }]}
          accessibilityRole="button"
          accessibilityLabel={t('Thêm tầng')}
        >
          <PlusIcon size={16} color={palette.text} weight="bold" />
          <Text variant="body" weight="semiBold">
            {t('Thêm tầng')}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  addTab: { borderWidth: BorderWidth.strong, borderStyle: 'dashed' },
})
