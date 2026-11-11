import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { refetchVisibleQueries } from '@/config/queryClient'
import { GearSixIcon } from 'phosphor-react-native'
import { BellButton } from '@/components/common/BellButton'
import { FarmSummaryStrip } from '@/components/farm/FarmSummaryStrip'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { FarmBannerCard } from '@/components/home/FarmBannerCard'
import { HOUSE_CARD_HEIGHT, HouseStatusCard } from '@/components/home/HouseStatusCard'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spacing } from '@/constants/theme'
import { useActiveAlertCountsBySeverity } from '@/hooks/alert/useActiveAlertCountsBySeverity'
import { useAutoOpenLastHouse } from '@/hooks/farm/useAutoOpenLastHouse'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useFarmHouseCards } from '@/hooks/farm/useFarmHouseCards'
import { useFarmSummary } from '@/hooks/farm/useFarmSummary'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useReturnBack } from '@/hooks/navigation/useReturnBack'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useAuthStore } from '@/stores/authStore'
import { useFarmPrefsStore } from '@/stores/farmPrefsStore'
import { farmHasExpert } from '@/utils/farm.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'
import { RETURN_TO_FARMS } from '@/utils/navigation.utils'

// Khung xương: 3 thẻ nhà đúng cỡ thẻ thật
const SKELETON_CARD_COUNT = 3
// Cập nhật thời gian "mất kết nối 14 phút", "còn 18 phút" trên thẻ mỗi 30 giây, như Trang chủ
const CLOCK_INTERVAL_MS = 30 * 1000
const SUMMARY_SKELETON_HEIGHT = 72
// Giá trị "Tất cả trang trại" trong bảng chọn farm
const ALL_FARMS = '__all__'

/** Màn A – "Tất cả trang trại" (thẻ từng farm, chạm để vào) hoặc nhà yến của một farm (FARM-FR-002, FARM-FR-005,
 * ALERT-FR-007, VISION-FR-008/009). Thuộc từ 2 farm thì mặc định là tất cả, rồi mới vào nhà của từng farm */
export default function FarmsScreen() {
  const palette = usePalette()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()
  const queryClient = useQueryClient()
  const { width: windowWidth } = useWindowDimensions()
  const now = useNow(CLOCK_INTERVAL_MS)
  const { farmId: requestedFarmId } = useLocalSearchParams<{ farmId?: string }>()
  // Mở từ lối tắt ở Trang chủ thì có nút ‹ quay về, và hiện danh sách thay vì tự mở nhà xem gần nhất
  const returnBack = useReturnBack()
  const { userId, prefs } = useFarmPrefs()
  const user = useAuthStore(state => state.user)
  const canCreateFarm = canPerform(user, 'createFarm')
  const canCreateHouse = canPerform(user, 'createHouse')
  // Kỹ thuật viên chỉ thấy nhà được giao (AUTH-FR-013): danh sách trống là chưa được giao, không phải farm chưa có nhà
  const isAssignedHousesOnly = canPerform(user, 'limitedToAssignedHouses')
  const setCurrentFarm = useFarmPrefsStore(state => state.setCurrentFarm)
  const setAllFarmsView = useFarmPrefsStore(state => state.setAllFarmsView)
  const togglePinnedHouse = useFarmPrefsStore(state => state.togglePinnedHouse)
  const farmQuery = useCurrentFarm(requestedFarmId)
  // Farm truyền qua link thắng; không thì theo lựa chọn đã nhớ, chưa chọn lần nào thì tất cả (chỉ khi từ 2 farm)
  const isAllFarms = farmQuery.hasMultipleFarms && !requestedFarmId && (prefs.isAllFarmsView ?? true)
  const farm = isAllFarms ? null : farmQuery.farm
  const farmId = farm?._id ?? ''
  const housesQuery = useFarmHouseCards(farmId, now)
  const summaryQuery = useFarmSummary(housesQuery.houses.map(house => house._id))
  const severityQuery = useActiveAlertCountsBySeverity(farmId)
  const [isFarmSheetOpen, setFarmSheetOpen] = useState(false)
  const [isRefreshing, setRefreshing] = useState(false)

  useAutoOpenLastHouse({
    farmId,
    houses: housesQuery.houses,
    isReady: !housesQuery.isLoading && !housesQuery.isError,
    isFarmRequested: Boolean(requestedFarmId) || returnBack !== undefined,
  })

  // Farm đang xem thành farm mở mặc định cho lần sau; mở một farm qua link (thẻ farm, Trang chủ) là rời "Tất cả"
  useEffect(() => {
    if (userId && farmId) setCurrentFarm(userId, farmId)
  }, [userId, farmId, setCurrentFarm])
  useEffect(() => {
    if (userId && requestedFarmId) setAllFarmsView(userId, false)
  }, [userId, requestedFarmId, setAllFarmsView])

  const openHouse = (houseId: string) => router.push({ pathname: '/(tabs)/farms/[houseId]', params: { houseId } })

  const openFarmSettings = () => router.push({ pathname: '/(tabs)/farms/farm-settings', params: { farmId } })
  const openFarmCreate = () => {
    setFarmSheetOpen(false)
    router.push('/(tabs)/farms/farm-create')
  }

  const handleSelectFarm = (selectedFarmId: string) => {
    setFarmSheetOpen(false)
    if (selectedFarmId === ALL_FARMS) {
      if (userId) setAllFarmsView(userId, true)
      router.setParams({ farmId: '' })
      return
    }
    router.setParams({ farmId: selectedFarmId })
  }
  // Nút ‹ khi đang ở một farm (thuộc từ 2 farm): về "Tất cả trang trại"
  const showAllFarms = () => handleSelectFarm(ALL_FARMS)

  // Kéo xuống: tải lại mọi khối đang hiện
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetchVisibleQueries(queryClient)
    } finally {
      setRefreshing(false)
    }
  }

  const renderBody = () => {
    if (isAllFarms) {
      // Cùng thẻ farm của carousel Trang chủ; chạm thẻ hoặc nút mũi tên để vào danh sách nhà của farm đó
      return farmQuery.farms.map(item => (
        <FarmBannerCard key={item._id} farm={item} width={windowWidth - Spacing.lg * 2} />
      ))
    }
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
          onAction={() => refetchVisibleQueries(queryClient)}
        />
      )
    }
    if (!farm) {
      return (
        <EmptyState
          message={isAssignedHousesOnly ? t('Bạn chưa thuộc trang trại nào. Hãy nhờ chủ trại mời bạn') : t('Bạn chưa có trang trại nào')}
          actionLabel={canCreateFarm ? t('Tạo trang trại') : undefined}
          onAction={canCreateFarm ? openFarmCreate : undefined}
        />
      )
    }
    if (housesQuery.cards.length === 0) {
      return (
        <EmptyState
          message={isAssignedHousesOnly ? t('Bạn chưa được giao nhà nào. Hãy nhờ chủ trại giao nhà cho bạn') : t('Farm chưa có nhà yến')}
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
          // Chưa có chuyên gia: mở Thành viên của đúng farm này để mời, ‹ quay về danh sách nhà
          onInviteExpert={
            canPerform(user, 'viewFarmMembers')
              ? () =>
                  router.push({ pathname: '/(tabs)/profile/members', params: { farmId, returnTo: RETURN_TO_FARMS } })
              : undefined
          }
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

  const headerTitle = isAllFarms ? t('Tất cả trang trại') : (farm?.name ?? t('Trang trại'))

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        onBack={returnBack ?? (farmQuery.hasMultipleFarms && !isAllFarms ? showAllFarms : undefined)}
        leading={
          <HeaderPicker
            title={headerTitle}
            onPress={farmQuery.hasMultipleFarms || canCreateFarm ? () => setFarmSheetOpen(true) : undefined}
            accessibilityLabel={
              farmQuery.hasMultipleFarms || canCreateFarm
                ? t('{farm}, bấm để đổi trang trại', { farm: headerTitle })
                : headerTitle
            }
          />
        }
        right={
          <View style={styles.headerActions}>
            <BellButton />
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
        options={[
          // "Tất cả trang trại" chỉ có khi thuộc từ 2 farm
          ...(farmQuery.hasMultipleFarms
            ? [{ id: ALL_FARMS, label: t('Tất cả trang trại'), caption: t('{count} trang trại', { count: farmQuery.farms.length }) }]
            : []),
          ...farmQuery.farms.map(item => ({ id: item._id, label: item.name, caption: item.address || undefined })),
        ]}
        selectedId={isAllFarms ? ALL_FARMS : farmId}
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
