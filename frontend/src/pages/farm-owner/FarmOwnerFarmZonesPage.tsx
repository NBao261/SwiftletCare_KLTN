import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapPinIcon, PlusIcon, UserIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState, FilterChip } from '@/components/ui'
import StableHeight from '@/components/ui/StableHeight'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import ZoneCard from '@/components/features/farm-owner/farms/ZoneCard'
import HouseProductionCard from '@/components/features/farm-owner/farms/HouseProductionCard'
import AttentionDevicesCard from '@/components/features/farm-owner/farms/AttentionDevicesCard'
import AiAdviceCard from '@/components/features/farm-owner/farms/AiAdviceCard'
import DeviceListTable from '@/components/features/farm-owner/farms/DeviceListTable'
import DeviceDetailDrawer from '@/components/features/farm-owner/farms/DeviceDetailDrawer'
import FarmMembersManager from '@/components/features/farm-owner/farms/FarmMembersManager'
import AddZoneModal from '@/components/features/farm-owner/farms/AddZoneModal'
import { useFarmStructure, useHouseZoneIds, useStructureExtras } from '@/hooks/farm-owner/useFarmStructure'
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { usePermission } from '@/hooks/common/usePermission'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { DeviceRow, ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'

/** Khung nội dung cao CỨNG (px) cho mọi tab — tab Tổng quan (cột phải ~880px) là cao nhất, tải lại hay đổi tab trang không đổi chiều cao */
const TAB_MIN_HEIGHT = 880

type Tab = 'overview' | 'devices' | 'members'

/**
 * Chi tiết 1 nhà yến (/farms/:farmId/houses/:houseId): danh sách Zone realtime (join socket đúng các zone của nhà này),
 * sản lượng tháng, thiết bị cần chú ý. Bấm Zone → chi tiết Zone; bấm thiết bị → drawer bên phải.
 */
export default function FarmOwnerFarmZonesPage() {
  const { farmId, houseId } = useParams<{ farmId: string; houseId: string }>()
  const navigate = useNavigate()
  const { t } = useT(farmDict)
  useScrollToTop(houseId)
  const liveZoneIds = useHouseZoneIds(houseId)
  const { structure, isLoading, isError, metricsLoading, refetch } = useFarmStructure({ liveZoneIds })
  const node = houseId ? structure.houseById.get(houseId) : undefined
  const { data: extras } = useStructureExtras(houseId ? [houseId] : [])
  const canManage = usePermission('FARM_OWNER', 'TECHNICIAN', 'ADMIN')

  const [tab, setTab] = useState<Tab>('overview')
  const [showAddZone, setShowAddZone] = useState(false)
  const [selected, setSelected] = useState<DeviceRow | null>(null)

  usePageBack('/farms', t('page.farms'))
  usePageBreadcrumb(node ? [{ label: node.house.name }] : [])

  // Gom thiết bị của nhà trong 1 lượt duyệt: tất cả / không online / camera đầu tiên
  const { devices, problems, camera, zoneNameById, zoneById } = useMemo(() => {
    const devices: DeviceRow[] = []
    const problems: DeviceRow[] = []
    const zoneNameById = new Map<string, string>()
    const zoneById = new Map<string, ZoneNode>()
    let camera: DeviceRow | undefined
    for (const z of node?.zones ?? []) {
      zoneNameById.set(z.zone._id, z.zone.name)
      zoneById.set(z.zone._id, z)
      for (const d of z.devices) {
        devices.push(d)
        if (d.status !== 'ONLINE') problems.push(d)
        if (!camera && d.type === 'camera') camera = d
      }
    }
    return { devices, problems, camera, zoneNameById, zoneById }
  }, [node])

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
  if (!node) return <EmptyState title={t('house.notFound')} description={t('house.notFoundDesc')} />

  const { house, farm } = node
  const staff = extras?.houseStaff[house._id]

  return (
    <div className="flex flex-col gap-6">
      <FarmFrame
        title={<>{house.name}<HealthBadge health={node.health} /></>}
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-warmGray">
            <span className="flex items-center gap-1"><MapPinIcon size={14} />{farm.address}{farm.region ? ` · ${farm.region}` : ''}</span>
            <span className="flex items-center gap-1">
              <UserIcon size={14} />
              {t('house.staff')}: {staff ? <strong className="text-charcoal">{staff.name}</strong> : <span>{t('card.noStaff')}</span>}
            </span>
          </div>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-9 text-xs" onClick={() => navigate('/tickets')}>
              <PlusIcon size={14} weight="bold" />
              {t('house.requestInstall')}
            </Button>
          </div>
        }
      >
        <div className="flex gap-2">
          <FilterChip active={tab === 'overview'} label={t('tab.overview')} onClick={() => setTab('overview')} />
          <FilterChip active={tab === 'devices'} label={`${t('tab.devices')} ${node.counts.online}/${node.counts.total}`} onClick={() => setTab('devices')} />
          <FilterChip active={tab === 'members'} label={t('house.members')} onClick={() => setTab('members')} />
        </div>
      </FarmFrame>

      <StableHeight minHeight={TAB_MIN_HEIGHT}>
        {tab === 'overview' ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <FarmFrame
              title={t('house.zoneList', { n: node.zones.length })}
              description={t('house.zoneListDesc')}
              action={canManage && (
                <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => setShowAddZone(true)}>
                  <PlusIcon size={12} weight="bold" />
                  {t('house.addZone')}
                </Button>
              )}
            >
              {node.zones.length === 0 ? (
                <EmptyState title={t('house.noZone')} description={t('house.noZoneDesc')} />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {node.zones.map(z => (
                    <ZoneCard
                      key={z.zone._id}
                      node={z}
                      loadingMetrics={metricsLoading}
                      onOpen={() => navigate(`/farms/${farmId}/houses/${houseId}/zones/${z.zone._id}`)}
                    />
                  ))}
                </div>
              )}
              <AiAdviceCard houseId={house._id} camera={camera} />
            </FarmFrame>

            <aside className="flex flex-col gap-6">
              <HouseProductionCard node={node} recent={node.recent} nextHarvestAt={extras?.nextHarvest[house._id]} />
              <AttentionDevicesCard counts={node.counts} problems={problems} zoneNameById={zoneNameById} onSelect={setSelected} />
            </aside>
          </div>
        ) : tab === 'members' ? (
          <FarmMembersManager farmId={farm._id} />
        ) : (
          <FarmFrame title={t('house.devicesTitle', { n: devices.length })} description={t('zone.devicesDesc')}>
            <DeviceListTable devices={devices} zoneNameById={zoneNameById} onSelect={setSelected} />
          </FarmFrame>
        )}
      </StableHeight>

      <AddZoneModal open={showAddZone} onClose={() => setShowAddZone(false)} houseId={house._id} />
      <DeviceDetailDrawer device={selected} zoneNode={selected ? zoneById.get(selected.zoneId) : undefined} onClose={() => setSelected(null)} />
    </div>
  )
}
