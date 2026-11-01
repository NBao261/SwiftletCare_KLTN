import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { CaretRightIcon, PackageIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Spacing } from '@/constants/theme'
import { useFarmHarvests } from '@/hooks/harvest/useFarmHarvests'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { formatVietnamDayMonth, getVietnamDate } from '@/utils/date.utils'
import { summarizeHouseMonthYield } from '@/utils/harvest.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

// Như web: số kg hiện 2 chữ số lẻ (KILOGRAM_DIGITS)
const KILOGRAM_DIGITS = 2
// Cao bằng ô thật: lề 12×2 + dòng tiêu đề 20 + khoảng 4 + dòng phụ 16
const ROW_HEIGHT = 64
// Sang tháng mới thì ô tự đổi tháng; kiểm mỗi phút là đủ
const CLOCK_INTERVAL_MS = 60 * 1000

interface HouseYieldRowProps {
  farmId: string
  // Nhà đang xem: chạm ô thì mở tab Sản lượng của nhà này
  houseId: string
  // Các zone của nhà: đợt thu gắn zone nên cộng theo zone
  zoneIds: string[]
}

// Ô ngang dưới dải chim ra / chim về: sản lượng tháng này của nhà (HARVEST-FR-001, SF-04), cách tính như web
export function HouseYieldRow({ farmId, houseId, zoneIds }: HouseYieldRowProps) {
  const palette = usePalette()
  const harvestsQuery = useFarmHarvests(farmId)
  const now = useNow(CLOCK_INTERVAL_MS)
  const month = Number(getVietnamDate(now).slice(5, 7))
  const title = t('Sản lượng tháng {month}', { month })

  if (harvestsQuery.isLoading) return <Skeleton width="100%" height={ROW_HEIGHT} />
  if (harvestsQuery.isError) {
    return (
      <Card style={styles.row} accessibilityLabel={t('Không tải được')}>
        <PackageIcon size={20} color={palette.text} />
        <Text variant="body" color={palette.textSecondary} style={styles.texts}>
          {t('Không tải được')}
        </Text>
        <Button variant="link" label={t('Thử lại')} onPress={() => harvestsQuery.refetch()} />
      </Card>
    )
  }

  const monthYield = summarizeHouseMonthYield(harvestsQuery.data?.data ?? [], zoneIds, now)
  const valueText = monthYield ? `${formatDecimal(monthYield.kg, KILOGRAM_DIGITS)} kg` : '_'
  const detailText = monthYield
    ? [
        t('{n} tổ · {batches} đợt thu', { n: formatDecimal(monthYield.nests), batches: monthYield.batches }),
        t('gần nhất {date}', { date: formatVietnamDayMonth(Date.parse(monthYield.lastHarvestAt)) }),
      ].join(' · ')
    : t('Chưa có đợt thu nào trong tháng')

  return (
    // Mở tab Sản lượng của Phân tích, đúng nhà này (ghi và sửa đợt thu vẫn là bước thu hoạch của G-16)
    <Card
      style={styles.row}
      onPress={() => router.navigate({ pathname: '/(tabs)/analytics', params: { houseId, tab: 'harvest' } })}
      accessibilityLabel={`${title}: ${valueText}, ${detailText}`}
      accessibilityHint={t('Mở thống kê thu hoạch')}
    >
      <PackageIcon size={20} color={palette.text} />
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
          {detailText}
        </Text>
      </View>
      <Text variant="heading" weight="bold">
        {valueText}
      </Text>
      <CaretRightIcon size={16} color={palette.textSecondary} />
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
