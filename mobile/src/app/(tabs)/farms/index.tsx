import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { BellIcon, GearSixIcon } from 'phosphor-react-native'
import { FarmSummaryStrip } from '@/components/farm/FarmSummaryStrip'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { HOUSE_CARD_HEIGHT, HouseStatusCard } from '@/components/home/HouseStatusCard'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spacing } from '@/constants/theme'
import { useActiveAlertCount } from '@/hooks/alert/useActiveAlertCount'
import { useActiveAlertCountsBySeverity } from '@/hooks/alert/useActiveAlertCountsBySeverity'
import { useAutoOpenLastHouse } from '@/hooks/farm/useAutoOpenLastHouse'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useFarmHouseCards } from '@/hooks/farm/useFarmHouseCards'
import { useFarmSummary } from '@/hooks/farm/useFarmSummary'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useAuthStore } from '@/stores/authStore'
import { useFarmPrefsStore } from '@/stores/farmPrefsStore'
import { farmHasExpert } from '@/utils/farm.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

// Khung xương: 3 thẻ nhà đúng cỡ thẻ thật
const SKELETON_CARD_COUNT = 3
// Cập nhật thời gian "mất kết nối 14 phút", "còn 18 phút" trên thẻ mỗi 30 giây, như Trang chủ
const CLOCK_INTERVAL_MS = 30 * 1000
const SUMMARY_SKELETON_HEIGHT = 72

/** Màn A – nhà yến của farm đang xem (FARM-FR-002, FARM-FR-005, ALERT-FR-007, VISION-FR-008/009) */
export default function FarmsScreen() {
  const palette = usePalette()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()
  const queryClient = useQueryClient()
  const { width: windowWidth } = useWindowDimensions()
  const now = useNow(CLOCK_INTERVAL_MS)
  const { farmId: requestedFarmId } = useLocalSearchParams<{ farmId?: string }>()
  const { userId, prefs } = useFarmPrefs()
  const user = useAuthStore(state => state.user)
  const canCreateFarm = canPerform(user, 'createFarm')
  const canCreateHouse = canPerform(user, 'createHouse')
  const setCurrentFarm = useFarmPrefsStore(state => state.setCurrentFarm)
  const togglePinnedHouse = useFarmPrefsStore(state => state.togglePinnedHouse)
  const farmQuery = useCurrentFarm(requestedFarmId)
  const farm = farmQuery.farm
  const farmId = farm?._id ?? ''
  const housesQuery = useFarmHouseCards(farmId, now)
  const summaryQuery = useFarmSummary(housesQuery.houses.map(house => house._id))
  const severityQuery = useActiveAlertCountsBySeverity(farmId)
  const { data: alertCount } = useActiveAlertCount(farmId)
  const [isFarmSheetOpen, setFarmSheetOpen] = useState(false)
  const [isRefreshing, setRefreshing] = useState(false)

  useAutoOpenLastHouse({
    farmId,
    houses: housesQuery.houses,
    isReady: !housesQuery.isLoading && !housesQuery.isError,
    isFarmRequested: Boolean(requestedFarmId),
  })

  // Farm đang xem thành farm mở mặc định cho lần sau
  useEffect(() => {
    if (userId && farmId) setCurrentFarm(userId, farmId)
  }, [userId, farmId, setCurrentFarm])

  const openHouse = (houseId: string) => router.push({ pathname: '/(tabs)/farms/[houseId]', params: { houseId } })

  const openFarmSettings = () => router.push({ pathname: '/(tabs)/farms/farm-settings', params: { farmId } })
  const openFarmCreate = () => {
    setFarmSheetOpen(false)
    router.push('/(tabs)/farms/farm-create')
  }

  const handleSelectFarm = (selectedFarmId: string) => {
    setFarmSheetOpen(false)
    router.setParams({ farmId: selectedFarmId })
  }

  // Kéo xuống: tải lại mọi khối đang hiện
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.refetchQueries({ type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  const renderBody = () => {
    if (farmQuery.isLoading || (farm && housesQuery.isLoading)) {
      return (
        <>
          <Skeleton width="100%" height={SUMMARY_SKELETON_HEIGHT} />
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            // Thẻ nhà nền lime nên khung xương cũng lime
            <Skeleton
              key={index}
              width="100%"
              height={HOUSE_CARD_HEIGHT}
              color={palette.primary}
              delayMs={(index + 1) * 75}
            />
          ))}
        </>
      )
    }
    if (farmQuery.isError || housesQuery.isError) {
      return (
        <EmptyState
          message={t('Không tải được')}
          actionLabel={t('Thử lại')}
          onAction={() => queryClient.refetchQueries({ type: 'active' })}
        />
      )
    }
    if (!farm) {
      return (
        <EmptyState
          message={t('Bạn chưa có trang trại nào')}
          actionLabel={canCreateFarm ? t('Tạo trang trại') : undefined}
          onAction={canCreateFarm ? openFarmCreate : undefined}
        />
      )
    }
    if (housesQuery.cards.length === 0) {
      return (
        <EmptyState
          message={t('Farm chưa có nhà yến')}
          actionLabel={canCreateHouse ? t('Thêm nhà') : undefined}
          onAction={canCreateHouse ? openFarmSettings : undefined}
        />
      )
    }

    return (
      <>
        <FarmSummaryStrip
          summary={summaryQuery.summary}
          severityCounts={severityQuery.data ?? null}
          hasExpert={farmHasExpert(farm)}
          isDetailLoading={summaryQuery.isLoading}
        />
        {/* Cùng thẻ nhà của carousel Trang chủ; ở đây bấm thì mở Màn B của nhà */}
        {housesQuery.cards.map(card => (
          <HouseStatusCard
            key={card.house._id}
            data={card}
            width={windowWidth - Spacing.lg * 2}
            onPress={() => openHouse(card.house._id)}
            pin={{
              isPinned: prefs.pinnedHouseIds.includes(card.house._id),
              onToggle: () => userId && togglePinnedHouse(userId, card.house._id),
            }}
          />
        ))}
      </>
    )
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        leading={
          <HeaderPicker
            title={farm?.name ?? t('Trang trại')}
            onPress={farmQuery.hasMultipleFarms || canCreateFarm ? () => setFarmSheetOpen(true) : undefined}
            accessibilityLabel={
              farmQuery.hasMultipleFarms || canCreateFarm
                ? t('{farm}, bấm để đổi trang trại', { farm: farm?.name ?? '_' })
                : (farm?.name ?? t('Trang trại'))
            }
          />
        }
        right={
          <View style={styles.headerActions}>
            {/* Tab Cảnh báo của cả farm đang xem */}
            <IconButton
              icon={BellIcon}
              label={t('Cảnh báo đang hiệu lực')}
              badgeCount={alertCount ?? 0}
              onPress={() => router.navigate({ pathname: '/(tabs)/alerts', params: { houseId: '', allHouses: '1' } })}
            />
            {farm && <IconButton icon={GearSixIcon} label={t('Cài đặt trang trại')} onPress={openFarmSettings} />}
          </View>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_OVERLAP + Spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.textSecondary}
            colors={[palette.text]}
          />
        }
      >
        {renderBody()}
      </ScrollView>

      <OptionSheet
        visible={isFarmSheetOpen}
        title={t('Chọn trang trại')}
        options={farmQuery.farms.map(item => ({ id: item._id, label: item.name, caption: item.address || undefined }))}
        selectedId={farmId}
        onSelect={handleSelectFarm}
        onClose={() => setFarmSheetOpen(false)}
        footerAction={canCreateFarm ? { label: t('Tạo trang trại'), onPress: openFarmCreate } : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
})
