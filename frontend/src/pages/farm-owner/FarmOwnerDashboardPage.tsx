import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useZoneStore } from '@/stores/zoneStore'
import { useFarms, useHouses } from '@/hooks/shared/useFarms'
import { useScopeZones, useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import { usePinnedHouses } from '@/hooks/farm-owner/usePinnedHouses'
import { useFarmStructure } from '@/hooks/farm-owner/useFarmStructure'
import { useTranslation } from '@/hooks/common/useTranslation'
import { usePageHero } from '@/hooks/common/usePageHero'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import SelectMenu from '@/components/ui/SelectMenu'
import HeaderActions from '@/components/layouts/HeaderActions'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ScadaModeBanner from '@/components/features/farm-owner/dashboard/ScadaModeBanner'
import EcoHealthCard from '@/components/features/farm-owner/dashboard/EcoHealthCard'
import ControlSubsystemPanel from '@/components/features/farm-owner/dashboard/ControlSubsystemPanel'
import EnvSensorPanel from '@/components/features/farm-owner/dashboard/EnvSensorPanel'
import BirdVisionCard from '@/components/features/farm-owner/dashboard/BirdVisionCard'
import NestingDensityCard from '@/components/features/farm-owner/dashboard/NestingDensityCard'
import SensorAlertLogTable from '@/components/features/farm-owner/dashboard/SensorAlertLogTable'
import FarmKpiRow from '@/components/features/farm-owner/dashboard/FarmKpiRow'
import HouseHarvestCard from '@/components/features/farm-owner/dashboard/HouseHarvestCard'
import { houseHeadlineText } from '@/components/features/farm-owner/farms/houseHeadline'
import { getAnomalies, sortPinnedFirst, summarizeFarmHouses } from '@/components/features/farm-owner/dashboard/dashboardMetrics'

// Ảnh nhà yến làm nền tràn đầu trang Tổng quan
const DASHBOARD_HERO_IMAGE = { src: '/Background_farm.png', width: 1376, height: 768 }

// Dashboard Farm Owner
export default function FarmOwnerDashboardPage() {
  const { t } = useTranslation(dashboardDict)
  const { t: translateFarm, num: formatFarmNumber } = useTranslation(farmDict)
  usePageHero(DASHBOARD_HERO_IMAGE)
  const selectedFarmId = useZoneStore(s => s.selectedFarmId)
  const { data: farms, isLoading: isLoadingFarms, isError: isFarmsError, refetch: refetchFarms } = useFarms()
  const farmId = selectedFarmId ?? farms?.[0]?._id ?? ''
  const { data: houses, isLoading: isLoadingHouses, isError: isHousesError, refetch: refetchHouses } = useHouses(farmId || undefined)
  const { pinned } = usePinnedHouses()
  const [choice, setChoice] = useState('')

  const houseOptions = [
    { value: '', label: t('page.allHouses') },
    ...sortPinnedFirst(houses ?? [], pinned).map(house => ({ value: house._id, label: house.name })),
  ]
  const houseId = houseOptions.some(option => option.value === choice) ? choice : ''
  const houseName = houseOptions.find(option => option.value === houseId)?.label ?? ''

  const { zones } = useScopeZones(farmId, houseId)
  const { readings, thresholds, lastSyncedAt, controlMode, overrideExpiry, relayStates, controlOutput, deviceNames } = useZonesEnvironment(zones)
  // Số liệu theo từng nhà (thiết bị, cảnh báo, sản lượng tháng, sự cố nổi bật) — cùng nguồn với màn Cấu trúc Farm
  const { structure, isLoading: isStructureLoading, isError: isStructureError, canViewHarvest, refetch: refetchStructure } = useFarmStructure()
  const farmTotals = useMemo(() => summarizeFarmHouses(structure.houses, farmId), [structure.houses, farmId])
  const houseNode = houseId ? structure.houseById.get(houseId) : undefined
  const isAllHouses = houseId === ''
  // Sự cố nổi bật trên capsule SCADA: 1 nhà → câu sự cố của nhà đó; tất cả → số nhà đang có sự cố
  let scadaIssue = houseHeadlineText(houseNode?.headline, translateFarm, formatFarmNumber)
  if (isAllHouses) scadaIssue = farmTotals.faultHouses > 0 ? t('kpi.housesIssue', { n: farmTotals.faultHouses }) : ''

  if (isLoadingFarms || isLoadingHouses) {
    return <LoadingSkeleton count={4} className="h-32 w-full" />
  }

  if (isFarmsError || isHousesError) {
    return (
      <EmptyState
        title={t('page.zoneErrorTitle')}
        description={t('page.zoneErrorDesc')}
        action={<Button variant="secondary" onClick={() => { void refetchFarms(); void refetchHouses() }}>{t('log.retry')}</Button>}
      />
    )
  }

  if (!houses?.length) {
    return (
      <EmptyState
        title={t('page.noZoneTitle')}
        description={t('page.noZoneDesc')}
        action={
          <Link to="/farms">
            <Button>{t('page.goFarms')}</Button>
          </Link>
        }
      />
    )
  }

  const anomalies = houseId && thresholds ? getAnomalies(readings, thresholds) : undefined
  // Bộ lọc nhà yến chung: đổi nhà là mọi khối (SCADA, cảm biến, điều khiển, đếm chim, mật độ tổ, nhật ký) lọc theo nhà đó
  const houseFilter = (
    <SelectMenu
      ariaLabel={t('page.houseLabel')}
      value={houseId}
      options={houseOptions}
      onChange={setChoice}
      className="h-10 w-44 justify-between shadow-icon"
    />
  )

  // Hàng KPI chế độ "Tất cả nhà yến": đang tải thì khung xương, lỗi thì báo lỗi, không hiện số 0 giả
  let kpiSection: ReactNode = <FarmKpiRow farmId={farmId} totals={farmTotals} showYield={canViewHarvest} />
  if (isStructureLoading) kpiSection = <LoadingSkeleton count={2} className="h-28 w-full" />
  if (isStructureError) {
    kpiSection = (
      <EmptyState
        title={t('page.zoneErrorTitle')}
        description={t('page.zoneErrorDesc')}
        action={<Button variant="secondary" onClick={refetchStructure}>{t('log.retry')}</Button>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Bộ lọc nằm trên header từ sm trở lên; mobile header chật nên đặt đầu trang */}
      <HeaderActions>
        <div className="hidden sm:block">{houseFilter}</div>
      </HeaderActions>

      {/* Vùng đầu trang trên ảnh nền: chỉ có capsule SCADA, chiều cao tối thiểu giữ vị trí bắt đầu của khung nội dung */}
      <section className="flex min-h-[176px] flex-col gap-3 lg:min-h-[256px]">
        <div className="sm:hidden">{houseFilter}</div>
        <ScadaModeBanner lastSyncedAt={lastSyncedAt} controlMode={controlMode} overrideExpiry={overrideExpiry} issueText={scadaIssue} />
      </section>

      {isAllHouses ? (
        <>
          {/* Thông tin chung mọi nhà: KPI tổng bên trái, trạng thái từng nhà bên phải */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
            {kpiSection}
            <div className="flex min-h-[240px] [&>*]:flex-1">
              <EcoHealthCard farmId={farmId} />
            </div>
          </div>

          <SensorAlertLogTable farmId={farmId} houseId={houseId} zones={zones} deviceNames={deviceNames} />
        </>
      ) : (
        <>
          <EnvSensorPanel farmId={farmId} houseId={houseId} />

          {/* Khối điều khiển 3 relay, bên phải là sản lượng thu hoạch của nhà (ẩn nếu role không xem được thu hoạch) */}
          <div className={cn('grid grid-cols-1 gap-5', houseNode && canViewHarvest && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
            <ControlSubsystemPanel
              zoneName={houseName}
              relayStates={relayStates}
              controlMode={controlMode}
              controlOutput={controlOutput}
              tooHot={anomalies?.tooHot ?? false}
            />
            {houseNode && canViewHarvest && <HouseHarvestCard node={houseNode} />}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <BirdVisionCard farmId={farmId} houseId={houseId} />
            <NestingDensityCard zones={zones} houseId={houseId} />
          </div>

          <SensorAlertLogTable farmId={farmId} houseId={houseId} zones={zones} deviceNames={deviceNames} />
        </>
      )}
    </div>
  )
}
