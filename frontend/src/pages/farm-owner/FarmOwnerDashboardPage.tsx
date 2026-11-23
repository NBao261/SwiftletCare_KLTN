import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useScopeFilter } from '@/hooks/shared/useScopeFilter'
import { useSensorNodes } from '@/hooks/shared/useDevices'
import { useHealthDays } from '@/hooks/shared/useHealthDays'
import { useFarmStructure } from '@/hooks/farm-owner/useFarmStructure'
import { useAwaitingApproval } from '@/hooks/farm-owner/useWorkOrders'
import { useFarmOverviews } from '@/hooks/farm-owner/useFarmOverview'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { Button } from '@/components/ui'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmKpiRow from '@/components/features/farm-owner/dashboard/FarmKpiRow'
import HouseStatusCard from '@/components/features/farm-owner/dashboard/HouseStatusCard'
import HouseDetailPanels from '@/components/features/farm-owner/dashboard/HouseDetailPanels'
import DashboardTodoCard from '@/components/features/farm-owner/dashboard/DashboardTodoCard'
import { countAlertsInHouses, houseLiveStatus, latestTimestamp, summarizeFarmHouses } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import { useAcknowledgedAlerts } from '@/hooks/shared/useAlerts'
import { shiftDate, vietnamDate } from '@/components/common/healthDay.utils'
import type { SensorNode } from '@/types'

// Ngày chưa đánh giá tính trong 7 ngày qua (hạn đánh giá D+7)
const RATING_WINDOW_DAYS = 7
const NO_SENSORS: SensorNode[] = []
const NO_FARM_IDS: string[] = []

// Tổng quan Farm Owner
export default function FarmOwnerDashboardPage() {
  const { t, time } = useTranslation(dashboardDict)
  const scope = useScopeFilter()
  const { farmId, farms, farmNames, houses, houseId, zones, zone: scopeZone } = scope
  const isAllHouses = houseId === ''
  // Duyệt phiếu, đánh giá ngày là việc của chủ nhà yến; chuyên gia xem Tổng quan chỉ đọc
  const isOwner = usePermission('FARM_OWNER')
  // Kỹ thuật viên không đọc tổng quan trang trại (backend 403): đếm cảnh báo từ các nhà được giao
  const isTechnician = usePermission('FARM_TECHNICIAN')

  const liveZoneIds = useMemo(() => (scopeZone ? [scopeZone._id] : zones.map(zone => zone._id)), [scopeZone, zones])
  const { structure, isLoading: isStructureLoading, isError: isStructureError, canViewHarvest, refetch: refetchStructure } = useFarmStructure({ liveZoneIds })
  // Nhà trong phạm vi khung lọc: KPI, thẻ nhà và việc cần làm cùng một nguồn nên số khớp nhau
  const scopedHouses = useMemo(
    () => structure.houses.filter(node => (!farmId || node.farm._id === farmId) && (!houseId || node.house._id === houseId)),
    [structure.houses, farmId, houseId],
  )
  // Bộ điều khiển theo Zone: chế độ tự động/tay và số online trên thẻ nhà
  const { data: sensors } = useSensorNodes()
  const sensorsByHouse = useMemo(() => {
    const zoneToHouse = new Map(scopedHouses.flatMap(node => node.zones.map(zone => [zone.zone._id, node.house._id] as const)))
    const result = new Map<string, SensorNode[]>()
    for (const sensor of sensors ?? []) {
      const ownerHouseId = zoneToHouse.get(sensor.zone_id)
      if (ownerHouseId) result.set(ownerHouseId, [...(result.get(ownerHouseId) ?? []), sensor])
    }
    return result
  }, [sensors, scopedHouses])
  // Trạng thái trực tiếp từng nhà: thẻ nhà và ô "Nhà cần chú ý" dùng cùng một luật
  const statusByHouse = useMemo(
    () => new Map(scopedHouses.map(node => [node.house._id, houseLiveStatus(node.health, (sensorsByHouse.get(node.house._id) ?? NO_SENSORS).map(sensor => sensor.status))])),
    [scopedHouses, sensorsByHouse],
  )
  const totals = useMemo(() => {
    const summary = summarizeFarmHouses(scopedHouses, '')
    return { ...summary, faultHouses: [...statusByHouse.values()].filter(status => status === 'ALERT').length }
  }, [scopedHouses, statusByHouse])
  const scopedAlerts = useMemo(
    () => scopedHouses.flatMap(node => node.alerts).sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [scopedHouses],
  )
  const lastSyncedAt = latestTimestamp(scopedHouses.flatMap(node => node.zones.map(zone => zone.metrics?.timestamp)))

  // Tình hình hôm nay của từng nhà (chim về, phiếu đang mở): 1 request mỗi trang trại trong phạm vi
  const scopeFarmIds = useMemo(() => (farmId ? [farmId] : farms.map(farm => farm._id)), [farmId, farms])
  const { byHouse: overviewByHouse, isError: isOverviewError, refetch: refetchOverview } = useFarmOverviews(isTechnician ? NO_FARM_IDS : scopeFarmIds)
  // Cùng nguồn cho ô KPI và thẻ nhà để tổng bằng nhau
  // Như open_alerts của tổng quan: đang báo và đã xác nhận
  const { data: acknowledgedAlerts } = useAcknowledgedAlerts(isTechnician)
  let openAlerts: number | undefined
  if (isTechnician) openAlerts = acknowledgedAlerts ? scopedAlerts.length + countAlertsInHouses(acknowledgedAlerts, scopedHouses) : undefined
  else if (scopedHouses.every(node => overviewByHouse.has(node.house._id))) {
    openAlerts = scopedHouses.reduce((sum, node) => sum + (overviewByHouse.get(node.house._id)?.open_alerts ?? 0), 0)
  }

  // Phiếu chờ duyệt cùng phạm vi khung lọc với các ô khác
  const { data: awaiting } = useAwaitingApproval(farmId, houseId)
  const today = vietnamDate()
  const { days: daysToRate } = useHealthDays({
    farmIds: isOwner ? scopeFarmIds : [],
    houseId: isOwner ? houseId : '',
    from: shiftDate(today, -RATING_WINDOW_DAYS),
    to: today,
    myRatingState: 'PENDING',
  })

  // Thanh phạm vi trên header ở mọi khổ màn (dưới xl xuống hàng riêng)
  const header = (
    <HeaderActions>
      <ScopeFilter scope={scope} />
    </HeaderActions>
  )

  if (scope.isLoading) return <LoadingSkeleton count={4} className="h-32 w-full" />

  if (scope.isError) {
    return (
      <EmptyState
        title={t('page.zoneErrorTitle')}
        description={t('page.zoneErrorDesc')}
        action={<Button variant="secondary" onClick={scope.refetch}>{t('log.retry')}</Button>}
      />
    )
  }

  // Phạm vi đang lọc chưa có nhà: vẫn giữ khung lọc để chọn trang trại khác
  if (houses.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <EmptyState
          title={farmId ? t('page.noHouseInFarmTitle') : t('page.noZoneTitle')}
          description={farmId ? t('page.noHouseInFarmDesc') : t('page.noZoneDesc')}
          action={<Link to="/farms"><Button>{t('page.goFarms')}</Button></Link>}
        />
      </div>
    )
  }

  // Đang tải thì khung xương, lỗi thì báo lỗi, không hiện số 0 giả
  let body: ReactNode
  if (isStructureLoading) body = <LoadingSkeleton count={3} className="h-40 w-full" />
  else if (isStructureError) {
    body = (
      <EmptyState
        title={t('page.zoneErrorTitle')}
        description={t('page.zoneErrorDesc')}
        action={<Button variant="secondary" onClick={refetchStructure}>{t('log.retry')}</Button>}
      />
    )
  } else {
    // Tất cả trang trại: nhóm thẻ theo trang trại, tên trang trại là tiêu đề nhóm
    const groupByFarm = !farmId && farms.length > 1
    const groups = groupByFarm
      ? farms
        .map(farm => ({ id: farm._id, title: farmNames.get(farm._id) ?? '', nodes: scopedHouses.filter(node => node.farm._id === farm._id) }))
        .filter(group => group.nodes.length > 0)
      : [{ id: 'all', title: t('grid.title'), nodes: scopedHouses }]
    body = (
      <>
        <FarmKpiRow totals={totals} openAlerts={openAlerts} isOpenAlertsError={isOverviewError} onRetryOpenAlerts={refetchOverview} awaitingApproval={awaiting?.total} />
        {isAllHouses ? groups.map((group, index) => (
          <section key={group.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h2 text-charcoal">{group.title}</h2>
              {index === 0 && lastSyncedAt && <p className="text-small text-warmGray">{t('grid.updated', { time: time(lastSyncedAt) })}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.nodes.map(node => (
                <HouseStatusCard
                  key={node.house._id}
                  node={node}
                  status={statusByHouse.get(node.house._id) ?? node.health}
                  sensors={sensorsByHouse.get(node.house._id) ?? NO_SENSORS}
                  overview={overviewByHouse.get(node.house._id)}
                />
              ))}
            </div>
          </section>
        )) : (
          <HouseDetailPanels scope={scope} houseNode={structure.houseById.get(houseId)} canViewHarvest={canViewHarvest} />
        )}
        {isOwner && (
          <DashboardTodoCard
            alerts={scopedAlerts}
            approvals={awaiting?.items ?? []}
            approvalsTotal={awaiting?.total ?? 0}
            daysToRate={daysToRate.length}
            structure={structure}
          />
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      {body}
    </div>
  )
}
