import { useRef, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
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
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import type { AnalyticsTab } from '@/stores/farmPrefsStore'
import { getVietnamDate } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

// Qua ngày mới thì số đàn chim theo ngày tải lại
const CLOCK_INTERVAL_MS = 60 * 1000
const SKELETON_TILE_COUNT = 4

/** Phân tích – một màn, bộ lọc chung (nhà, tầng, khoảng), 4 ô tổng quan, 5 tab nội bộ: Đàn chim · Môi trường ·
 * Điều khiển · Sản lượng · Báo cáo (ANALYTICS-FR-001…011, EXPERT-FR-005/006, đặc tả "Menu Phân tích") */
export default function AnalyticsScreen() {
  const palette = usePalette()
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
  const [isRefreshing, setRefreshing] = useState(false)
  const house = scope.house

  const openTab = (tab: AnalyticsTab) => {
    scope.selectTab(tab)
    scrollRef.current?.scrollTo({ y: tabsY.current, animated: true })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.refetchQueries({ type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  const renderTabContent = () => {
    if (scope.tab === 'birds') return <BirdTab scope={scope} today={today} />
    if (scope.zones.length === 0) return <EmptyState message={t('Nhà chưa có tầng')} />
    if (scope.tab === 'env') return <EnvironmentTab scope={scope} />
    if (scope.tab === 'control') return <ControlTab scope={scope} />
    if (scope.tab === 'harvest') return <HarvestTab scope={scope} today={today} />
    return <ReportTab scope={scope} />
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
            onAction={() => queryClient.refetchQueries({ type: 'active' })}
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
              router.navigate({ pathname: '/(tabs)/alerts', params: { houseId: house?._id ?? '' } })
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

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      {/* Cùng kiểu header chọn nhà của màn Farm: tên nhà ▾, bấm để đổi nhà */}
      <AppHeader
        leading={
          <HeaderPicker
            title={house?.name ?? t('Phân tích')}
            onPress={scope.houses.length > 1 ? () => setHouseSheetOpen(true) : undefined}
            accessibilityLabel={
              house && scope.houses.length > 1
                ? t('{house}, bấm để đổi nhà', { house: house.name })
                : (house?.name ?? t('Phân tích'))
            }
          />
        }
      />
      {renderBody()}
      <OptionSheet
        visible={isHouseSheetOpen}
        title={t('Chọn nhà yến')}
        options={scope.houses.map(item => ({ id: item._id, label: item.name }))}
        selectedId={house?._id}
        onSelect={houseId => {
          setHouseSheetOpen(false)
          scope.selectHouse(houseId)
        }}
        onClose={() => setHouseSheetOpen(false)}
      />
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
