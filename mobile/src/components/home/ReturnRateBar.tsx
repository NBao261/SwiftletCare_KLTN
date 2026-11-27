import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BirdIcon, CaretDownIcon, CaretRightIcon, ChartLineIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'
import { Radius, Spacing } from '@/constants/theme'
import { useTodayBirdCounts } from '@/hooks/bird-count/useTodayBirdCounts'
import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useFarms } from '@/hooks/farm/useFarms'
import { usePalette } from '@/hooks/theme/usePalette'
import { useFarmPrefsStore } from '@/stores/farmPrefsStore'
import { formatBirdDayFigures } from '@/utils/camera.utils'
import { formatVietnamDayMonth } from '@/utils/date.utils'
import { formatPercentValue } from '@/utils/number.utils'
import {
  DEFAULT_RETURN_RATE_ORDER,
  getReturnRate,
  pickReturnRateHouse,
  sortHousesByReturnRate,
  type HouseReturnRate,
  type ReturnRateOrder,
} from '@/utils/returnRate.utils'
import { t } from '@/utils/i18n.utils'
import { RETURN_TO_HOME } from '@/utils/navigation.utils'

const ICON_BOX_SIZE = 40
// Chiều cao thanh khi có số: lề 16×2 + 3 dòng chữ 16, 20, 16 + 2 khoảng 4
const BAR_HEIGHT = 92

interface ReturnRateContent {
  title: string
  value: string
  caption: string
}

// Tỷ lệ của một nhà trong bảng chọn nhà: "92,0%", chưa đủ phiên thì "_"
function formatRowRate(row: HouseReturnRate): string {
  const rate = getReturnRate(row)
  return rate === null ? '_' : formatPercentValue(rate)
}

// Chim ra / về hôm nay của một nhà: "Ra 1.000 · Về 920"; chưa đủ phiên thì thêm "Chờ phiên chiều" để biết vì sao chưa có tỷ lệ
function formatRowBirds(row: HouseReturnRate): string {
  const figures = formatBirdDayFigures(row.day ?? undefined)
  const birds = t('Ra {exit} · Về {entry}', { exit: figures.exitText, entry: figures.entryText })
  return getReturnRate(row) === null ? `${birds} · ${t('Chờ phiên chiều')}` : birds
}

// Thanh dài dưới 3 ô: tỷ lệ chim về tổ hôm nay của MỘT nhà có camera đếm chim (số backend tính cho nhà đó, không gộp nhiều
// nhà). Từ 2 nhà trở lên thì bấm thanh mở bảng chọn nhà, có chip "Thấp nhất trước" / "Cao nhất trước" lưu trên máy; nhà hiện
// sẵn là nhà đứng đầu theo cách sắp đó. Một nhà thì bấm vào thẳng tab Đàn chim của nhà đó
export function ReturnRateBar() {
  const palette = usePalette()
  const { userId, prefs } = useFarmPrefs()
  const setHomeReturnRateOrder = useFarmPrefsStore(state => state.setHomeReturnRateOrder)
  const housesQuery = useAllHouses()
  const farmsQuery = useFarms()
  const cameraNodesQuery = useCameraNodes()
  // Nhà người dùng vừa chọn trong bảng; null thì hiện nhà đứng đầu theo cách sắp
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null)
  const [isSheetOpen, setSheetOpen] = useState(false)
  const order = prefs.homeReturnRateOrder ?? DEFAULT_RETURN_RATE_ORDER
  const houseById = new Map(housesQuery.houses.map(house => [house._id, house]))
  // Chỉ nhà có camera mới có số đếm
  const countedHouseIds = [...new Set((cameraNodesQuery.data?.data ?? []).map(camera => camera.house_id))]
  const birdCountsQuery = useTodayBirdCounts(countedHouseIds)
  const dayByHouseId = new Map(birdCountsQuery.counts.map(day => [day.house_id, day]))
  const farms = farmsQuery.data?.data ?? []
  const farmNameById = new Map(farms.map(farm => [farm._id, farm.name]))

  // Mỗi nhà có camera một dòng (camera của nhà không còn trong danh sách nhà thì bỏ), sắp theo cách người dùng đã lưu
  const sortedRows = sortHousesByReturnRate(
    countedHouseIds.flatMap(houseId => {
      const house = houseById.get(houseId)
      return house ? [{ house, day: dayByHouseId.get(houseId) ?? null }] : []
    }),
    order,
  )
  const current = pickReturnRateHouse(sortedRows, selectedHouseId)
  const hasMultipleHouses = sortedRows.length > 1

  const isLoading = housesQuery.isLoading || cameraNodesQuery.isLoading || birdCountsQuery.isLoading
  const isError = housesQuery.isError || cameraNodesQuery.isError || birdCountsQuery.isError

  // Nội dung theo trạng thái; giờ phiên chiều do backend tính theo lịch của từng nhà nên không ghi giờ cụ thể
  const getContent = (): ReturnRateContent => {
    if (isError) return { title: t('Tỷ lệ về tổ'), value: '_', caption: t('Không tải được, kéo xuống để tải lại') }
    if (!current) return { title: t('Chưa có dữ liệu đếm'), value: '', caption: t('Thêm camera AI') }
    const title = t('Tỷ lệ về tổ · {house}', { house: current.house.name })
    const rate = getReturnRate(current)
    if (rate === null) return { title, value: '_', caption: t('Chờ phiên chiều để tính tỷ lệ') }
    const figures = formatBirdDayFigures(current.day ?? undefined)
    return {
      title,
      value: formatPercentValue(rate),
      caption: t('Ra {exit} · Về {entry}', { exit: figures.exitText, entry: figures.entryText }),
    }
  }
  const content = getContent()
  // Ngày theo giờ máy — người dùng ở Việt Nam nên trùng ngày phiên đếm của backend
  const dateText = t('Ngày {date}', { date: formatVietnamDayMonth() })

  // Tab Đàn chim của Phân tích, mở đúng nhà đang hiện
  const openBirdAnalytics = () => {
    if (!current) return
    router.navigate({
      pathname: '/(tabs)/analytics',
      params: { tab: 'birds', houseId: current.house._id, returnTo: RETURN_TO_HOME },
    })
  }

  // Đổi cách sắp: lưu lại và hiện nhà đứng đầu theo cách sắp mới
  const changeOrder = (nextOrder: ReturnRateOrder) => {
    if (userId) setHomeReturnRateOrder(userId, nextOrder)
    setSelectedHouseId(null)
  }

  if (isLoading) return <Skeleton width="100%" height={BAR_HEIGHT} delayMs={HOME_SKELETON_DELAY_MS.returnRate} />

  const TrailingIcon = hasMultipleHouses ? CaretDownIcon : CaretRightIcon

  return (
    <>
      <Card
        style={styles.bar}
        onPress={hasMultipleHouses ? () => setSheetOpen(true) : openBirdAnalytics}
        accessibilityLabel={`${dateText}, ${content.title} ${content.value}, ${content.caption}`}
        accessibilityHint={hasMultipleHouses ? t('Chọn nhà khác hoặc xem phân tích') : undefined}
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
          <TrailingIcon size={16} color={palette.textSecondary} />
        </View>
      </Card>
      <OptionSheet
        visible={isSheetOpen}
        title={t('Chọn nhà yến')}
        header={
          <ChoiceChips<ReturnRateOrder>
            options={[
              { id: 'lowest-first', label: t('Thấp nhất trước') },
              { id: 'highest-first', label: t('Cao nhất trước') },
            ]}
            selectedId={order}
            onSelect={changeOrder}
            placement="card"
            accessibilityLabel={t('Sắp xếp theo tỷ lệ về tổ')}
          />
        }
        options={sortedRows.map(row => ({
          id: row.house._id,
          label: row.house.name,
          // Nhiều trang trại thì ghi tên trang trại trước số chim
          caption:
            farms.length > 1
              ? t('{farm} · {birds}', { farm: farmNameById.get(row.house.farm_id) ?? '_', birds: formatRowBirds(row) })
              : formatRowBirds(row),
          value: formatRowRate(row),
        }))}
        selectedId={current?.house._id}
        // Chọn nhà chỉ đổi nhà trên thanh, bảng vẫn mở: người dùng bấm ra ngoài, kéo xuống hoặc bấm "Xem phân tích" để đóng
        onSelect={setSelectedHouseId}
        onClose={() => setSheetOpen(false)}
        footerAction={
          current
            ? {
                label: t('Xem phân tích {house}', { house: current.house.name }),
                icon: ChartLineIcon,
                onPress: () => {
                  setSheetOpen(false)
                  openBirdAnalytics()
                },
              }
            : undefined
        }
      />
    </>
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
