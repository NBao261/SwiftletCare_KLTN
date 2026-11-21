import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChartLineIcon, PlusIcon } from 'phosphor-react-native'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { HarvestCycleCard } from '@/components/harvest/HarvestCycleCard'
import { HarvestRunRow } from '@/components/harvest/HarvestRunRow'
import { HarvestRunSheet } from '@/components/harvest/HarvestRunSheet'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useHouseZones } from '@/hooks/farm/useHouseZones'
import { useFarmHarvests } from '@/hooks/harvest/useFarmHarvests'
import { useHarvestCycles } from '@/hooks/harvest/useHarvestCycles'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import { canEditHarvestRun, groupHarvestRuns, type HarvestRun } from '@/utils/harvest.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'
import { buildHouseReturnTo } from '@/utils/navigation.utils'

const SKELETON_ROWS = 4
const ROW_SKELETON_HEIGHT = 64

// Sheet đang mở: ghi lần thu mới (run null) hoặc sửa một lần thu; key mới mỗi lần mở để form về trạng thái đầu
interface OpenSheet {
  key: number
  run: HarvestRun | null
}

/** Các lần thu của một nhà (SF-04, HARVEST-FR-001…006): chủ trại và kỹ thuật viên ghi, sửa lần thu; chuyên gia chỉ xem.
 * Màn riêng ở stack gốc, mở từ ô sản lượng ở chi tiết nhà và tab Sản lượng của Phân tích */
export default function HarvestsScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const goBack = useGoBackOrHome()
  const user = useAuthStore(state => state.user)
  // source=analytics: mở từ tab Sản lượng của Phân tích, nên không có nút sang thống kê (‹ là về đó)
  const params = useLocalSearchParams<{ houseId?: string; source?: string }>()
  const allHouses = useAllHouses()
  const [pickedHouseId, setPickedHouseId] = useState<string | null>(null)
  const [isHouseSheetOpen, setHouseSheetOpen] = useState(false)
  const [openSheet, setOpenSheet] = useState<OpenSheet | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)
  const toast = useToastMessage()
  // Nhà: chọn trên màn → tham số route → nhà đầu tiên
  const house =
    allHouses.houses.find(item => item._id === (pickedHouseId ?? params.houseId)) ?? allHouses.houses[0] ?? null
  const zonesQuery = useHouseZones(house?._id ?? '')
  const harvestsQuery = useFarmHarvests(house?.farm_id ?? '')
  const cyclesQuery = useHarvestCycles(house?._id ?? '')
  const zones = zonesQuery.data ?? []
  const runs = groupHarvestRuns(
    harvestsQuery.data?.data ?? [],
    zones.map(zone => zone._id),
  )
  // Lần thu mới gắn vào zone tạo sớm nhất của nhà (useHouseZones đã xếp zone tạo trước đứng đầu) — như web
  const targetZoneId = zones[0]?._id ?? ''
  const canRecord = canPerform(user, 'recordHarvest')

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([zonesQuery.refetch(), harvestsQuery.refetch(), cyclesQuery.refetch()])
    } finally {
      setRefreshing(false)
    }
  }

  const openRunSheet = (run: HarvestRun | null) => setOpenSheet(current => ({ key: (current?.key ?? 0) + 1, run }))

  const openStatistics = () => {
    if (!house) return
    router.navigate({
      pathname: '/(tabs)/analytics',
      params: { houseId: house._id, tab: 'harvest', returnTo: buildHouseReturnTo(house._id) },
    })
  }

  const renderList = () => {
    if (zonesQuery.isLoading || harvestsQuery.isLoading) {
      return Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton
          key={index}
          width="100%"
          height={ROW_SKELETON_HEIGHT}
          radius={Radius.md}
          color={palette.surfaceStrong}
          delayMs={index * 75}
        />
      ))
    }
    if (zonesQuery.isError || harvestsQuery.isError) {
      return <EmptyState message={t('Không tải được')} actionLabel={t('Thử lại')} onAction={handleRefresh} />
    }
    if (runs.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {t('Chưa có lần thu nào')}
        </Text>
      )
    }
    return runs.map((run, index) => (
      <HarvestRunRow
        key={run.key}
        run={run}
        hasDivider={index < runs.length - 1}
        onPress={canEditHarvestRun(user, run) ? () => openRunSheet(run) : undefined}
      />
    ))
  }

  // Chu kỳ thu của các zone trong nhà (HARVEST-FR-007): mỗi lần thu đã xác nhận đóng một kỳ
  const renderCycles = () => {
    if (cyclesQuery.isLoading) return <Skeleton width="100%" height={ROW_SKELETON_HEIGHT} radius={Radius.md} />
    if (cyclesQuery.isError) {
      return <EmptyState message={t('Không tải được chu kỳ thu')} actionLabel={t('Thử lại')} onAction={() => cyclesQuery.refetch()} />
    }
    const cycles = cyclesQuery.data ?? []
    if (cycles.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {t('Chưa có chu kỳ thu: chu kỳ bắt đầu từ lần thu đã xác nhận đầu tiên của khu vực')}
        </Text>
      )
    }
    const zoneNameById = new Map(zones.map(zone => [zone._id, zone.name]))
    return cycles.map((cycle, index) => (
      <HarvestCycleCard
        key={cycle._id}
        cycle={cycle}
        zoneName={zoneNameById.get(cycle.zone_id) ?? '_'}
        hasDivider={index < cycles.length - 1}
      />
    ))
  }

  const renderBody = () => {
    if (allHouses.isLoading) return <Skeleton width="100%" height={ROW_SKELETON_HEIGHT * 3} />
    if (allHouses.isError) return <EmptyState message={t('Không tải được')} />
    if (!house) {
      return (
        <EmptyState
          message={canPerform(user, 'limitedToAssignedHouses') ? t('Bạn chưa được giao nhà nào') : t('Chưa có nhà yến')}
        />
      )
    }
    const hasNoZone = !zonesQuery.isLoading && !zonesQuery.isError && targetZoneId === ''
    return (
      <>
        {canRecord && (
          <Button
            label={t('Ghi lần thu')}
            trailingIcon={PlusIcon}
            onPress={() => openRunSheet(null)}
            disabled={targetZoneId === ''}
          />
        )}
        {canRecord && hasNoZone && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Nhà này chưa có Zone nên chưa ghi được đợt thu')}
          </Text>
        )}
        <Card>{renderList()}</Card>
        <Text variant="small" color={palette.textSecondary}>
          {t(
            'Một lần thu là các loại yến của cùng nhà, cùng ngày. Lần thu do kỹ thuật viên ghi chờ chủ trại xác nhận rồi mới tính vào sản lượng và chu kỳ thu hoạch.',
          )}
        </Text>
        <Text variant="body" weight="semiBold">
          {t('Chu kỳ thu')}
        </Text>
        <Card>{renderCycles()}</Card>
      </>
    )
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        onBack={goBack}
        leading={
          <HeaderPicker
            title={house ? house.name : t('Thu hoạch')}
            onPress={allHouses.houses.length > 1 ? () => setHouseSheetOpen(true) : undefined}
            accessibilityLabel={t('Chọn nhà yến')}
          />
        }
        right={
          house && params.source !== 'analytics' ? (
            <IconButton icon={ChartLineIcon} label={t('Mở thống kê thu hoạch')} onPress={openStatistics} />
          ) : undefined
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
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
        {renderBody()}
      </ScrollView>
      <OptionSheet
        visible={isHouseSheetOpen}
        title={t('Chọn nhà yến')}
        options={allHouses.houses.map(item => ({ id: item._id, label: item.name }))}
        selectedId={house?._id}
        onSelect={id => {
          setPickedHouseId(id)
          setHouseSheetOpen(false)
        }}
        onClose={() => setHouseSheetOpen(false)}
      />
      {house && openSheet && (
        <HarvestRunSheet
          key={openSheet.key}
          visible
          farmId={house.farm_id}
          houseName={house.name}
          zoneId={targetZoneId}
          run={openSheet.run}
          onDone={message => {
            setOpenSheet(null)
            toast.show(message)
          }}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.lg} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
})
