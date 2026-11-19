import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// SYSTEM-FR-004 — nhãn "Giả lập" cạnh mã thiết bị của bộ giả lập; thiết bị thật không hiện gì (giống SimulatedBadge của web)
export function SimulatedBadge({ simulated }: { simulated?: boolean }) {
  const palette = usePalette()
  if (!simulated) return null

  return (
    <View
      style={[styles.badge, { backgroundColor: palette.surfaceStrong }]}
      accessible
      accessibilityLabel={t('Thiết bị của bộ giả lập, không phải thiết bị thật')}
    >
      <Text variant="small" weight="semiBold" color={palette.textSecondary} numberOfLines={1}>
        {t('Giả lập')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
})
