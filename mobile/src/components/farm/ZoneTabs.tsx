import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Zone } from '@/types'
import { t } from '@/utils/i18n.utils'

const DOT_SIZE = 6

interface ZoneTabsProps {
  zones: Zone[]
  selectedZoneId: string
  // Zone đang có cảnh báo hiệu lực: chấm cam cạnh tên
  alertZoneIds: Set<string>
  onSelect: (zoneId: string) => void
}

// Hàng tab tầng ngay dưới camera; nhà chỉ có 1 tầng thì không hiện
export function ZoneTabs({ zones, selectedZoneId, alertZoneIds, onSelect }: ZoneTabsProps) {
  const palette = usePalette()
  if (zones.length < 2) return null

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {zones.map(zone => {
        const isSelected = zone._id === selectedZoneId
        const hasAlert = alertZoneIds.has(zone._id)
        return (
          <Pressable
            key={zone._id}
            onPress={() => onSelect(zone._id)}
            style={[styles.tab, { backgroundColor: isSelected ? palette.inverse : palette.surface }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={hasAlert ? t('{zone}, có cảnh báo', { zone: zone.name }) : zone.name}
          >
            <Text variant="body" weight="semiBold" color={isSelected ? palette.onInverse : palette.text}>
              {zone.name}
            </Text>
            {hasAlert && <View style={[styles.dot, { backgroundColor: palette.alert }]} />}
          </Pressable>
        )
      })}
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
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: Radius.full },
})
