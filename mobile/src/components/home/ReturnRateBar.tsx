import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BirdIcon, CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useTodayBirdCounts } from '@/hooks/bird-count/useTodayBirdCounts'
import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { usePalette } from '@/hooks/theme/usePalette'
import { formatDayMonth } from '@/utils/date.utils'
import { formatPercentValue } from '@/utils/number.utils'
import { summarizeReturnRate } from '@/utils/returnRate.utils'
import { t } from '@/utils/i18n.utils'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

const ICON_BOX_SIZE = 40
// Chiều cao thanh khi có số: lề 16×2 + 3 dòng chữ 16, 20, 16 + 2 khoảng 4
const BAR_HEIGHT = 92

interface ReturnRateContent {
  title: string
  value: string
  caption: string
}

// Thanh dài dưới 3 ô: tỷ lệ chim về tổ hôm nay, gộp mọi nhà có camera đếm chim
export function ReturnRateBar() {
  const palette = usePalette()
  const housesQuery = useAllHouses()
  const cameraNodesQuery = useCameraNodes()
  const houseById = new Map(housesQuery.houses.map(house => [house._id, house]))
  // Chỉ nhà có camera mới có số đếm
  const countedHouseIds = [...new Set((cameraNodesQuery.data?.data ?? []).map(camera => camera.house_id))]
  const birdCountsQuery = useTodayBirdCounts(countedHouseIds)

  const isLoading = housesQuery.isLoading || cameraNodesQuery.isLoading || birdCountsQuery.isLoading
  const isError = housesQuery.isError || cameraNodesQuery.isError || birdCountsQuery.isError
  const summary = summarizeReturnRate(
    birdCountsQuery.counts.map(day => ({ houseName: houseById.get(day.house_id)?.name ?? '_', day })),
  )

  // Nội dung theo trạng thái; giờ phiên chiều do backend tính theo lịch của từng nhà nên không ghi giờ cụ thể
  const getContent = (): ReturnRateContent => {
    if (isLoading || isError) return { title: t('Tỷ lệ về tổ'), value: '_', caption: '_' }
    if (countedHouseIds.length === 0) return { title: t('Chưa có dữ liệu đếm'), value: '', caption: t('Thêm camera AI') }
    if (summary.rate === null) {
      return { title: t('Tỷ lệ về tổ'), value: '_', caption: t('Chờ phiên chiều để tính tỷ lệ') }
    }
    const lowestText = summary.lowest
      ? t(' · thấp nhất: {house} {rate}', { house: summary.lowest.houseName, rate: formatPercentValue(summary.lowest.rate, 0) })
      : ''
    return {
      title: t('Tỷ lệ về tổ'),
      value: formatPercentValue(summary.rate),
      caption: `${t('{houses}/{total} nhà đủ dữ liệu', { houses: summary.housesWithData, total: countedHouseIds.length })}${lowestText}`,
    }
  }
  const content = getContent()
  // Ngày theo giờ máy — người dùng ở Việt Nam nên trùng ngày phiên đếm của backend
  const dateText = t('Ngày {date}', { date: formatDayMonth(new Date()) })

  // Một nhà thì vào thẳng nhà đó, nhiều nhà thì mở danh sách nhà kèm tỷ lệ
  const handlePress = () => {
    const singleHouse = countedHouseIds.length === 1 ? houseById.get(countedHouseIds[0]) : undefined
    // shortcut: chưa có màn chi tiết nhà — tạm mở Farm chứa nhà đó
    if (singleHouse) {
      router.push({ pathname: '/farm/[farmId]', params: { farmId: singleHouse.farm_id } })
      return
    }
    // shortcut: chưa có màn danh sách nhà kèm tỷ lệ — tạm mở tab Phân tích
    router.navigate('/(tabs)/analytics')
  }

  if (isLoading) return <Skeleton width="100%" height={BAR_HEIGHT} delayMs={HOME_SKELETON_DELAY_MS.returnRate} />

  return (
    <Card
      style={styles.bar}
      onPress={handlePress}
      accessibilityLabel={`${dateText}, ${content.title} ${content.value}, ${content.caption}`}
    >
      <View style={[styles.iconBox, { backgroundColor: palette.surfaceStrong }]}>
        <BirdIcon size={20} color={palette.text} />
      </View>
      <View style={styles.texts}>
        <Text variant="small" color={palette.textSecondary}>
          {dateText}
        </Text>
        <Text variant="body" weight="semiBold" numberOfLines={1}>
          {content.title}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
          {content.caption}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text variant="heading" weight="semiBold">
          {content.value}
        </Text>
        <CaretRightIcon size={16} color={palette.textSecondary} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
})
