import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { PlusIcon, SlidersHorizontalIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import ThresholdMetricCard from '@/components/features/farm-owner/farms/ThresholdMetricCard'
import DeviceListTable from '@/components/features/farm-owner/farms/DeviceListTable'
import DeviceDetailDrawer from '@/components/features/farm-owner/farms/DeviceDetailDrawer'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { useOpenZoneTuning } from '@/hooks/shared/useOpenZoneTuning'
import DetectionTuningCard from '@/components/features/farm-owner/farms/DetectionTuningCard'
import StructureEditModal from '@/components/features/farm-owner/farms/StructureEditModal'
import ActionsMenu from '@/components/ui/ActionsMenu'
import { ZONE_METRICS, thresholdRange, type MetricMeta } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { detectBreaches, type DeviceRow, type ZoneMetrics } from '@/components/features/farm-owner/farms/farmStructure'
import { useFarmStructure } from '@/hooks/farm-owner/useFarmStructure'
import { useTelemetry } from '@/hooks/farm-owner/useTelemetry'
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useZoneStore } from '@/stores/zoneStore'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import { useFarmsScopeRouting, useScopeFilter } from '@/hooks/shared/useScopeFilter'
import { UP_FROM_CHILD_STATE } from '@/lib/navigationState'
import { DEVICE_SETUP_PATH, type DeviceSetupState } from '@/components/features/farm-owner/onboarding/deviceSetupState'
import { DEVICE_SETUP_ROLES } from '@/constants/roles'
import { printQrLabels, zoneCode } from '@/lib/qrCode'

// Chi tiết 1 Zone: số đo realtime so ngưỡng
export default function FarmOwnerFarmZoneDetailPage() {
  const { farmId, houseId, zoneId } = useParams<{ farmId: string; houseId: string; zoneId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, ago } = useTranslation(farmDict)
  useScrollToTop(zoneId)
  const { structure, isLoading, isError, canViewHarvest, refetch } = useFarmStructure()
  const node = zoneId ? structure.zoneById.get(zoneId) : undefined
  const live = useTelemetry(zoneId)
  const isFarmOwner = usePermission('FARM_OWNER')
  const canSetUpDevice = usePermission(...DEVICE_SETUP_ROLES)
  const setScopePath = useZoneStore(state => state.setScopePath)
  // Khung lọc khớp Zone đang xem; đổi lựa chọn thì sang trang đúng cấp
  const scope = useScopeFilter()
  const routedScope = useFarmsScopeRouting(scope)
  const farmName = node?.farm.name ?? ''
  useEffect(() => {
    if (farmId && houseId && zoneId) setScopePath(farmId, farmName, houseId, zoneId)
  }, [farmId, houseId, zoneId, farmName, setScopePath])
  const [selected, setSelected] = useState<DeviceRow | null>(null)
  // Ngưỡng của Zone chỉ sửa ở /domain-expert/tuning
  const openZoneTuning = useOpenZoneTuning()
  // Đổi tên / xoá Zone (giao diện dựng sẵn, chờ API backend)
  const [editMode, setEditMode] = useState<'rename' | 'delete' | null>(null)

  usePageBack(`/farms/${farmId}/houses/${houseId}`, node?.house.name ?? t('page.house'))
  usePageBreadcrumb(
    node
      ? [{ label: node.house.name, onClick: () => navigate(`/farms/${farmId}/houses/${houseId}`) }, { label: node.zone.name }]
      : [],
    UP_FROM_CHILD_STATE,
  )

  const d = live.data
  const metrics = useMemo<ZoneMetrics>(
    () => ({ temperature: d.temperature, humidity: d.humidity, light: d.light_lux, nh3: d.nh3_ppm, co2: d.co2_ppm, sound: d.sound_db }),
    [d.temperature, d.humidity, d.light_lux, d.nh3_ppm, d.co2_ppm, d.sound_db],
  )
  const breaches = useMemo(() => (node ? detectBreaches(metrics, node.zone.thresholds) : []), [metrics, node])
  const breached = useMemo(() => new Set<string>(breaches.map(breach => breach.metric)), [breaches])

  if (isError) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title={t('state.errorTitle')}
        description={t('state.errorDesc')}
        action={<Button variant="secondary" size="sm" onClick={refetch}>{t('state.retry')}</Button>}
      />
    )
  }
  if (isLoading) return <LoadingSkeleton count={3} className="h-40 w-full" />
  if (!node) return <EmptyState title={t('zone.notFound')} description={t('zone.notFoundDesc')} />

  const { zone } = node
  const health = breaches.length > 0 || node.alerts.length > 0 || node.counts.offline > 0 ? 'ALERT' : 'NORMAL'
  const lastBatch = node.lastBatch
  // Tên Zone đã là "Tầng N" thì không ghi lại tầng
  const floorLabel = t('zone.floor', { n: zone.floor })
  const houseLine = zone.name.trim() === floorLabel ? node.house.name : `${node.house.name} · ${floorLabel}`

  // Trạng thái tín hiệu theo nguồn số đo
  const liveLabel = live.isLive
    ? `${t('zone.live')} · ${ago(d.timestamp)}`
    : live.hasEverReceived
      ? `${t('zone.stale')} · ${ago(d.timestamp)}`
      : d.timestamp ? t('zone.lastReading', { ago: ago(d.timestamp) }) : t('zone.noSignal')

  const metricProps = (m: MetricMeta) => ({
    meta: m,
    value: metrics[m.key],
    range: thresholdRange(m.key, zone.thresholds),
    isAnomaly: breached.has(m.key),
  })

  return (
    <div className="flex flex-col gap-6">
      <HeaderActions>
        <ScopeFilter scope={routedScope} />
      </HeaderActions>
      <FarmFrame
        title={<>{zone.name}<HealthBadge health={health} /></>}
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-warmGray">
            <span>{houseLine}</span>
            <span className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', live.isLive ? 'animate-pulse bg-success' : 'bg-gray-400')} />
              {liveLabel}
            </span>
            {canViewHarvest && lastBatch && <span>{t('zone.harvestLine', { nests: lastBatch.nest_count, grams: lastBatch.weight_grams })}</span>}
          </div>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isFarmOwner && (
              <Button variant="secondary" size="sm" disabled={!openZoneTuning} onClick={() => node && openZoneTuning?.(node.zone._id)}>
                <SlidersHorizontalIcon size={14} />
                {t('zone.thresholds')}
              </Button>
            )}
            {isFarmOwner && (
              <ActionsMenu
                items={[
                  // mã chỉ chứa zone ID, in ra để dán ở tầng
                  {
                    label: t('zone.printFloorCode'),
                    onClick: () => void printQrLabels(zone.name, [{
                      code: zoneCode(zone._id),
                      lines: [
                        { text: 'SwiftletCare', strong: true },
                        { text: node.house.name },
                        { text: `${floorLabel} · ${zone.name}`, strong: true },
                        { text: t('zone.floorCodeHint') },
                      ],
                    }]),
                  },
                  { label: t('structure.rename', { target: t('structure.zone') }), onClick: () => setEditMode('rename') },
                  { label: t('structure.delete', { target: t('structure.zone') }), onClick: () => setEditMode('delete'), danger: true },
                ]}
              />
            )}
          </div>
        }
      />

      <FarmFrame title={t('zone.metricsTitle')} help={t('zone.metricsDesc')}>
        {live.isError && !live.hasEverReceived ? (
          <EmptyState title={t('zone.noData')} description={t('zone.noDataDesc')} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {ZONE_METRICS.map(metric => <ThresholdMetricCard key={metric.key} {...metricProps(metric)} />)}
          </div>
        )}
      </FarmFrame>

      {/* tham số phát hiện chuyên gia đặt cho Zone, chủ nhà yến chỉ xem */}
      <DetectionTuningCard tuning={zone.detection_tuning} />

      <FarmFrame
        title={t('zone.devicesTitle', { n: node.devices.length })}
        help={t('zone.devicesDesc')}
        action={canSetUpDevice && farmId && houseId && zoneId && (
          // Mở thiết lập với vị trí của Zone này đã chọn sẵn
          <Button size="sm" onClick={() => navigate(DEVICE_SETUP_PATH, { state: { location: { farmId, houseId, zoneId }, returnTo: location.pathname } satisfies DeviceSetupState })}>
            <PlusIcon size={14} weight="bold" />
            {t('zone.setupDevice')}
          </Button>
        )}
      >
        <DeviceListTable devices={node.devices} onSelect={setSelected} />
      </FarmFrame>

      <DeviceDetailDrawer device={selected} zoneNode={{ ...node, metrics, breaches }} onClose={() => setSelected(null)} />
      {editMode && <StructureEditModal kind="zone" mode={editMode} id={node.zone._id} onDeleted={() => navigate(`/farms/${farmId}/houses/${houseId}`)} name={node.zone.name} deviceCount={node.counts.total} existingNames={structure.houseById.get(node.house._id)?.zones.map(item => item.zone.name) ?? []} onClose={() => setEditMode(null)} />}
    </div>
  )
}
