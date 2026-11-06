import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { getMetricLabel } from '@/utils/label.utils'
import type { SensorTile } from '@/utils/sensorTile.utils'
import type { SensorMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

interface SensorTileGridProps {
  tiles: SensorTile[]
  // Phút tới lúc dự báo vượt ngưỡng (FORECAST_BREACH) của nhiệt độ / độ ẩm; không có thì null
  forecastMinutes: { temperature: number | null; humidity: number | null }
  // Chạm một ô: mở biểu đồ chỉ số đó ở tab Phân tích (đặc tả Menu Phân tích §2)
  onPressTile?: (metric: SensorMetric) => void
}

// Câu dưới số giống web: trong ngưỡng "An toàn …" / "Cảnh báo khi …" (NH3, CO2), ngoài ngưỡng thì báo; tiếng ồn để trống
function getRangeLine(tile: SensorTile): string | null {
  if (tile.isOutOfRange) return tile.isAlertOnly ? t('Vượt ngưỡng cảnh báo') : t('Ngoài ngưỡng an toàn')
  if (!tile.rangeText) return null
  return tile.isAlertOnly ? t('Cảnh báo khi {range}', { range: tile.rangeText }) : t('An toàn {range}', { range: tile.rangeText })
}

// Lưới 6 ô cảm biến của zone đang chọn, 2 cột × 3 hàng, ô thấp gọn để cả lưới nằm trong màn đầu dưới camera:
// tên, số lớn kèm đơn vị nhỏ (như web), câu ngưỡng một dòng; ngoài ngưỡng thì số màu cam
export function SensorTileGrid({ tiles, forecastMinutes, onPressTile }: SensorTileGridProps) {
  const palette = usePalette()

  return (
    <View style={styles.grid}>
      {tiles.map(tile => {
        const label = getMetricLabel(tile.metric)
        const forecast =
          tile.metric === 'temperature' || tile.metric === 'humidity' ? forecastMinutes[tile.metric] : null
        const valueColor = tile.isOutOfRange ? palette.alert : palette.text
        return (
          <Pressable
            key={tile.metric}
            style={[styles.tile, { backgroundColor: palette.surface }]}
            onPress={onPressTile ? () => onPressTile(tile.metric) : undefined}
            disabled={!onPressTile}
            accessibilityRole={onPressTile ? 'button' : undefined}
            accessibilityHint={onPressTile ? t('Mở biểu đồ ở Phân tích') : undefined}
            accessibilityLabel={[
              `${label} ${tile.valueText}`,
              getRangeLine(tile),
              tile.isSignalLost ? t('Mất tín hiệu') : null,
            ]
              .filter(Boolean)
              .join(', ')}
          >
            <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
              {label}
            </Text>
            <View style={styles.valueRow}>
              <Text variant="heading" weight="semiBold" color={valueColor} numberOfLines={1} style={styles.number}>
                {tile.numberText}
              </Text>
              {tile.unitText !== '' && (
                <Text variant="small" color={tile.isOutOfRange ? palette.alert : palette.textSecondary}>
                  {tile.unitText}
                </Text>
              )}
            </View>
            {tile.isSignalLost ? (
              <Text variant="small" weight="semiBold" color={palette.alert}>
                {t('Mất tín hiệu')}
              </Text>
            ) : (
              <Text
                variant="small"
                weight={tile.isOutOfRange ? 'semiBold' : 'regular'}
                color={tile.isOutOfRange ? palette.alert : palette.textSecondary}
                numberOfLines={1}
              >
                {/* Tiếng ồn không có ngưỡng: giữ dòng trống để các ô cao bằng nhau */}
                {getRangeLine(tile) ?? ' '}
              </Text>
            )}
            {forecast !== null && (
              <Text variant="small" weight="semiBold" color={palette.alert}>
                {t('Dự kiến vượt ngưỡng sau {minutes} phút', { minutes: forecast })}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  // Hai cột: mỗi ô gần nửa hàng; lề dọc 8 cho ô thấp (khoảng 82), lề ngang 12
  tile: {
    flexGrow: 1,
    flexBasis: '40%',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  number: { flexShrink: 1 },
})
