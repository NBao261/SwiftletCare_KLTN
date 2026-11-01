import { useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircleIcon, GearSixIcon, WifiSlashIcon } from 'phosphor-react-native'
import { AcknowledgeSheet } from '@/components/alert/AcknowledgeSheet'
import { AlertDetailSheet } from '@/components/alert/AlertDetailSheet'
import { AlertFilterChips } from '@/components/alert/AlertFilterChips'
import { ALERT_ROW_HEIGHT, AlertRow } from '@/components/alert/AlertRow'
import { NotificationSettingsSheet } from '@/components/alert/NotificationSettingsSheet'
import { SeveritySummary } from '@/components/alert/SeveritySummary'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
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
import { useActiveAlertList } from '@/hooks/alert/useActiveAlertList'
import { useAlertLocations } from '@/hooks/alert/useAlertLocations'
import { useAlertRooms } from '@/hooks/alert/useAlertRooms'
import { useAlertsScope } from '@/hooks/alert/useAlertsScope'
import { useNewAlertIds } from '@/hooks/alert/useNewAlertIds'
import { useResolvedAlertList } from '@/hooks/alert/useResolvedAlertList'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useSocketConnection } from '@/hooks/telemetry/useSocketConnection'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import type { Alert } from '@/types'
import { countBySeverity, filterAlerts, sortAlerts } from '@/utils/alertList.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

// Đồng hồ cho "3 phút trước" và đếm ngược nhắc lại
const CLOCK_INTERVAL_MS = 30 * 1000
const SKELETON_ROW_COUNT = 5
const ROW_GAP = Spacing.sm
// Giá trị "Tất cả nhà" trong bảng chọn nhà
const ALL_HOUSES = '__all__'

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
  const farmId = scope.farm?._id ?? ''
  const isResolved = scope.segment === 'resolved'
  const activeQuery = useActiveAlertList(farmId)
  const resolvedQuery = useResolvedAlertList(farmId, isResolved)
  const newAlertIds = useNewAlertIds()
  const isSocketConnected = useSocketConnection()
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

  const source = isResolved ? (resolvedQuery.data?.pages.flatMap(page => page.data) ?? []) : (activeQuery.data ?? [])
  const query = isResolved ? resolvedQuery : activeQuery
  const baseFilter = {
    houseId: scope.house?._id ?? null,
    houseZoneIds: zoneIds,
    zoneId: scope.zoneId,
    type: scope.type,
    verdict: scope.verdict,
  }
  // Dải tóm tắt đếm theo mọi bộ lọc trừ mức; danh sách lọc thêm mức đang chọn
  const withoutSeverity = filterAlerts(source, baseFilter)
  const counts = countBySeverity(withoutSeverity)
  const filtered = filterAlerts(withoutSeverity, { ...baseFilter, severity: scope.severity })
  const alerts = isResolved ? filtered : sortAlerts(filtered)
  const activeTotal = filterAlerts(activeQuery.data ?? [], baseFilter).length
  const hasFilter = Boolean(scope.zoneId || scope.type || scope.verdict || scope.severity)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.refetchQueries({ queryKey: ['alerts'], type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  const openAcknowledge = (alert: Alert) => {
    setSheetKey(key => key + 1)
    setAcknowledgeTarget(alert)
  }

  const renderEmpty = () => {
    if (query.isLoading) {
      return (
        <View style={styles.list}>
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
            <Skeleton key={index} width="100%" height={ALERT_ROW_HEIGHT} delayMs={index * 75} />
          ))}
        </View>
      )
    }
    if (query.isError) {
      return (
        <EmptyState
          message={t('Không tải được cảnh báo')}
          actionLabel={t('Thử lại')}
          onAction={() => query.refetch()}
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
      {!isSocketConnected && (
        <View style={[styles.banner, { backgroundColor: palette.surfaceStrong }]}>
          <WifiSlashIcon size={16} color={palette.text} />
          <Text variant="small" style={styles.flex}>
            {t('Mất kết nối realtime, danh sách tự tải lại mỗi 30 giây')}
          </Text>
        </View>
      )}
      <SeveritySummary
        counts={counts}
        selected={scope.severity}
        onToggle={scope.toggleSeverity}
        isLoading={query.isLoading}
      />
      <ChoiceChips
        options={[
          { id: 'active', label: t('Đang hiệu lực ({count})', { count: activeTotal }) },
          { id: 'resolved', label: t('Đã đóng') },
        ]}
        selectedId={scope.segment}
        onSelect={scope.selectSegment}
        accessibilityLabel={t('Trạng thái cảnh báo')}
      />
      <AlertFilterChips scope={scope} />
      {/* Bác bỏ chưa chuyển cảnh báo sang DISMISSED nên "Đã đóng" chỉ gồm cảnh báo đã tự hết */}
      {isResolved && <ComingSoonAction label={t('Nhóm "Bị bác bỏ"')} />}
    </View>
  )

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View key={language} style={styles.screen}>
        <AppHeader
          leading={
            <HeaderPicker
              title={scope.house?.name ?? t('Tất cả nhà')}
              onPress={() => setHouseSheetOpen(true)}
              accessibilityLabel={t('{house}, bấm để đổi nhà', { house: scope.house?.name ?? t('Tất cả nhà') })}
            />
          }
          right={
            canEditSettings ? (
              <IconButton icon={GearSixIcon} label={t('Cài đặt thông báo')} onPress={() => setSettingsOpen(true)} />
            ) : undefined
          }
        />
        <FlatList
          data={alerts}
          keyExtractor={alert => alert._id}
          renderItem={({ item }) => (
            <AlertRow
              alert={item}
              locationText={locate(item).text}
              now={now}
              isNew={newAlertIds.has(item._id)}
              onPress={() => setDetailAlert(item)}
              onAcknowledge={canAcknowledge ? () => openAcknowledge(item) : undefined}
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
          ListFooterComponent={
            isResolved && resolvedQuery.hasNextPage ? (
              <Button
                label={t('Xem thêm')}
                variant="link"
                loading={resolvedQuery.isFetchingNextPage}
                onPress={() => resolvedQuery.fetchNextPage()}
              />
            ) : undefined
          }
          onEndReached={() => {
            if (isResolved && resolvedQuery.hasNextPage && !resolvedQuery.isFetchingNextPage) {
              void resolvedQuery.fetchNextPage()
            }
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
            { id: ALL_HOUSES, label: t('Tất cả nhà'), caption: scope.farm?.name },
            ...scope.houses.map(house => ({ id: house._id, label: house.name })),
          ]}
          selectedId={scope.house?._id ?? ALL_HOUSES}
          onSelect={id => {
            setHouseSheetOpen(false)
            scope.selectHouse(id === ALL_HOUSES ? null : id)
          }}
          onClose={() => setHouseSheetOpen(false)}
          footerAction={
            scope.farms.length > 1
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
          options={scope.farms.map(farm => ({ id: farm._id, label: farm.name, caption: farm.address || undefined }))}
          selectedId={farmId}
          onSelect={id => {
            setFarmSheetOpen(false)
            scope.selectFarm(id)
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
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.md },
  flex: { flex: 1 },
  allClear: { alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.xl },
})
