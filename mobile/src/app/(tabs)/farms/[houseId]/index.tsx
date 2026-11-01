import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { router, useIsFocused, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { BellIcon, GearSixIcon, WifiSlashIcon } from 'phosphor-react-native'
import { ActuatorSection } from '@/components/farm/ActuatorSection'
import { BirdCountStrip } from '@/components/farm/BirdCountStrip'
import { DeviceDetailSheet } from '@/components/farm/DeviceDetailSheet'
import { DeviceSection, type SelectedDevice } from '@/components/farm/DeviceSection'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { HouseCameraPanel } from '@/components/farm/HouseCameraPanel'
import { HouseYieldRow } from '@/components/farm/HouseYieldRow'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { RelayControlSheet } from '@/components/farm/RelayControlSheet'
import { SensorTileGrid } from '@/components/farm/SensorTileGrid'
import { ZoneAlertRow } from '@/components/farm/ZoneAlertRow'
import { ZoneSettingsSection } from '@/components/farm/ZoneSettingsSection'
import { ZoneTabs } from '@/components/farm/ZoneTabs'
import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useHouseDetail } from '@/hooks/farm/useHouseDetail'
import { useOrderedHouses } from '@/hooks/farm/useOrderedHouses'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useFarmPrefsStore } from '@/stores/farmPrefsStore'
import type { RelayName } from '@/types'
import { getForecastMinutesAhead } from '@/utils/alert.utils'
import { formatElapsed } from '@/utils/date.utils'
import { buildSensorTiles } from '@/utils/sensorTile.utils'
import type { SettingsSectionKind } from '@/utils/settingsSection.utils'
import { t } from '@/utils/i18n.utils'

// "Cập nhật X giây trước" chạy theo từng giây
const CLOCK_INTERVAL_MS = 1000
// Cao bằng lưới cảm biến 2 cột × 3 hàng (mỗi ô khoảng 82, 2 khoảng 8)
const SENSOR_SKELETON_HEIGHT = 262

interface RelaySelection {
  controllerId: string
  relay: RelayName
}

/** Màn B – một nhà yến: camera ghim đầu, đàn chim hôm nay, tab tầng, 6 ô cảm biến, thiết bị (VISION-FR-012/013, ENV-FR-005) */
export default function HouseDetailScreen() {
  const palette = usePalette()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()
  const queryClient = useQueryClient()
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()
  const now = useNow(CLOCK_INTERVAL_MS)
  const { houseId, zoneId: requestedZoneId } = useLocalSearchParams<{ houseId: string; zoneId?: string }>()
  const { userId } = useFarmPrefs()
  const setLastZone = useFarmPrefsStore(state => state.setLastZone)
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(requestedZoneId)
  const detail = useHouseDetail(houseId, selectedZoneId)
  const { houses: farmHouses } = useOrderedHouses(detail.house?.farm_id ?? '')
  const [isHouseSheetOpen, setHouseSheetOpen] = useState(false)
  const [relaySelection, setRelaySelection] = useState<RelaySelection | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)

  const isSheetOpen = isHouseSheetOpen || relaySelection !== null || selectedDevice !== null
  const selectedController = relaySelection
    ? (detail.controllers.find(controller => controller._id === relaySelection.controllerId) ?? null)
    : null

  // ‹ luôn về danh sách nhà của farm, kể cả khi mở thẳng Màn B từ Trang chủ
  const goBack = () => router.dismissTo('/(tabs)/farms')

  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId)
    if (userId) setLastZone(userId, houseId, zoneId)
  }

  // Đổi nhà thay màn hiện tại để nút ‹ không phải bấm qua nhiều nhà
  const handleSelectHouse = (nextHouseId: string) => {
    setHouseSheetOpen(false)
    if (nextHouseId !== houseId)
      router.replace({ pathname: '/(tabs)/farms/[houseId]', params: { houseId: nextHouseId } })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.refetchQueries({ type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  const retry = () => queryClient.refetchQueries({ type: 'active' })
  // Tab Cảnh báo lọc sẵn nhà này (chuông) hoặc tầng đang xem (hàng cảnh báo tầng)
  const openAlerts = (zoneId?: string) =>
    router.navigate({ pathname: '/(tabs)/alerts', params: { houseId, zoneId: zoneId ?? '' } })
  // Phân tích đúng nhà và tầng đang xem: ô cảm biến mở tab Môi trường của chỉ số đó, dải chim mở tab Đàn chim
  const openAnalytics = (params: { tab: 'env' | 'birds'; metric?: string }) =>
    router.navigate({
      pathname: '/(tabs)/analytics',
      params: { houseId, zoneId: detail.zone?._id ?? '', ...params },
    })
  const openSettings = () => router.push({ pathname: '/(tabs)/farms/[houseId]/settings', params: { houseId } })
  // Từ nút ⋮ của khối Cài đặt zone: mở đúng mục, đúng tầng đang xem; edit = mở sẵn chế độ sửa
  const openSettingsSection = (section: SettingsSectionKind, isEditing: boolean) =>
    router.push({
      pathname: '/(tabs)/farms/[houseId]/settings',
      params: { houseId, section, zoneId: detail.zone?._id, edit: isEditing ? '1' : undefined },
    })

  const renderSensors = () => {
    if (detail.isSensorsLoading || detail.isZonesLoading) {
      return <Skeleton width="100%" height={SENSOR_SKELETON_HEIGHT} />
    }
    if (detail.isSensorsError || detail.isZonesError) {
      return <EmptyState message={t('Không tải được số đo')} actionLabel={t('Thử lại')} onAction={retry} />
    }
    if (!detail.zone) return <EmptyState message={t('Nhà chưa có tầng')} />
    if (detail.controllers.length === 0) return <EmptyState message={t('Zone chưa có thiết bị gửi dữ liệu')} />

    const tiles = buildSensorTiles(detail.telemetry, detail.zone.thresholds, now)
    const forecastMinutes = {
      temperature: getForecastMinutesAhead(detail.zoneAlerts, 'temperature'),
      humidity: getForecastMinutesAhead(detail.zoneAlerts, 'humidity'),
    }
    const updatedAt = detail.telemetry ? new Date(detail.telemetry.timestamp).getTime() : null
    return (
      <View style={styles.sensors}>
        <SensorTileGrid
          tiles={tiles}
          forecastMinutes={forecastMinutes}
          onPressTile={metric => openAnalytics({ tab: 'env', metric })}
        />
        <Text variant="small" color={palette.textSecondary}>
          {updatedAt === null
            ? t('Chưa có số đo')
            : t('Cập nhật {elapsed} trước', { elapsed: formatElapsed(now - updatedAt) })}
        </Text>
      </View>
    )
  }

  // Chưa tìm được nhà (đang tải, lỗi, hoặc nhà đã bị xoá / mất quyền)
  if (!detail.house) {
    return (
      <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
        <AppHeader title={t('Nhà yến')} onBack={goBack} />
        <View style={styles.content}>
          {detail.isHouseLoading ? (
            <Skeleton width="100%" height={SENSOR_SKELETON_HEIGHT} />
          ) : (
            <EmptyState
              message={detail.isHouseError ? t('Không tải được') : t('Không tìm thấy nhà yến')}
              actionLabel={detail.isHouseError ? t('Thử lại') : undefined}
              onAction={detail.isHouseError ? retry : undefined}
            />
          )}
        </View>
      </View>
    )
  }

  const house = detail.house

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        onBack={goBack}
        leading={
          <HeaderPicker
            title={house.name}
            onPress={farmHouses.length > 1 ? () => setHouseSheetOpen(true) : undefined}
            accessibilityLabel={
              farmHouses.length > 1 ? t('{house}, bấm để đổi nhà', { house: house.name }) : house.name
            }
          />
        }
        right={
          <View style={styles.headerActions}>
            <IconButton
              icon={BellIcon}
              label={t('Cảnh báo đang hiệu lực của nhà')}
              badgeCount={detail.houseAlertCount}
              onPress={() => openAlerts()}
            />
            <IconButton icon={GearSixIcon} label={t('Cài đặt nhà')} onPress={openSettings} />
          </View>
        }
      />

      {/* Camera nằm ngoài vùng cuộn nên luôn ở đầu màn */}
      <View style={styles.cameraArea}>
        <HouseCameraPanel
          cameras={detail.cameras}
          today={detail.today}
          isLoading={detail.isCamerasLoading}
          isError={detail.isCamerasError}
          onRetry={retry}
          isActive={isFocused && !isSheetOpen}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        // Màn này không có thanh tab (BottomTabBar tự ẩn): chỉ chừa vùng an toàn dưới
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.textSecondary}
            colors={[palette.text]}
          />
        }
      >
        <BirdCountStrip today={detail.today} onPress={() => openAnalytics({ tab: 'birds' })} />
        <HouseYieldRow farmId={house.farm_id} houseId={house._id} zoneIds={detail.zones.map(zone => zone._id)} />
        {detail.zone && (
          <ZoneTabs
            zones={detail.zones}
            selectedZoneId={detail.zone._id}
            alertZoneIds={detail.alertZoneIds}
            onSelect={handleSelectZone}
          />
        )}
        {!detail.isSocketConnected && (
          <View style={[styles.banner, { backgroundColor: palette.surfaceStrong }]}>
            <WifiSlashIcon size={16} color={palette.text} />
            <Text variant="small" style={styles.flex}>
              {t('Mất kết nối realtime, số đo tự tải lại mỗi 30 giây')}
            </Text>
          </View>
        )}
        {detail.zoneAlertCount > 0 && detail.zoneHighestSeverity && (
          <ZoneAlertRow count={detail.zoneAlertCount} severity={detail.zoneHighestSeverity} onPress={() => openAlerts(detail.zone?._id)} />
        )}
        {renderSensors()}
        <ActuatorSection
          controllers={detail.controllers}
          telemetry={detail.telemetry}
          zoneAlerts={detail.zoneAlerts}
          onSelectRelay={(controller, relay) => setRelaySelection({ controllerId: controller._id, relay })}
        />
        <DeviceSection controllers={detail.controllers} cameras={detail.cameras} onSelect={setSelectedDevice} />
        {detail.zone && <ZoneSettingsSection zone={detail.zone} house={house} onOpenSettings={openSettingsSection} />}
      </ScrollView>

      <OptionSheet
        visible={isHouseSheetOpen}
        title={t('Chọn nhà yến')}
        options={farmHouses.map(item => ({ id: item._id, label: item.name }))}
        selectedId={houseId}
        onSelect={handleSelectHouse}
        onClose={() => setHouseSheetOpen(false)}
      />
      {/* Mỗi lần chọn relay dựng lại sheet để lựa chọn BẬT/TẮT bắt đầu từ trạng thái hiện tại */}
      <RelayControlSheet
        key={relaySelection ? `${relaySelection.controllerId}-${relaySelection.relay}` : 'closed'}
        controller={selectedController}
        relay={relaySelection?.relay ?? null}
        zoneAlerts={detail.zoneAlerts}
        onClose={() => setRelaySelection(null)}
      />
      <DeviceDetailSheet selected={selectedDevice} onClose={() => setSelectedDevice(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Khoảng dưới thanh tiêu đề để khung camera không dính vào tiêu đề
  cameraArea: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  // Khoảng giữa các khối gọn hơn các màn khác để dải chim, sản lượng, tab tầng và cả lưới cảm biến nằm trong màn đầu
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  sensors: { gap: Spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  flex: { flex: 1 },
})
