import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import StructureEditModal from '@/components/features/farm-owner/farms/StructureEditModal'
import ActionsMenu from '@/components/ui/ActionsMenu'
import { NO_VALUE } from '@/constants/display'
import { useRegions } from '@/hooks/shared/useFarms'
import { useFarmStructure, useHouseZoneIds, useStructureExtras } from '@/hooks/farm-owner/useFarmStructure'
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { usePermission } from '@/hooks/common/usePermission'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { DeviceRow, ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'
import CreateSupportTicketModal, { type CreateSupportDefaults } from '@/components/features/farm-owner/tickets/CreateSupportTicketModal'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import { FARMS_PATH, useFarmsScopeRouting, useScopeFilter } from '@/hooks/farm-owner/useScopeFilter'
import { UP_FROM_CHILD_STATE } from '@/lib/navigationState'
import { useZoneStore } from '@/stores/zoneStore'

/** Khung nội dung cao CỨNG (px) cho mọi tab — tab Tổng quan (cột phải ~880px) là cao nhất, tải lại hay đổi tab trang không đổi chiều cao */
const TAB_MIN_HEIGHT = 880

type Tab = 'overview' | 'devices' | 'members'

// Chi tiết 1 nhà yến: Zone realtime, sản lượng tháng, thiết bị cần chú ý; bấm Zone mở chi tiết Zone, bấm thiết bị mở drawer
export default function FarmOwnerFarmZonesPage() {
  const { farmId, houseId } = useParams<{ farmId: string; houseId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation(farmDict)
  useScrollToTop(houseId)
  const liveZoneIds = useHouseZoneIds(houseId)
  const { structure, isLoading, isError, metricsLoading, canViewHarvest, refetch } = useFarmStructure({ liveZoneIds })
  const node = houseId ? structure.houseById.get(houseId) : undefined
  const { data: extras } = useStructureExtras(houseId ? [houseId] : [])
  const canManage = usePermission('FARM_OWNER', 'TECHNICIAN', 'ADMIN')
  // Ticket của Farm Owner ở /support (mở sẵn form lắp đặt); Technician/Admin vẫn dùng màn /tickets
  const isFarmOwner = usePermission('FARM_OWNER')

  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'devices' ? 'devices' : 'overview')
  const [showAddZone, setShowAddZone] = useState(false)
  const [selected, setSelected] = useState<DeviceRow | null>(null)
  // Đổi tên / xoá nhà (giao diện dựng sẵn, chờ API backend)
  const [editMode, setEditMode] = useState<'rename' | 'delete' | null>(null)
  // Popup yêu cầu hỗ trợ mở tại chỗ (không chuyển sang trang Yêu cầu hỗ trợ); undefined = đóng
  const [supportDefaults, setSupportDefaults] = useState<CreateSupportDefaults>()
  const { data: regions } = useRegions()
  // Khung lọc khớp nhà đang xem; đổi lựa chọn thì sang trang đúng cấp
  const scope = useScopeFilter()
  const routedScope = useFarmsScopeRouting(scope)
  const setScopePath = useZoneStore(state => state.setScopePath)
  const farmName = node?.farm.name ?? ''
  useEffect(() => {
    if (farmId && houseId) setScopePath(farmId, farmName, houseId, '')
  }, [farmId, houseId, farmName, setScopePath])
  const scopeFilter = (
    <>
      <HeaderActions>
        <div className="hidden sm:block">
          <ScopeFilter scope={routedScope} />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={routedScope} />
      </div>
    </>
  )

  usePageBack(FARMS_PATH, t('page.farms'), UP_FROM_CHILD_STATE)
  usePageBreadcrumb(node ? [{ label: node.house.name }] : [], UP_FROM_CHILD_STATE)

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
    // Camera gắn cả nhà (SRS v2.1.8): cột Zone ghi "Cả nhà"
    zoneNameById.set('', t('device.wholeHouse'))
    for (const d of node?.cameraDevices ?? []) {
      devices.push(d)
      if (d.status !== 'ONLINE') problems.push(d)
      camera ??= d
    }
    return { devices, problems, camera, zoneNameById, zoneById }
  }, [node, t])

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
  // Hiện tên tỉnh / thành thay cho mã khu vực (swagger GET /farms/regions)
  const regionName = farm.region ? regions?.find(region => region.code === farm.region)?.name ?? NO_VALUE : ''
  const returnRateDrop = house.bird_count_tuning?.return_rate_drop_pct
  const staff = extras?.houseStaff[house._id]

  return (
    <div className="flex flex-col gap-6">
      {scopeFilter}
      <FarmFrame
        title={<>{house.name}<HealthBadge health={node.health} /></>}
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-warmGray">
            <span className="flex items-center gap-1"><MapPinIcon size={14} />{farm.address}{regionName ? ` · ${regionName}` : ''}</span>
            <span className="flex items-center gap-1">
              <UserIcon size={14} />
              {t('house.staff')}: {staff ? <strong className="text-charcoal">{staff.name}</strong> : <span>{t('card.noStaff')}</span>}
            </span>
          </div>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-9 text-xs" onClick={() => (isFarmOwner ? setSupportDefaults({ kind: 'install', farmId }) : navigate('/tickets'))}>
              <PlusIcon size={14} weight="bold" />
              {t('house.requestInstall')}
            </Button>
            {isFarmOwner && (
              <ActionsMenu
                items={[
                  { label: t('structure.rename'), onClick: () => setEditMode('rename') },
                  { label: t('structure.delete'), onClick: () => setEditMode('delete'), danger: true },
                ]}
              />
            )}
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
                  {node.zones.map(zone => (
                    <ZoneCard
                      key={zone.zone._id}
                      node={zone}
                      loadingMetrics={metricsLoading}
                      onOpen={() => navigate(`/farms/${farmId}/houses/${houseId}/zones/${zone.zone._id}`)}
                    />
                  ))}
                </div>
              )}
              <AiAdviceCard houseId={house._id} camera={camera} />
            </FarmFrame>

            <aside className="flex flex-col gap-6">
              {canViewHarvest && <HouseProductionCard node={node} recent={node.recent} nextHarvestAt={extras?.nextHarvest[house._id]} />}
              <AttentionDevicesCard counts={node.counts} problems={problems} zoneNameById={zoneNameById} onSelect={setSelected} />
              {/* EXPERT-FR-008 — mức giảm tỷ lệ chim về của nhà do chuyên gia đặt, chủ nhà yến chỉ xem */}
              <FarmFrame title={t('tuning.birdTitle')} description={t('tuning.birdDesc')}>
                <div className="rounded-2xl border border-warmGray/15 bg-white p-4">
                  <p className="label-caption">{t('tuning.birdDrop')}</p>
                  <p className={cn('mt-2 text-2xl font-extrabold leading-none tracking-tight', returnRateDrop === undefined ? 'text-warmGray' : 'text-charcoal')}>
                    {returnRateDrop === undefined ? NO_VALUE : `${returnRateDrop}%`}
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium text-warmGray">{t('tuning.birdDropHint')}</p>
                </div>
              </FarmFrame>
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
      {editMode && <StructureEditModal kind="house" mode={editMode} name={house.name} deviceCount={node.counts.total} existingNames={structure.houses.map(item => item.house.name)} onClose={() => setEditMode(null)} />}
      <DeviceDetailDrawer device={selected} zoneNode={selected ? zoneById.get(selected.zoneId) : undefined} onClose={() => setSelected(null)} />
      {/* Yêu cầu lắp đặt / báo lỗi mở ngay tại trang, gửi xong popup báo kết quả */}
      <CreateSupportTicketModal open={supportDefaults !== undefined} defaults={supportDefaults} onClose={() => setSupportDefaults(undefined)} />
    </div>
  )
}
