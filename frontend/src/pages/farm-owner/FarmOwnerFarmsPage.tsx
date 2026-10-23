import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useNavigationType } from 'react-router-dom'
import { ListIcon, PlusIcon, SquaresFourIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState, FilterChip, SearchInput } from '@/components/ui'
import StableHeight from '@/components/ui/StableHeight'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import HouseKpiRow from '@/components/features/farm-owner/farms/HouseKpiRow'
import HouseCard from '@/components/features/farm-owner/farms/HouseCard'
import HouseTable from '@/components/features/farm-owner/farms/HouseTable'
import AddHouseModal from '@/components/features/farm-owner/farms/AddHouseModal'
import FarmFormModal from '@/components/features/farm-owner/farms/FarmFormModal'
import FarmGroupRow from '@/components/features/farm-owner/farms/FarmGroupRow'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import { summarizeScope } from '@/components/features/farm-owner/farms/farmStructure'
import { farmHousePath, farmZonePath, isComingFromFarmDetail, useFarmsScopeRouting, useScopeFilter } from '@/hooks/farm-owner/useScopeFilter'
import { useDeleteFarm, useFarms, useRegions } from '@/hooks/shared/useFarms'
import { usePinnedHouses } from '@/hooks/farm-owner/usePinnedHouses'
import { useFarmStructure, useStructureExtras } from '@/hooks/farm-owner/useFarmStructure'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { vnYearMonth } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { NO_VALUE } from '@/constants/display'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Farm } from '@/types'
import type { HouseHealth, HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

/** Khung kết quả cao CỨNG (px) = bảng 10 dòng × 68px + header — lưới/danh sách/trống đều chiếm đúng chừng này, tải lại hay đổi chế độ trang không đổi chiều cao */
const RESULTS_MIN_HEIGHT = 740
/** Lưới 2 cột × 2 hàng card trong mỗi trang trại; nhiều hơn thì phân trang thay vì kéo dài khung */
const GRID_PAGE_SIZE = 4

type Filter = 'all' | HouseHealth

const NO_IDS = new Set<string>()
type View = 'grid' | 'list'

// Trang trại: các farm theo khung lọc Trang trại → Nhà → Zone, bấm farm xổ các nhà yến bên trong (lưới / danh sách); sửa, xoá farm và thêm nhà ngay trên hàng farm
export default function FarmOwnerFarmsPage() {
  const { t, num } = useTranslation(farmDict)
  useScrollToTop()
  const navigate = useNavigate()
  const { data: farms } = useFarms()
  const { structure, isLoading, isError, canViewHarvest, refetch } = useFarmStructure()
  const houseIds = useMemo(() => structure.houses.map(node => node.house._id), [structure.houses])
  // Nhà đã có (kèm trang trại) để chặn tạo nhà trùng tên trong cùng trang trại
  const existingHouses = useMemo(() => structure.houses.map(node => node.house), [structure.houses])
  const { data: extras } = useStructureExtras(houseIds)
  const { pinned, toggle: togglePin } = usePinnedHouses()
  // Khung lọc chung các trang Farm Owner, lưu khi chuyển trang; chọn nhà / Zone thì sang trang chi tiết đúng cấp
  const scope = useScopeFilter()
  const routedScope = useFarmsScopeRouting(scope)
  const navigationType = useNavigationType()
  // Đo ở lần chạy effect đầu (sau khi trang chi tiết vừa rời đã dọn dẹp): đi lên từ trang chi tiết hoặc bấm Back của trình duyệt
  const isGoingUpRef = useRef<boolean | null>(null)
  const hasRoutedRef = useRef(false)
  // Chạy 1 lần khi khung lọc tải xong: đang lọc 1 nhà / Zone thì mở thẳng trang đó; đi lên từ trang chi tiết thì bỏ lọc nhà, Zone
  useEffect(() => {
    isGoingUpRef.current ??= navigationType === 'POP' || isComingFromFarmDetail()
    if (hasRoutedRef.current || scope.isLoading) return
    hasRoutedRef.current = true
    if (isGoingUpRef.current) {
      if (scope.houseId) scope.setHouseId('')
      return
    }
    if (scope.zone) navigate(farmZonePath(scope.zone.farmId, scope.zone.house_id, scope.zone._id), { replace: true })
    else if (scope.houseId && scope.farmId) navigate(farmHousePath(scope.farmId, scope.houseId), { replace: true })
  }, [scope, navigationType, navigate])
  const { data: regions } = useRegions()
  const currentUserId = useAuthStore(state => state.user?._id)
  const isAdmin = usePermission('ADMIN')
  const deleteFarm = useDeleteFarm()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()

  // Backend: POST /farms chỉ cho FARM_OWNER, ADMIN; POST /farms/:id/houses cho cả TECHNICIAN
  const canCreateFarm = usePermission('FARM_OWNER', 'ADMIN')
  const canAddHouse = usePermission('FARM_OWNER', 'TECHNICIAN', 'ADMIN')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('grid')
  // Trang lưới của từng trang trại
  const [gridPageByFarm, setGridPageByFarm] = useState<Record<string, number>>({})
  // Popup thêm nhà: null = đóng, '' = chưa chọn farm, có id = chọn sẵn farm đó
  const [addHouseFarmId, setAddHouseFarmId] = useState<string | null>(null)
  const [showCreateFarm, setShowCreateFarm] = useState(false)
  const [editFarm, setEditFarm] = useState<Farm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null)
  // Farm người dùng bấm xổ khi đang xem tất cả trang trại (mặc định thu hết)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Đang tìm / lọc / chọn farm ở khung lọc thì farm có kết quả tự xổ, trừ farm người dùng vừa thu lại (đổi điều kiện lọc thì xổ lại)
  const [collapsed, setCollapsed] = useState<{ key: string; ids: Set<string> }>({ key: '', ids: new Set() })
  const isFiltering = search.trim() !== '' || filter !== 'all'
  const isAutoExpand = isFiltering || scope.farmId !== ''
  const autoExpandKey = `${search.trim()}|${filter}|${scope.farmId}|${scope.houseId}`
  const collapsedIds = collapsed.key === autoExpandKey ? collapsed.ids : NO_IDS
  const regionNameByCode = useMemo(() => new Map((regions ?? []).map(region => [region.code, region.name])), [regions])
  const isPrimaryOf = (farm: Farm) => isAdmin || farm.owner_id === currentUserId

  // Số nhà, thiết bị và nhà đang cảnh báo của từng farm (chặn xoá farm còn thiết bị)
  const statsByFarm = useMemo(() => {
    const stats = new Map<string, { houses: number; devices: number; alertHouses: number }>()
    for (const node of structure.houses) {
      const current = stats.get(node.farm._id) ?? { houses: 0, devices: 0, alertHouses: 0 }
      stats.set(node.farm._id, {
        houses: current.houses + 1,
        devices: current.devices + node.counts.total,
        alertHouses: current.alertHouses + (node.health === 'ALERT' ? 1 : 0),
      })
    }
    return stats
  }, [structure.houses])

  // Nhà trong phạm vi khung lọc (farm, nhà); lọc Zone thì vẫn là nhà chứa Zone đó
  const scopedHouses = useMemo(
    () => structure.houses.filter(node => (!scope.farmId || node.farm._id === scope.farmId) && (!scope.houseId || node.house._id === scope.houseId)),
    [structure.houses, scope.farmId, scope.houseId],
  )
  const scopeZoneNode = scope.zone ? structure.zoneById.get(scope.zone._id) : undefined
  const scopeTotals = useMemo(() => summarizeScope(scopedHouses, scopeZoneNode), [scopedHouses, scopeZoneNode])

  // Đếm theo tình trạng + lọc/tìm kiếm trong cùng 1 lượt duyệt
  const { visible, counts } = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const counts = { all: 0, ALERT: 0, NORMAL: 0, EMPTY: 0 }
    const visible: HouseNode[] = []
    for (const node of scopedHouses) {
      counts.all += 1
      counts[node.health] += 1
      if (filter !== 'all' && node.health !== filter) continue
      if (keyword) {
        const staff = extras?.houseStaff[node.house._id]?.name ?? ''
        const haystack = `${node.house.name} ${node.farm.name} ${node.farm.address} ${staff}`.toLowerCase()
        if (!haystack.includes(keyword)) continue
      }
      visible.push(node)
    }
    // Nhà ghim sao lên đầu (giữ thứ tự cũ trong từng nhóm) — chia 2 nhóm bằng 2 lượt lọc, vẫn O(n)
    const pinnedFirst = [...visible.filter(node => pinned.has(node.house._id)), ...visible.filter(node => !pinned.has(node.house._id))]
    return { visible: pinnedFirst, counts }
  }, [scopedHouses, search, filter, extras, pinned])

  // Nhà đang hiện của từng farm (giữ thứ tự nhà ghim lên đầu)
  const visibleByFarm = useMemo(() => {
    const map = new Map<string, HouseNode[]>()
    for (const node of visible) map.set(node.farm._id, [...(map.get(node.farm._id) ?? []), node])
    return map
  }, [visible])
  // Farm tạo trước đứng trên, tạo sau nằm cuối (mã Mongo tăng theo thời gian tạo)
  const sortedFarms = useMemo(() => [...(farms ?? [])].sort((left, right) => left._id.localeCompare(right._id)), [farms])
  // Farm đang lọc ở khung lọc; đang tìm / lọc tình trạng / chọn 1 nhà thì chỉ hiện farm có nhà khớp
  const shownFarms = useMemo(
    () => sortedFarms.filter(farm => (!scope.farmId || farm._id === scope.farmId) && ((!isFiltering && !scope.houseId) || visibleByFarm.has(farm._id))),
    [sortedFarms, scope.farmId, scope.houseId, isFiltering, visibleByFarm],
  )

  const openHouse = useCallback(
    (node: HouseNode) => navigate(`/farms/${node.farm._id}/houses/${node.house._id}`),
    [navigate],
  )

  // Bật / tắt 1 phần tử trong tập (trả tập mới)
  function toggleIn(set: Set<string>, id: string): Set<string> {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  // Tất cả trang trại: thu hết, bấm farm nào mở farm đó; chọn farm / tìm / lọc thì farm có kết quả tự mở
  function isFarmExpanded(farmId: string): boolean {
    if (isAutoExpand) return !collapsedIds.has(farmId)
    return expandedIds.has(farmId)
  }

  function toggleFarm(farmId: string): void {
    if (isAutoExpand) setCollapsed({ key: autoExpandKey, ids: toggleIn(collapsedIds, farmId) })
    else setExpandedIds(current => toggleIn(current, farmId))
  }

  function handleDeleteFarm(): void {
    if (!deleteTarget) return
    deleteFarm.mutate(deleteTarget._id, {
      onSuccess: () => {
        push(t('manage.deleted', { name: deleteTarget.name }))
        setDeleteTarget(null)
      },
      onError: reason => {
        push(apiErrorMessage(reason, t('manage.deleteFailed')), 'error')
        setDeleteTarget(null)
      },
    })
  }

  // Nhà yến của 1 farm theo chế độ xem: lưới 4 card / trang hoặc bảng
  function renderHouses(farmId: string): JSX.Element {
    const houses = visibleByFarm.get(farmId) ?? []
    if (view === 'list') {
      return <HouseTable houses={houses} staffByHouse={extras?.houseStaff} pinned={pinned} showYield={canViewHarvest} onTogglePin={togglePin} onOpen={openHouse} />
    }
    // Kẹp trang lưới theo số trang còn lại khi lọc / tìm kiếm làm ít đi
    const page = Math.min(gridPageByFarm[farmId] ?? 1, Math.max(1, Math.ceil(houses.length / GRID_PAGE_SIZE)))
    const pageRows = houses.slice((page - 1) * GRID_PAGE_SIZE, page * GRID_PAGE_SIZE)
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {pageRows.map(row => (
            <HouseCard
              key={row.house._id}
              node={row}
              staff={extras?.houseStaff[row.house._id]}
              pinned={pinned.has(row.house._id)}
              showYield={canViewHarvest}
              onTogglePin={() => togglePin(row.house._id)}
              onOpen={() => openHouse(row)}
            />
          ))}
        </div>
        {houses.length > GRID_PAGE_SIZE && (
          <Pagination
            page={page}
            limit={GRID_PAGE_SIZE}
            total={houses.length}
            onChange={nextPage => setGridPageByFarm(current => ({ ...current, [farmId]: nextPage }))}
            variant="full"
          />
        )}
      </div>
    )
  }

  const monthLabel = vnYearMonth(new Date()).month

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <LoadingSkeleton count={1} className="h-28 w-full" />
        <LoadingSkeleton count={2} className="h-64 w-full" />
      </div>
    )
  }

  // Chưa có trang trại nào: mời tạo farm; có farm mà chưa có nhà thì vẫn hiện danh sách farm để thêm nhà, sửa, xoá
  if (!farms?.length) {
    return (
      <>
        <EmptyState
          title={t('empty.noFarmTitle')}
          description={t('empty.noFarmDesc')}
          action={canCreateFarm ? <Button onClick={() => setShowCreateFarm(true)}>+ {t('empty.createFarm')}</Button> : undefined}
        />
        {showCreateFarm && <FarmFormModal onClose={() => setShowCreateFarm(false)} />}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Khung lọc nằm trên header từ sm trở lên; mobile header chật nên đặt đầu trang */}
      <HeaderActions>
        <div className="hidden sm:block">
          <ScopeFilter scope={routedScope} />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={routedScope} />
      </div>

      <HouseKpiRow totals={scopeTotals} monthLabel={monthLabel} showYield={canViewHarvest} />

      <FarmFrame
        title={t('list.title')}
        description={t('list.desc', { farms: num(shownFarms.length), n: num(scopeTotals.houses) })}
        action={(canCreateFarm || canAddHouse) && (
          <div className="flex flex-wrap items-center gap-2">
            {canCreateFarm && (
              <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => setShowCreateFarm(true)}>
                <PlusIcon size={14} weight="bold" />
                {t('empty.createFarm')}
              </Button>
            )}
            {canAddHouse && (
              <Button size="sm" className="h-9 text-xs" onClick={() => setAddHouseFarmId('')}>
                <PlusIcon size={14} weight="bold" />
                {t('toolbar.addHouse')}
              </Button>
            )}
          </div>
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] max-w-sm flex-1">
            <SearchInput placeholder={t('toolbar.search')} value={search} onChange={setSearch} />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === 'all'} label={`${t('filter.all')} ${num(counts.all)}`} onClick={() => setFilter('all')} />
            <FilterChip active={filter === 'ALERT'} label={`${t('health.alert')} ${num(counts.ALERT)}`} onClick={() => setFilter('ALERT')} />
            <FilterChip active={filter === 'NORMAL'} label={`${t('health.normal')} ${num(counts.NORMAL)}`} onClick={() => setFilter('NORMAL')} />
            <FilterChip active={filter === 'EMPTY'} label={`${t('health.empty')} ${num(counts.EMPTY)}`} onClick={() => setFilter('EMPTY')} />
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-warmGray/10 p-1" role="group" aria-label={t('toolbar.view')}>
            {([['grid', SquaresFourIcon, 'toolbar.grid'], ['list', ListIcon, 'toolbar.list']] as const).map(([key, ViewIcon, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  view === key ? 'bg-charcoal text-white' : 'text-warmGray hover:text-charcoal',
                )}
              >
                <ViewIcon size={14} weight="bold" />
                {t(label)}
              </button>
            ))}
          </div>
        </div>

        <StableHeight minHeight={RESULTS_MIN_HEIGHT}>
          {shownFarms.length === 0 ? (
            <EmptyState title={t('empty.noMatchTitle')} description={t('empty.noMatchDesc')} />
          ) : (
            // Mỗi trang trại 1 hàng, bấm để xổ các nhà yến bên trong
            <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
              {shownFarms.map(farm => {
                const stats = statsByFarm.get(farm._id) ?? { houses: 0, devices: 0, alertHouses: 0 }
                return (
                  <FarmGroupRow
                    key={farm._id}
                    farm={farm}
                    regionName={farm.region ? regionNameByCode.get(farm.region) : undefined}
                    houseCount={stats.houses}
                    deviceCount={stats.devices}
                    alertHouseCount={stats.alertHouses}
                    isExpanded={isFarmExpanded(farm._id)}
                    isPrimary={isPrimaryOf(farm)}
                    canEdit={canCreateFarm}
                    canAddHouse={canAddHouse}
                    onToggle={() => toggleFarm(farm._id)}
                    onEdit={() => setEditFarm(farm)}
                    onDelete={() => setDeleteTarget(farm)}
                    onAddHouse={() => setAddHouseFarmId(farm._id)}
                  >
                    {renderHouses(farm._id)}
                  </FarmGroupRow>
                )
              })}
            </div>
          )}
        </StableHeight>
      </FarmFrame>

      {addHouseFarmId !== null && (
        <AddHouseModal open onClose={() => setAddHouseFarmId(null)} farms={farms} existingHouses={existingHouses} initialFarmId={addHouseFarmId} />
      )}
      {showCreateFarm && <FarmFormModal onClose={() => setShowCreateFarm(false)} />}
      {editFarm && <FarmFormModal farm={editFarm} canChangeRegion={isPrimaryOf(editFarm)} onClose={() => setEditFarm(null)} />}
      <ConfirmModal
        open={deleteTarget !== null}
        title={t('manage.deleteTitle', { name: deleteTarget?.name ?? NO_VALUE })}
        description={t('manage.deleteDesc')}
        confirmLabel={t('manage.delete')}
        danger
        loading={deleteFarm.isPending}
        onConfirm={handleDeleteFarm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
