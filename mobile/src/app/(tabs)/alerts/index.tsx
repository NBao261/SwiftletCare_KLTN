import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useIsFocused } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircleIcon, GearSixIcon } from 'phosphor-react-native'
import { AcknowledgeSheet } from '@/components/alert/AcknowledgeSheet'
import { AlertDetailSheet } from '@/components/alert/AlertDetailSheet'
import { AlertFilterChips } from '@/components/alert/AlertFilterChips'
import { ALERT_ROW_HEIGHT, AlertRow } from '@/components/alert/AlertRow'
import { NotificationSettingsSheet } from '@/components/alert/NotificationSettingsSheet'
import { SeveritySummary } from '@/components/alert/SeveritySummary'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { useAlertLocations } from '@/hooks/alert/useAlertLocations'
import { useAlertRooms } from '@/hooks/alert/useAlertRooms'
import { useAlertsListData } from '@/hooks/alert/useAlertsListData'
import { useAlertsScope } from '@/hooks/alert/useAlertsScope'
import { useLinkedAlert } from '@/hooks/alert/useLinkedAlert'
import { useNewAlertIds } from '@/hooks/alert/useNewAlertIds'
import { useRefetchInvalidatedAlertLists } from '@/hooks/alert/useRefetchInvalidatedAlertLists'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useReturnBack } from '@/hooks/navigation/useReturnBack'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import type { Alert } from '@/types'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

// Đồng hồ cho "3 phút trước" và đếm ngược nhắc lại
const CLOCK_INTERVAL_MS = 30 * 1000
const SKELETON_ROW_COUNT = 5
const ROW_GAP = Spacing.sm
// Giá trị "Tất cả" trong bảng chọn farm, nhà
const ALL = '__all__'

/** Cảnh báo – một danh sách, một lớp chi tiết (ALERT-FR-007…009, 013…015, EXPERT-FR-003; đặc tả "Trang Cảnh báo"):
 * dải tóm tắt theo mức là bộ lọc nhanh, đang hiệu lực / đã đóng, lọc tầng, loại, phán quyết, vuốt để xác nhận */
export default function AlertsScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const queryClient = useQueryClient()
  const now = useNow(CLOCK_INTERVAL_MS)
  const user = useAuthStore(state => state.user)
  const toast = useToastMessage()
  const scope = useAlertsScope()
  const { locate } = useAlertLocations()
  const isResolved = scope.segment === 'resolved'
  // Tab vẫn sống khi chuyển tab khác: chỉ tải lại định kỳ khi đang hiện
  const isFocused = useIsFocused()
  // Mở từ lối tắt (Trang chủ, màn nhà, Phân tích…) thì có nút ‹ quay về
  const returnBack = useReturnBack()
  const list = useAlertsListData(scope, isFocused)
  const newAlertIds = useNewAlertIds()
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null)
  const [acknowledgeTarget, setAcknowledgeTarget] = useState<Alert | null>(null)
  const [sheetKey, setSheetKey] = useState(0)
  const [isHouseSheetOpen, setHouseSheetOpen] = useState(false)
  const [isFarmSheetOpen, setFarmSheetOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isRefreshing, setRefreshing] = useState(false)
  const canAcknowledge = canPerform(user, 'acknowledgeAlert')
  const canEditSettings = canPerform(user, 'editNotificationSettings')
  const zoneIds = scope.zones.map(zone => zone._id)

  useAlertRooms(scope.house?._id ?? null, zoneIds)


  // Cảnh báo mới / xác nhận / phán quyết chỉ đánh dấu danh sách cũ (invalidateAlertQueries): tab đang hiện thì tải lại ngay
  useRefetchInvalidatedAlertLists(isFocused)
  const hasFilter = Boolean(scope.zoneId || scope.type || scope.verdict || scope.severity)
  // Phạm vi trên header: nhà › farm › tất cả. Đang xem mọi farm thì hàng cảnh báo ghi thêm tên farm
  const scopeTitle = scope.house?.name ?? (scope.farmId === null ? t('Tất cả trang trại') : t('Tất cả nhà'))
  const isAllFarms = scope.farmId === null
  const getLocationText = (alert: Alert) => {
    const location = locate(alert)
    return isAllFarms && location.farmName ? `${location.farmName} › ${location.text}` : location.text
  }
  // Header: đang ở một farm thì mở bảng nhà (có "Đổi trang trại"); đang ở mọi farm thì mở bảng farm
  const openScopePicker = () => (isAllFarms ? setFarmSheetOpen(true) : setHouseSheetOpen(true))

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        scope.isFarmsError ? scope.retryFarms() : null,
        queryClient.refetchQueries({ queryKey: ['alerts'], type: 'active' }),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  // Hàm cố định cho mọi hàng để AlertRow (memo) không vẽ lại khi danh sách vẽ lại
  const openAcknowledge = useCallback((alert: Alert) => {
    setSheetKey(key => key + 1)
    setAcknowledgeTarget(alert)
  }, [])
  const openDetail = useCallback((alert: Alert) => setDetailAlert(alert), [])
  // Mở từ chuông / thông báo với alertId: mở thẳng sheet chi tiết của đúng cảnh báo đó
  const showToast = toast.show
  const handleLinkedAlertMissing = useCallback(() => showToast(t('Không mở được cảnh báo này')), [showToast])
  useLinkedAlert(openDetail, handleLinkedAlertMissing)

  const renderEmpty = () => {
    if (list.isListLoading) {
      return (
        <View style={styles.list}>
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
            <Skeleton key={index} width="100%" height={ALERT_ROW_HEIGHT} delayMs={index * 75} />
          ))}
        </View>
      )
    }
    if (list.isListError) {
      return (
        <EmptyState
          message={t('Không tải được cảnh báo')}
          actionLabel={t('Thử lại')}
          onAction={list.retryList}
        />
      )
    }
    if (hasFilter) {
      return (
        <EmptyState
          message={t('Không có cảnh báo khớp bộ lọc')}
          actionLabel={t('Xoá lọc')}
          onAction={scope.clearFilters}
        />
      )
    }
    if (isResolved) return <EmptyState message={t('Chưa có cảnh báo nào đã đóng')} />
    return (
      <View style={[styles.allClear, { backgroundColor: palette.surface }]}>
        <CheckCircleIcon size={32} color={palette.houseHealthy} weight="fill" />
        <Text variant="body" weight="semiBold" center>
          {t('Mọi thứ đang ổn. Không có cảnh báo nào.')}
        </Text>
        <Button label={t('Xem đã đóng')} variant="link" onPress={() => scope.selectSegment('resolved')} />
      </View>
    )
  }

  const header = (
    <View style={styles.header}>
      <SeveritySummary
        counts={list.counts}
        selected={scope.severity}
        onToggle={scope.toggleSeverity}
        // Không tải được số thì dải vẫn hiện "_" và vẫn lọc được, không quay khung xương mãi
        isLoading={list.isListLoading || (list.counts === null && !list.isCountsError && !scope.isFarmsError)}
      />
      <ChoiceChips
        options={[
          { id: 'active', label: t('Đang hiệu lực ({count})', { count: list.activeTotal ?? '_' }) },
          { id: 'resolved', label: t('Đã đóng') },
        ]}
        selectedId={scope.segment}
        onSelect={scope.selectSegment}
        accessibilityLabel={t('Trạng thái cảnh báo')}
      />
      <AlertFilterChips scope={scope} />
    </View>
  )

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View key={language} style={styles.screen}>
        <AppHeader
          onBack={returnBack}
          leading={
            <HeaderPicker
              title={scopeTitle}
              onPress={openScopePicker}
              accessibilityLabel={t('{scope}, bấm để đổi phạm vi', { scope: scopeTitle })}
            />
          }
          right={
            canEditSettings ? (
              <IconButton icon={GearSixIcon} label={t('Cài đặt thông báo')} onPress={() => setSettingsOpen(true)} />
            ) : undefined
          }
        />
        <FlatList
          data={list.alerts}
          keyExtractor={alert => alert._id}
          renderItem={({ item }) => (
            <AlertRow
              alert={item}
              locationText={getLocationText(item)}
              now={now}
              isNew={newAlertIds.has(item._id)}
              onPress={openDetail}
              onAcknowledge={canAcknowledge ? openAcknowledge : undefined}
            />
          )}
          getItemLayout={(_data, index) => ({
            length: ALERT_ROW_HEIGHT + ROW_GAP,
            offset: (ALERT_ROW_HEIGHT + ROW_GAP) * index,
            index,
          })}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={header}
          ListEmptyComponent={renderEmpty()}
          // Phân trang ở server: cuộn gần cuối hoặc bấm "Xem thêm" thì tải trang kế (có thể sang trạng thái/mức kế tiếp)
          ListFooterComponent={
            list.hasNextPage ? (
              <Button
                label={t('Xem thêm')}
                variant="link"
                loading={list.isFetchingNextPage}
                onPress={list.fetchNextPage}
              />
            ) : undefined
          }
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage()
          }}
          onEndReachedThreshold={0.5}
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
        />

        <OptionSheet
          visible={isHouseSheetOpen}
          title={t('Chọn nhà yến')}
          options={[
            { id: ALL, label: t('Tất cả nhà'), caption: scope.farm?.name },
            ...scope.houses.map(house => ({ id: house._id, label: house.name })),
          ]}
          selectedId={scope.house?._id ?? ALL}
          onSelect={id => {
            setHouseSheetOpen(false)
            scope.selectHouse(id === ALL ? null : id)
          }}
          onClose={() => setHouseSheetOpen(false)}
          footerAction={
            scope.hasMultipleFarms
              ? {
                  label: t('Đổi trang trại'),
                  onPress: () => {
                    setHouseSheetOpen(false)
                    setFarmSheetOpen(true)
                  },
                }
              : undefined
          }
        />
        <OptionSheet
          visible={isFarmSheetOpen}
          title={t('Chọn trang trại')}
          options={[
            { id: ALL, label: t('Tất cả trang trại'), caption: t('{count} trang trại', { count: scope.farms.length }) },
            ...scope.farms.map(farm => ({ id: farm._id, label: farm.name, caption: farm.address || undefined })),
          ]}
          selectedId={scope.farmId ?? ALL}
          onSelect={id => {
            setFarmSheetOpen(false)
            if (id === ALL) {
              scope.selectFarm(null)
              return
            }
            // Chọn một farm thì mở tiếp bảng nhà của farm đó; đóng bảng là xem mọi nhà của farm
            scope.selectFarm(id)
            setHouseSheetOpen(true)
          }}
          onClose={() => setFarmSheetOpen(false)}
        />
        <AcknowledgeSheet
          key={sheetKey}
          alert={acknowledgeTarget}
          onClose={() => setAcknowledgeTarget(null)}
          onDone={message => {
            setAcknowledgeTarget(null)
            toast.show(message)
          }}
        />
        <AlertDetailSheet alert={detailAlert} onClose={() => setDetailAlert(null)} />
        {canEditSettings && (
          <NotificationSettingsSheet
            key={isSettingsOpen ? 'open' : 'closed'}
            visible={isSettingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </View>
      {toast.message && <Toast message={toast.message} bottomOffset={TAB_BAR_OVERLAP + Spacing.lg} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  header: { gap: Spacing.md, marginBottom: Spacing.md },
  list: { gap: ROW_GAP },
  separator: { height: ROW_GAP },
  flex: { flex: 1 },
  allClear: { alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.xl },
})
