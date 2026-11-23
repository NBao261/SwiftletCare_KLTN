import { StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { HealthStatusBadge } from '@/components/health/HealthStatusBadge'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HouseHealthDay } from '@/types'
import { formatHealthDate, getHealthStatusLabel, getMyRatingCaption } from '@/utils/healthDay.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

interface HealthDayRowProps {
  day: HouseHealthDay
  onPress: () => void
  // Hiện tên nhà (danh sách nhiều nhà)
  showsHouse?: boolean
  hasDivider?: boolean
}

// "24–31 °C · mưa 2,5 mm"; không có thời tiết thì "_"
function formatWeather(day: HouseHealthDay): string {
  const weather = day.weather
  if (!weather) return '_'
  const parts: string[] = []
  if (weather.temperature_min !== null && weather.temperature_max !== null) {
    parts.push(`${formatDecimal(weather.temperature_min)}–${formatDecimal(weather.temperature_max)} °C`)
  }
  if (weather.precipitation_mm !== null && weather.precipitation_mm > 0) {
    parts.push(t('mưa {mm} mm', { mm: formatDecimal(weather.precipitation_mm, 1) }))
  }
  return parts.length > 0 ? parts.join(' · ') : '_'
}

// Một ngày trong danh sách: luôn có trạng thái (BR-31); ngày chờ chấm ghi thêm hạn chấm để nhắc người dùng
export function HealthDayRow({ day, onPress, showsHouse = false, hasDivider = false }: HealthDayRowProps) {
  const palette = usePalette()
  const isPending = day.my_rating_state === 'PENDING'
  // Chưa có gì về đánh giá của người dùng thì dòng phụ là thời tiết của ngày
  const caption = getMyRatingCaption(day) ?? formatWeather(day)
  const statusText = getHealthStatusLabel(day.current_status)

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.row, hasDivider && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider }]}
      accessibilityRole="button"
      accessibilityLabel={[showsHouse ? day.house_name : null, formatHealthDate(day.date), statusText, caption]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold" numberOfLines={1}>
          {showsHouse ? `${formatHealthDate(day.date)} · ${day.house_name}` : formatHealthDate(day.date)}
        </Text>
        <Text variant="small" color={isPending ? palette.text : palette.textSecondary} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <HealthStatusBadge status={day.current_status} />
      <CaretRightIcon size={16} color={palette.textSecondary} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
