import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CpuIcon, MapPinIcon, PlusIcon, SquaresFourIcon, UserIcon, UsersThreeIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import ZoneCard from '@/components/features/farm-owner/farms/ZoneCard'
import HouseProductionCard from '@/components/features/farm-owner/farms/HouseProductionCard'
import HouseStageCard from '@/components/features/farm-owner/farms/HouseStageCard'
import AttentionDevicesCard from '@/components/features/farm-owner/farms/AttentionDevicesCard'
import DeviceListTable from '@/components/features/farm-owner/farms/DeviceListTable'
import DeviceDetailDrawer from '@/components/features/farm-owner/farms/DeviceDetailDrawer'
import FarmMembersManager from '@/components/features/farm-owner/farms/FarmMembersManager'
import AddZoneModal from '@/components/features/farm-owner/farms/AddZoneModal'
import HouseOpsMetricsCard from '@/components/features/farm-owner/work-orders/HouseOpsMetricsCard'
import StructureEditModal from '@/components/features/farm-owner/farms/StructureEditModal'
import ActionsMenu from '@/components/ui/ActionsMenu'
import { NO_VALUE } from '@/constants/display'
import { useFarmStructure, useHouseStaff, useHouseZoneIds } from '@/hooks/farm-owner/useFarmStructure'
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { usePermission } from '@/hooks/common/usePermission'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { DeviceRow, ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import { FARMS_PATH, useFarmsScopeRouting, useScopeFilter } from '@/hooks/shared/useScopeFilter'
import { UP_FROM_CHILD_STATE } from '@/lib/navigationState'
import { useZoneStore } from '@/stores/zoneStore'

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
  const pageHouses = useMemo(() => (node ? [node.house] : []), [node])
  const staffByHouse = useHouseStaff(pageHouses)
  // FARM-FR-002 — chỉ Farm Owner tạo Zone
  const isFarmOwner = usePermission('FARM_OWNER')
  // OPS-FR-009 — MTTA, MTTR: Farm Owner và Domain Expert (kỹ thuật viên nhận 403)
  const canViewOpsMetrics = usePermission('FARM_OWNER', 'DOMAIN_EXPERT')
  // FARM-FR-014 — Farm Owner và Domain Expert đổi giai đoạn nhà (Report 3 §2.4)
  const canSetStage = canViewOpsMetrics

  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'devices' ? 'devices' : 'overview')
  const [showAddZone, setShowAddZone] = useState(false)
  const [selected, setSelected] = useState<DeviceRow | null>(null)
  // Đổi tên / xoá nhà (giao diện dựng sẵn, chờ API backend)
  const [editMode, setEditMode] = useState<'rename' | 'delete' | null>(null)
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

  // Gom thiết bị của nhà trong 1 lượt duyệt: tất cả / không online
  const { devices, problems, zoneNameById, zoneById } = useMemo(() => {
    const devices: DeviceRow[] = []
    const problems: DeviceRow[] = []
    const zoneNameById = new Map<string, string>()
    const zoneById = new Map<string, ZoneNode>()
    for (const z of node?.zones ?? []) {
      zoneNameById.set(z.zone._id, z.zone.name)
      zoneById.set(z.zone._id, z)
      for (const d of z.devices) {
        devices.push(d)
        if (d.status !== 'ONLINE') problems.push(d)
      }
    }
    // Camera gắn cả nhà (SRS v2.1.8): cột Zone ghi "Cả nhà"
    zoneNameById.set('', t('device.wholeHouse'))
    for (const d of node?.cameraDevices ?? []) {
      devices.push(d)
      if (d.status !== 'ONLINE') problems.push(d)
    }
    return { devices, problems, zoneNameById, zoneById }
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
  const returnRateDrop = house.bird_count_tuning?.return_rate_drop_pct
  const staff = staffByHouse.get(house._id)

  const houseTabs: Array<{ key: Tab; label: string; icon: typeof CpuIcon }> = [
    { key: 'overview', label: t('tab.overview'), icon: SquaresFourIcon },
    { key: 'devices', label: `${t('tab.devices')} ${node.counts.online}/${node.counts.total}`, icon: CpuIcon },
    { key: 'members', label: t('house.members'), icon: UsersThreeIcon },
  ]

  return (
    <div className="flex flex-col gap-6">
      {scopeFilter}
      <FarmFrame
        title={<>{house.name}<HealthBadge health={node.health} /></>}
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-warmGray">
            <span className="flex items-center gap-1"><MapPinIcon size={14} />{farm.address}</span>
            <span className="flex items-center gap-1">
              <UserIcon size={14} />
              {t('house.staff')}: {staff ? <strong className="text-charcoal">{staff.name}</strong> : <span>{t('card.noStaff')}</span>}
            </span>
          </div>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isFarmOwner && (
              <ActionsMenu
                items={[
                  { label: t('structure.rename', { target: t('structure.house') }), onClick: () => setEditMode('rename') },
                  { label: t('structure.delete', { target: t('structure.house') }), onClick: () => setEditMode('delete'), danger: true },
                ]}
              />
            )}
          </div>
        }
      />

      {/* Tab của trang nhà: 3 ô bằng nhau, kiểu SectionTabs (pill trắng trên nền xám, C-03) */}
      <div role="tablist" aria-label={house.name} className="grid grid-cols-3 gap-1 rounded-full bg-warmGray/10 p-1">
        {houseTabs.map(item => {
          const isActive = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(item.key)}
              className={cn(
                'flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal',
                isActive ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
              )}
            >
              <item.icon size={20} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Mỗi tab cao đúng nội dung, không chừa khoảng trống dưới chân trang */}
      <div>
        {tab === 'overview' ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-w-0 flex-col gap-6">
              {/* flex-1: khung Zone giãn cho đáy cột trái thẳng đáy cột phải */}
              <FarmFrame
                className="flex-1"
                title={t('house.zoneList', { n: node.zones.length })}
                description={t('house.zoneListDesc')}
                action={isFarmOwner && (
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
              </FarmFrame>

              {/* Cài đặt đàn chim của cả nhà, đặt dưới danh sách Zone (cột trái còn trống) để cột phải không quá dài */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <HouseStageCard house={house} canEdit={canSetStage} />
                {/* EXPERT-FR-008 — mức giảm tỷ lệ chim về của nhà do chuyên gia đặt, chủ nhà yến chỉ xem */}
                <FarmFrame title={t('tuning.birdTitle')} description={t('tuning.birdDesc')}>
                  <div className="rounded-2xl border border-warmGray/15 bg-white p-4">
                    <p className="label-caption">{t('tuning.birdDrop')}</p>
                    <p className={cn('mt-2 text-2xl font-extrabold leading-none tracking-tight', returnRateDrop === undefined ? 'text-warmGray' : 'text-charcoal')}>
                      {returnRateDrop === undefined ? NO_VALUE : `${returnRateDrop}%`}
                    </p>
                    <p className="mt-1.5 text-small font-medium text-warmGray">{t('tuning.birdDropHint')}</p>
                  </div>
                </FarmFrame>
              </div>
            </div>

            {/* Khung cuối giãn khi cột trái cao hơn, 2 cột luôn bằng đáy */}
            <aside className="flex flex-col gap-6 [&>*:last-child]:flex-1">
              {canViewHarvest && <HouseProductionCard node={node} recent={node.recent} />}
              <AttentionDevicesCard counts={node.counts} problems={problems} zoneNameById={zoneNameById} onSelect={setSelected} />
              {canViewOpsMetrics && <HouseOpsMetricsCard farmId={farm._id} houseId={house._id} />}
            </aside>
          </div>
        ) : tab === 'members' ? (
          <FarmMembersManager farmId={farm._id} houseId={house._id} />
        ) : (
          <FarmFrame title={t('house.devicesTitle', { n: devices.length })} description={t('zone.devicesDesc')}>
            <DeviceListTable devices={devices} zoneNameById={zoneNameById} onSelect={setSelected} />
          </FarmFrame>
        )}
      </div>

      <AddZoneModal open={showAddZone} onClose={() => setShowAddZone(false)} houseId={house._id} />
      {editMode && <StructureEditModal kind="house" mode={editMode} name={house.name} deviceCount={node.counts.total} existingNames={structure.houses.map(item => item.house.name)} onClose={() => setEditMode(null)} />}
      <DeviceDetailDrawer device={selected} zoneNode={selected ? zoneById.get(selected.zoneId) : undefined} onClose={() => setSelected(null)} />
      {/* Yêu cầu lắp đặt / báo lỗi mở ngay tại trang, gửi xong popup báo kết quả */}
    </div>
  )
}
