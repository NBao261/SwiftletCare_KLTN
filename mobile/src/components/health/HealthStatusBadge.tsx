import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HealthDayStatus } from '@/types'
import { getHealthStatusColors, getHealthStatusLabel } from '@/utils/healthDay.utils'

interface HealthStatusBadgeProps {
  status: HealthDayStatus
}

// Huy hiệu trạng thái ngày (BR-29) — cũng dùng cho mức người chấm chọn
export function HealthStatusBadge({ status }: HealthStatusBadgeProps) {
  const palette = usePalette()
  const colors = getHealthStatusColors(status, palette)

  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <Text variant="small" weight="semiBold" color={colors.text} numberOfLines={1}>
        {getHealthStatusLabel(status)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
})
