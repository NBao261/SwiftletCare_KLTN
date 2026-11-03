import { StyleSheet, View } from 'react-native'
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Trend } from '@/utils/analytics.utils'

// Cao cố định để bốn ô bằng nhau và khung xương đúng hình
export const KPI_TILE_HEIGHT = 112

interface KpiTileProps {
  label: string
  // Số lớn; không có dữ liệu thì "_"
  value: string
  // Dòng phụ: so với kỳ trước, tầng thấp nhất, số lần điều khiển tay…
  caption?: string
  trend?: Trend | null
  // Nền cam nhạt khi có cảnh báo CRITICAL/HIGH (cam chỉ dùng cho cảnh báo)
  isWarning?: boolean
  isLoading: boolean
  onPress: () => void
  accessibilityHint: string
}

// Một ô tổng quan đầu màn Phân tích — card trắng bo lớn không viền như các card khác của app; chạm thì cuộn tới tab của số đó
export function KpiTile({
  label,
  value,
  caption,
  trend,
  isWarning = false,
  isLoading,
  onPress,
  accessibilityHint,
}: KpiTileProps) {
  const palette = usePalette()
  if (isLoading) return <Skeleton width="100%" height={KPI_TILE_HEIGHT} />

  const TrendIcon = trend === 'up' ? ArrowUpIcon : trend === 'down' ? ArrowDownIcon : MinusIcon
  const trendColor = trend === 'up' ? palette.houseHealthy : palette.textSecondary
  const secondaryColor = isWarning ? palette.severityP2Text : palette.textSecondary

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.tile, { backgroundColor: isWarning ? palette.severityP2 : palette.surface }]}
      accessibilityRole="button"
      accessibilityLabel={caption ? `${label}: ${value}, ${caption}` : `${label}: ${value}`}
      accessibilityHint={accessibilityHint}
    >
      <Text variant="small" color={secondaryColor} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.value}>
        {value}
      </Text>
      <View style={styles.captionRow}>
        {trend && <TrendIcon size={12} color={trendColor} weight="bold" />}
        {caption ? (
          <Text variant="small" color={secondaryColor} numberOfLines={1} style={styles.flex}>
            {caption}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  tile: { height: KPI_TILE_HEIGHT, borderRadius: Radius.lg, padding: Spacing.lg, justifyContent: 'space-between' },
  value: { fontVariant: ['tabular-nums'] },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  flex: { flex: 1 },
})
