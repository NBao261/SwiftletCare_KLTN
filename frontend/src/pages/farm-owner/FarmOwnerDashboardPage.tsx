import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import type { AllZone } from '@/hooks/shared/useFarms'
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter'
import { useFarmStructure } from '@/hooks/farm-owner/useFarmStructure'
import { useTranslation } from '@/hooks/common/useTranslation'
import { usePageHero } from '@/hooks/common/usePageHero'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ScadaModeBanner from '@/components/features/farm-owner/dashboard/ScadaModeBanner'
import EcoHealthCard from '@/components/features/farm-owner/dashboard/EcoHealthCard'
import ControlSubsystemPanel from '@/components/features/farm-owner/dashboard/ControlSubsystemPanel'
import EnvSensorPanel from '@/components/features/farm-owner/dashboard/EnvSensorPanel'
import LiveCameraCard from '@/components/features/farm-owner/vision/LiveCameraCard'
import NestingDensityCard from '@/components/features/farm-owner/dashboard/NestingDensityCard'
import SensorAlertLogTable from '@/components/features/farm-owner/dashboard/SensorAlertLogTable'
import FarmKpiRow from '@/components/features/farm-owner/dashboard/FarmKpiRow'
import ZoneScopeControl from '@/components/features/farm-owner/dashboard/ZoneScopeControl'
import { SCADA_PATH } from '@/components/features/farm-owner/dashboard/scada.constants'
import { usePermission } from '@/hooks/common/usePermission'
import HouseHarvestCard from '@/components/features/farm-owner/dashboard/HouseHarvestCard'
import { houseHeadlineText } from '@/components/features/farm-owner/farms/houseHeadline'
import { getAnomalies, summarizeFarmHouses } from '@/components/features/farm-owner/dashboard/dashboardMetrics'

const NO_ZONES: AllZone[] = []

// Ảnh nhà yến làm nền tràn đầu trang Tổng quan
const DASHBOARD_HERO_IMAGE = { src: '/Background_farm.png', width: 1376, height: 768 }

// Dashboard Farm Owner
export default function FarmOwnerDashboardPage() {
  const { t } = useTranslation(dashboardDict)
  const { t: translateFarm, num: formatFarmNumber } = useTranslation(farmDict)
  usePageHero(DASHBOARD_HERO_IMAGE)
  // Khung lọc Nhà + Zone lưu ở store chung nên chuyển trang rồi quay lại vẫn giữ nguyên
  const scope = useScopeFilter()
  const { farmId, houses, houseId, houseName, zones, zone: scopeZone, issueZoneIds, isLoading: isLoadingHouses, isError: isHousesError, refetch: refetchHouses } = scope
  // Phạm vi số liệu: 1 Zone đã lọc, hoặc tất cả Zone trong phạm vi nhà
  const scopedZones = useMemo(() => (scopeZone ? [scopeZone] : zones), [scopeZone, zones])
  const { lastSyncedAt, controlMode, overrideExpiry, deviceNames } = useZonesEnvironment(scopedZones)

  // Zone của khung Cảm biến và khung Điều khiển; đồng bộ (mặc định bật) thì 2 khung dùng chung 1 Zone
  const [isZoneLinked, setIsZoneLinked] = useState(true)
  const [envZoneChoice, setEnvZoneChoice] = useState('')
  const [controlZoneChoice, setControlZoneChoice] = useState('')
  const zoneById = useMemo(() => new Map(zones.map(zone => [zone._id, zone])), [zones])
  const scopeZoneId = scopeZone?._id
  // Đổi Zone trên header thì 2 khung nhảy theo Zone đó (kể cả khi đang tách đồng bộ)
  useEffect(() => {
    if (!scopeZoneId) return
    setEnvZoneChoice(scopeZoneId)
    setControlZoneChoice(scopeZoneId)
  }, [scopeZoneId])
  // Đã lọc 1 Zone trên header + đang đồng bộ thì 2 khung theo Zone header; còn lại mỗi khung theo Zone tự chọn, mặc định Zone header hoặc Zone đầu tiên của nhà
  const envZone = (isZoneLinked ? scopeZone : undefined) ?? zoneById.get(envZoneChoice) ?? scopeZone ?? zones[0]
  const controlZone = isZoneLinked ? envZone : zoneById.get(controlZoneChoice) ?? scopeZone ?? zones[0]
  // Ô chọn Zone + nút đồng bộ luôn hiện khi nhà có từ 2 Zone, cả lúc header đang lọc 1 Zone
  const hasPanelZonePicker = zones.length > 1
  const controlZones = useMemo(() => (controlZone ? [controlZone] : NO_ZONES), [controlZone])
  const control = useZonesEnvironment(controlZones)
  // Điều khiển tay relay có thời hạn (ENV-FR-016): Farm Owner được làm, Domain Expert thì không
  const canControlRelay = usePermission('FARM_OWNER')
  const navigate = useNavigate()
  // Số liệu theo từng nhà (thiết bị, cảnh báo, sản lượng tháng, sự cố nổi bật) — cùng nguồn với màn Cấu trúc Farm
  const { structure, isLoading: isStructureLoading, isError: isStructureError, canViewHarvest, refetch: refetchStructure } = useFarmStructure()
  const farmTotals = useMemo(() => summarizeFarmHouses(structure.houses, farmId), [structure.houses, farmId])
  const houseNode = houseId ? structure.houseById.get(houseId) : undefined
  const isAllHouses = houseId === ''
  // Sự cố nổi bật trên capsule SCADA: 1 nhà → câu sự cố của nhà đó; tất cả → số nhà đang có sự cố
  let scadaIssue = houseHeadlineText(houseNode?.headline, translateFarm, formatFarmNumber)
  if (isAllHouses) scadaIssue = farmTotals.faultHouses > 0 ? t('kpi.housesIssue', { n: farmTotals.faultHouses }) : ''

  if (isLoadingHouses) {
    return <LoadingSkeleton count={4} className="h-32 w-full" />
  }

  if (isHousesError) {
    return (
      <EmptyState
        title={t('page.zoneErrorTitle')}
        description={t('page.zoneErrorDesc')}
        action={<Button variant="secondary" onClick={refetchHouses}>{t('log.retry')}</Button>}
      />
    )
  }

  // Bộ lọc nhà yến chung: đổi phạm vi là mọi khối (SCADA, cảm biến, điều khiển, đếm chim, mật độ tổ, nhật ký) lọc theo
  const houseFilter = <ScopeFilter scope={scope} />

  // Phạm vi đang lọc chưa có nhà: vẫn giữ khung lọc để chọn trang trại khác
  if (houses.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <HeaderActions>
          <div className="hidden sm:block">{houseFilter}</div>
        </HeaderActions>
        <div className="sm:hidden">{houseFilter}</div>
        <EmptyState
          title={farmId ? t('page.noHouseInFarmTitle') : t('page.noZoneTitle')}
          description={farmId ? t('page.noHouseInFarmDesc') : t('page.noZoneDesc')}
          action={
            <Link to="/farms">
              <Button>{t('page.goFarms')}</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const controlAnomalies = control.thresholds ? getAnomalies(control.readings, control.thresholds) : undefined

  // Đổi Zone ở 1 khung: đang đồng bộ thì khung kia đổi theo, header đang lọc 1 Zone thì header cũng đổi theo
  const changeLinkedZone = (zoneId: string) => {
    setEnvZoneChoice(zoneId)
    setControlZoneChoice(zoneId)
    if (scopeZone) scope.setZoneId(zoneId)
  }
  const handleEnvZoneChange = (zoneId: string) => {
    if (isZoneLinked) changeLinkedZone(zoneId)
    else setEnvZoneChoice(zoneId)
  }
  const handleControlZoneChange = (zoneId: string) => {
    if (isZoneLinked) changeLinkedZone(zoneId)
    else setControlZoneChoice(zoneId)
  }
  // Bật đồng bộ từ khung nào thì khung kia (và header nếu đang lọc 1 Zone) nhảy theo Zone của khung đó; tắt thì mỗi khung giữ Zone đang xem
  const handleToggleLink = (sourceZoneId: string | undefined) => {
    if (sourceZoneId && !isZoneLinked) changeLinkedZone(sourceZoneId)
    if (sourceZoneId && isZoneLinked) {
      setEnvZoneChoice(sourceZoneId)
      setControlZoneChoice(sourceZoneId)
    }
    setIsZoneLinked(linked => !linked)
  }
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
              <EcoHealthCard houses={houses} />
            </div>
          </div>

          <SensorAlertLogTable farmId={farmId} houseId={houseId} zones={scopedZones} deviceNames={deviceNames} />
        </>
      ) : (
        <>
          <EnvSensorPanel
            zone={envZone}
            isLinked={isZoneLinked && hasPanelZonePicker}
            scopeControl={hasPanelZonePicker && (
              <ZoneScopeControl
                zones={zones}
                value={envZone?._id ?? ''}
                onChange={handleEnvZoneChange}
                issueZoneIds={issueZoneIds}
                isLinked={isZoneLinked}
                onToggleLink={() => handleToggleLink(envZone?._id)}
                partner="control"
              />
            )}
          />

          {/* Khối điều khiển 3 relay, bên phải là sản lượng thu hoạch của nhà (ẩn nếu role không xem được thu hoạch) */}
          <div className={cn('grid grid-cols-1 gap-5', houseNode && canViewHarvest && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
            <ControlSubsystemPanel
              zoneName={controlZone?.name ?? houseName}
              relayStates={control.relayStates}
              controlMode={control.controlMode}
              controlOutput={control.controlOutput}
              tooHot={controlAnomalies?.tooHot ?? false}
              isLinked={isZoneLinked && hasPanelZonePicker}
              onOpenDetail={canControlRelay ? () => navigate(SCADA_PATH) : undefined}
              scopeControl={hasPanelZonePicker && (
                <ZoneScopeControl
                  zones={zones}
                  value={controlZone?._id ?? ''}
                  onChange={handleControlZoneChange}
                  issueZoneIds={issueZoneIds}
                  isLinked={isZoneLinked}
                  onToggleLink={() => handleToggleLink(controlZone?._id)}
                  partner="env"
                />
              )}
            />
            {houseNode && canViewHarvest && <HouseHarvestCard node={houseNode} />}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* Camera cửa thu chim của nhà đang lọc, số đếm chi tiết ở trang Giám sát đàn chim */}
            <LiveCameraCard
              houseId={houseId}
              houseName={houseName}
              action={
                <Link to="/vision" className="shrink-0 text-xs font-semibold text-graphite hover:text-charcoal">
                  {t('camera.viewVision')}
                </Link>
              }
            />
            <NestingDensityCard houseId={houseId} houseName={houseName} />
          </div>

          <SensorAlertLogTable
            farmId={farmId}
            houseId={houseId}
            zones={scopedZones}
            deviceNames={deviceNames}
            houseAlertsId={scopeZone ? '' : houseId}
          />
        </>
      )}
    </div>
  )
}
