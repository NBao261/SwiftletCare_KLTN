import { useRef, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'
import { router } from 'expo-router'
import { CaretLeftIcon } from 'phosphor-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { refetchVisibleQueries } from '@/config/queryClient'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { AnalyticsRangeChips } from '@/components/analytics/AnalyticsRangeChips'
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs'
import { BirdTab } from '@/components/analytics/BirdTab'
import { ControlTab } from '@/components/analytics/ControlTab'
import { EnvironmentTab } from '@/components/analytics/EnvironmentTab'
import { HarvestTab } from '@/components/analytics/HarvestTab'
import { KpiGrid } from '@/components/analytics/KpiGrid'
import { KPI_TILE_HEIGHT } from '@/components/analytics/KpiTile'
import { ReportTab } from '@/components/analytics/ReportTab'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Radius, Spacing } from '@/constants/theme'
import { useAnalyticsKpis } from '@/hooks/analytics/useAnalyticsKpis'
import { useAnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useReturnBack } from '@/hooks/navigation/useReturnBack'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import type { AnalyticsTab } from '@/stores/farmPrefsStore'
import { getVietnamDate } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'
import { RETURN_TO_ANALYTICS } from '@/utils/navigation.utils'

// Qua ngày mới thì số đàn chim theo ngày tải lại
const CLOCK_INTERVAL_MS = 60 * 1000
const SKELETON_TILE_COUNT = 4

/** Phân tích – một màn, bộ lọc chung (nhà, tầng, khoảng), 4 ô tổng quan, 5 tab nội bộ: Đàn chim · Môi trường ·
 * Điều khiển · Sản lượng · Báo cáo (ANALYTICS-FR-001…011, EXPERT-FR-005/006, đặc tả "Menu Phân tích") */
export default function AnalyticsScreen() {
  const palette = usePalette()
  // Mở từ lối tắt (Trang chủ, màn nhà, Tài khoản…) thì có nút ‹ quay về
  const returnBack = useReturnBack()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()
  const queryClient = useQueryClient()
  const now = useNow(CLOCK_INTERVAL_MS)
  const today = getVietnamDate(now)
  const scope = useAnalyticsScope()
  const kpis = useAnalyticsKpis(scope, today)
  const scrollRef = useRef<ScrollViewInstance>(null)
  // Vị trí hàng tab trong vùng cuộn: chạm ô KPI thì cuộn tới đó
  const tabsY = useRef(0)
  const [isHouseSheetOpen, setHouseSheetOpen] = useState(false)
  // Sheet chọn 2 bước như tab Trang trại: null = bước chọn trang trại, có id = bước chọn nhà của farm đó
  const [sheetFarmId, setSheetFarmId] = useState<string | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)
  const house = scope.house

  const openTab = (tab: AnalyticsTab) => {
    scope.selectTab(tab)
    scrollRef.current?.scrollTo({ y: tabsY.current, animated: true })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetchVisibleQueries(queryClient)
    } finally {
      setRefreshing(false)
    }
  }

  const renderTabContent = () => {
    if (scope.tab === 'birds') return <BirdTab scope={scope} today={today} />
    // Báo cáo theo nhà (EXPERT-FR-005) không cần Zone; key theo báo cáo được mở để loại kỳ và báo cáo mở đặt lại khi mở báo cáo khác
    if (scope.tab === 'reports') return <ReportTab key={scope.reportId ?? 'reports'} scope={scope} />
    if (scope.zones.length === 0) return <EmptyState message={t('Nhà chưa có khu vực')} />
    if (scope.tab === 'env') return <EnvironmentTab scope={scope} />
    if (scope.tab === 'control') return <ControlTab scope={scope} />
    return <HarvestTab scope={scope} today={today} />
  }

  const renderBody = () => {
    if (scope.isLoading) {
      return (
        <View style={styles.content}>
          {Array.from({ length: SKELETON_TILE_COUNT }, (_, index) => (
            <Skeleton key={index} width="100%" height={KPI_TILE_HEIGHT} radius={Radius.md} delayMs={index * 75} />
          ))}
        </View>
      )
    }
    if (scope.isError) {
      return (
        <View style={styles.content}>
          <EmptyState
            message={t('Không tải được')}
            actionLabel={t('Thử lại')}
            onAction={() => refetchVisibleQueries(queryClient)}
          />
        </View>
      )
    }
    if (!scope.farm) {
      return (
        <View style={styles.content}>
          <EmptyState message={t('Bạn chưa có trang trại nào')} />
        </View>
      )
    }
    if (!house) {
      return (
        <View style={styles.content}>
          <EmptyState message={t('Farm chưa có nhà yến')} />
        </View>
      )
    }

    return (
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        // Hàng tab nội bộ (phần tử thứ 3) dính đầu màn khi cuộn
        stickyHeaderIndices={[2]}
        contentContainerStyle={{ paddingBottom: TAB_BAR_OVERLAP + Spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.textSecondary}
            colors={[palette.text]}
          />
        }
      >
        {/* Luôn giữ phần tử này (kể cả nhà một tầng) để hàng tab vẫn là phần tử thứ 3 dính đầu màn */}
        <View style={scope.zones.length > 1 ? styles.section : undefined}>
          <AnalyticsFilterBar scope={scope} />
        </View>
        <View style={styles.section}>
          <KpiGrid
            kpis={kpis}
            isAllZones={scope.selectedZoneId === null}
            onSelectTab={openTab}
            // Tab Cảnh báo lọc sẵn nhà đang xem
            onOpenAlerts={() =>
              router.navigate({
                pathname: '/(tabs)/alerts',
                params: { houseId: house?._id ?? '', returnTo: RETURN_TO_ANALYTICS },
              })
            }
          />
        </View>
        <View
          onLayout={event => {
            tabsY.current = event.nativeEvent.layout.y
          }}
        >
          <AnalyticsTabs selected={scope.tab} onSelect={scope.selectTab} />
          <View style={[styles.rangeRow, { backgroundColor: palette.background }]}>
            <AnalyticsRangeChips scope={scope} />
          </View>
        </View>
        <View style={styles.section}>{renderTabContent()}</View>
      </ScrollView>
    )
  }

  // Số nhà của từng farm cho bước chọn trang trại; nhà của farm đang chọn ở bước chọn nhà (đã xếp nhà ghim lên đầu)
  const houseCountByFarmId = new Map<string, number>()
  for (const choice of scope.houseChoices) {
    houseCountByFarmId.set(choice.house.farm_id, (houseCountByFarmId.get(choice.house.farm_id) ?? 0) + 1)
  }
  const sheetHouseChoices = scope.houseChoices.filter(choice => choice.house.farm_id === sheetFarmId)
  const sheetFarmName = sheetHouseChoices[0]?.farmName ?? ''

  // Mở sheet: thuộc từ 2 farm thì bắt đầu ở bước chọn trang trại, 1 farm thì vào thẳng bước chọn nhà
  const openHouseSheet = () => {
    setSheetFarmId(scope.hasMultipleFarms ? null : (scope.farm?._id ?? null))
    setHouseSheetOpen(true)
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      {/* Cùng kiểu header của màn Farm: tên nhà ▾ (thuộc từ 2 farm thì kèm tên farm); bấm thì chọn trang trại trước rồi tới nhà */}
      <AppHeader
        onBack={returnBack}
        leading={
          <HeaderPicker
            title={house ? (scope.hasMultipleFarms && scope.farm ? `${scope.farm.name} · ${house.name}` : house.name) : t('Phân tích')}
            onPress={scope.houseChoices.length > 1 ? openHouseSheet : undefined}
            accessibilityLabel={
              house && scope.houseChoices.length > 1
                ? t('{house}, bấm để đổi nhà', { house: house.name })
                : (house?.name ?? t('Phân tích'))
            }
          />
        }
      />
      {renderBody()}
      {sheetFarmId === null ? (
        <OptionSheet
          visible={isHouseSheetOpen}
          title={t('Chọn trang trại')}
          // Farm chưa có nhà thì không có gì để chọn ở bước sau nên không liệt kê
          options={scope.farms
            .filter(item => houseCountByFarmId.has(item._id))
            .map(item => ({
              id: item._id,
              label: item.name,
              caption: t('{count} nhà yến', { count: houseCountByFarmId.get(item._id) ?? 0 }),
            }))}
          selectedId={scope.farm?._id}
          onSelect={setSheetFarmId}
          onClose={() => setHouseSheetOpen(false)}
        />
      ) : (
        <OptionSheet
          visible={isHouseSheetOpen}
          title={scope.hasMultipleFarms ? t('Chọn nhà yến · {farm}', { farm: sheetFarmName }) : t('Chọn nhà yến')}
          options={sheetHouseChoices.map(choice => ({
            id: choice.house._id,
            label: choice.house.name,
            // Nhà ghim lên đầu như tab Trang trại, ghi "Đã ghim"
            caption: choice.isPinned ? t('Đã ghim') : undefined,
          }))}
          selectedId={house?._id}
          onSelect={houseId => {
            setHouseSheetOpen(false)
            scope.selectHouse(houseId)
          }}
          onClose={() => setHouseSheetOpen(false)}
          footerAction={
            scope.hasMultipleFarms
              ? { label: t('Đổi trang trại'), icon: CaretLeftIcon, onPress: () => setSheetFarmId(null) }
              : undefined
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  section: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  // Chip khoảng thời gian dưới hàng tab, cùng lề với hàng tab
  rangeRow: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
})
