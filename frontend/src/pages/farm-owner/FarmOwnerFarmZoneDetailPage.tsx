import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRightIcon, CubeIcon, PlusIcon, SlidersHorizontalIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import ThresholdMetricCard from '@/components/features/farm-owner/farms/ThresholdMetricCard'
import DeviceListTable from '@/components/features/farm-owner/farms/DeviceListTable'
import DeviceDetailDrawer from '@/components/features/farm-owner/farms/DeviceDetailDrawer'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { ZONE_METRICS, thresholdRange, type MetricMeta, CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { detectBreaches, type DeviceRow, type ZoneMetrics } from '@/components/features/farm-owner/farms/farmStructure'
import { useFarmStructure } from '@/hooks/farm-owner/useFarmStructure'
import { useTelemetry } from '@/hooks/farm-owner/useTelemetry'
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { usePermission } from '@/hooks/common/usePermission'
import { useT } from '@/hooks/common/useT'
import { useZoneStore } from '@/stores/zoneStore'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'

/**
 * Chi tiết 1 Zone (/farms/:farmId/houses/:houseId/zones/:zoneId): thông số realtime so với ngưỡng, danh sách thiết bị,
 * bấm "Chi tiết" mở drawer bên phải. Số đo = REST latest + socket TELEMETRY_UPDATE (useTelemetry); phần còn lại từ cây cấu trúc đã cache.
 */
export default function FarmOwnerFarmZoneDetailPage() {
  const { farmId, houseId, zoneId } = useParams<{ farmId: string; houseId: string; zoneId: string }>()
  const navigate = useNavigate()
  const { t, ago } = useT(farmDict)
  useScrollToTop(zoneId)
  const { structure, isLoading, isError, refetch } = useFarmStructure()
  const node = zoneId ? structure.zoneById.get(zoneId) : undefined
  const live = useTelemetry(zoneId)
  const isFarmOwner = usePermission('FARM_OWNER')
  const setZone = useZoneStore(s => s.setZone)
  const [selected, setSelected] = useState<DeviceRow | null>(null)

  usePageBack(`/farms/${farmId}/houses/${houseId}`, node?.house.name ?? t('page.house'))
  usePageBreadcrumb(
    node
      ? [{ label: node.house.name, onClick: () => navigate(`/farms/${farmId}/houses/${houseId}`) }, { label: node.zone.name }]
      : [],
  )

  const d = live.data
  const metrics = useMemo<ZoneMetrics>(
    () => ({ temperature: d.temperature, humidity: d.humidity, light: d.light_lux, nh3: d.nh3_ppm, co2: d.co2_ppm, sound: d.sound_db }),
    [d.temperature, d.humidity, d.light_lux, d.nh3_ppm, d.co2_ppm, d.sound_db],
  )
  const breaches = useMemo(() => (node ? detectBreaches(metrics, node.zone.thresholds) : []), [metrics, node])
  const breached = useMemo(() => new Set<string>(breaches.map(b => b.metric)), [breaches])

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

  const { zone, farm } = node
  const health = breaches.length > 0 || node.alerts.length > 0 || node.counts.offline > 0 ? 'ALERT' : 'NORMAL'
  const zoneNameById = new Map([[zone._id, zone.name]])
  const lastBatch = node.lastBatch

  // Trạng thái tín hiệu theo đúng nguồn số đo: socket đang về / socket ngừng / chỉ có bản ghi REST gần nhất / chưa có gì
  const liveLabel = live.isLive
    ? `${t('zone.live')} · ${ago(d.timestamp)}`
    : live.hasEverReceived
      ? `${t('zone.stale')} · ${ago(d.timestamp)}`
      : d.timestamp ? t('zone.lastReading', { ago: ago(d.timestamp) }) : t('zone.noSignal')

  const goTo = (path: string) => { setZone(farm._id, farm.name, zone._id, zone.name); navigate(path) }
  const metricProps = (m: MetricMeta) => ({
    meta: m,
    value: metrics[m.key],
    range: thresholdRange(m.key, zone.thresholds),
    isAnomaly: breached.has(m.key),
  })

  return (
    <div className="flex flex-col gap-6">
      <FarmFrame
        title={<>{zone.name}<HealthBadge health={health} /></>}
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-warmGray">
            <span>{node.house.name} · {t('zone.floor', { n: zone.floor })}</span>
            <span>{t('card.devicesOnline', { online: node.counts.online, total: node.counts.total })}</span>
            <span className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', live.isLive ? 'animate-pulse bg-success' : 'bg-gray-400')} />
              {liveLabel}
            </span>
          </div>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => goTo('/devices')}>
              <SlidersHorizontalIcon size={14} />
              {t('zone.thresholds')}
            </Button>
            {isFarmOwner && (
              <Button size="sm" className="h-9 text-xs" onClick={() => goTo('/dashboard')}>
                <CubeIcon size={14} />
                {t('zone.plc')}
                <ArrowRightIcon size={12} weight="bold" />
              </Button>
            )}
          </div>
        }
      />

      <FarmFrame title={t('zone.metricsTitle')} description={t('zone.metricsDesc')}>
        {live.isError && !live.hasEverReceived ? (
          <EmptyState title={t('zone.noData')} description={t('zone.noDataDesc')} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {ZONE_METRICS.map(m => <ThresholdMetricCard key={m.key} {...metricProps(m)} />)}
          </div>
        )}
      </FarmFrame>

      <FarmFrame
        title={t('zone.devicesTitle', { n: node.devices.length })}
        description={t('zone.devicesDesc')}
        action={
          <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => navigate('/tickets')}>
            <PlusIcon size={14} weight="bold" />
            {t('zone.requestInstall')}
          </Button>
        }
      >
        <DeviceListTable devices={node.devices} zoneNameById={zoneNameById} onSelect={setSelected} />
      </FarmFrame>

      <FarmFrame
        title={t('zone.harvestTitle')}
        description={lastBatch
          ? t('zone.lastHarvest', { zone: zone.name, nests: lastBatch.nest_count, grams: lastBatch.weight_grams })
          : t('zone.noHarvest', { zone: zone.name })}
        action={
          <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => navigate('/harvests')}>
            {t('zone.viewHarvest')}
            <ArrowRightIcon size={12} weight="bold" />
          </Button>
        }
      />

      <DeviceDetailDrawer device={selected} zoneNode={{ ...node, metrics, breaches }} onClose={() => setSelected(null)} />
    </div>
  )
}
