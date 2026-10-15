import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HouseIcon, MapPinIcon, PlusIcon, WarningCircleIcon, WarningIcon, WifiHighIcon, WifiSlashIcon } from '@phosphor-icons/react'
import { Button, EmptyState, FilterChip, SearchInput, StatTile } from '@/components/ui'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import AddHouseModal from '@/components/features/farm-owner/farms/AddHouseModal'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import TechnicianHouseRow from '@/components/features/technician/farms/TechnicianHouseRow'
import { useFarms } from '@/hooks/shared/useFarms'
import { useFarmStructure } from '@/hooks/farm-owner/useFarmStructure'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useAuthStore } from '@/stores/authStore'
import type { HouseHealth, HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

const PAGE_SIZE = 8
type Filter = 'all' | HouseHealth

/** Nhà cần xử lý lên đầu, rồi bình thường, cuối cùng là nhà chưa có thiết bị */
const HEALTH_ORDER: Record<HouseHealth, number> = { ALERT: 0, NORMAL: 1, EMPTY: 2 }

/**
 * Trang trại (/farms) dành cho Technician — SRS: chỉ quản lý cấu trúc Farm/House/Zone/thiết bị
 * trong vùng được phân công (assigned_regions; backend đã lọc danh sách farm). Không dashboard,
 * không phân tích, không sản lượng/thu hoạch, không tạo farm. Kỹ thuật viên mở trang để trả lời:
 * "nhà nào đang có sự cố, ở zone nào, bao nhiêu thiết bị mất kết nối?" → bấm vào để xử lý.
 */
export default function TechnicianFarmsPage() {
  const { t, num } = useT(farmDict)
  useScrollToTop()
  const navigate = useNavigate()
  const regions = useAuthStore(s => s.user?.assigned_regions)
  const { data: farms } = useFarms()
  const { structure, isLoading, isError, refetch } = useFarmStructure()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [showAddHouse, setShowAddHouse] = useState(false)

  const { visible, counts } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const counts = { all: 0, ALERT: 0, NORMAL: 0, EMPTY: 0 }
    const visible: HouseNode[] = []
    for (const n of structure.houses) {
      counts.all += 1
      counts[n.health] += 1
      if (filter !== 'all' && n.health !== filter) continue
      if (q && !`${n.house.name} ${n.farm.name} ${n.farm.address} ${n.farm.region ?? ''}`.toLowerCase().includes(q)) continue
      visible.push(n)
    }
    visible.sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] || b.alerts.length - a.alerts.length)
    return { visible, counts }
  }, [structure.houses, search, filter])

  const safePage = Math.min(page, Math.max(1, Math.ceil(visible.length / PAGE_SIZE)))
  const rows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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
        <LoadingSkeleton count={1} className="h-24 w-full" />
        <LoadingSkeleton count={3} className="h-28 w-full" />
      </div>
    )
  }

  if (structure.houses.length === 0) {
    return (
      <EmptyState
        title={farms?.length ? t('empty.noHouseTitle') : 'Chưa có trang trại trong vùng của bạn'}
        description={farms?.length
          ? t('empty.noHouseDesc')
          : 'Bạn chỉ thấy các trang trại thuộc vùng được phân công. Liên hệ Admin nếu cần thêm vùng phụ trách.'}
        action={farms?.length ? <Button onClick={() => setShowAddHouse(true)}>+ {t('toolbar.addHouse')}</Button> : undefined}
      />
    )
  }

  const { counts: dev, alerts } = structure.totals
  const kpis = [
    { icon: HouseIcon, label: 'Nhà yến phụ trách', value: num(structure.totals.houses), sub: `${num(structure.totals.zones)} zone`, alert: false },
    { icon: WarningIcon, label: 'Nhà cần xử lý', value: num(counts.ALERT), sub: alerts.total > 0 ? `${num(alerts.total)} cảnh báo đang mở` : 'Không có cảnh báo', alert: counts.ALERT > 0 },
    { icon: WifiHighIcon, label: 'Thiết bị online', value: `${num(dev.online)}/${num(dev.total)}`, sub: dev.total > 0 ? `${Math.round((dev.online / dev.total) * 100)}% hoạt động` : 'Chưa có thiết bị', alert: false },
    { icon: WifiSlashIcon, label: 'Mất kết nối', value: num(dev.offline), sub: dev.offline > 0 ? 'Cần kiểm tra hiện trường' : 'Ổn định', alert: dev.offline > 0 },
  ]

  return (
    <div className="flex max-w-screen-xl w-full flex-col gap-6">
      {/* Vùng phụ trách */}
      <section className="flex flex-wrap items-center gap-2">
        <MapPinIcon size={16} className="text-warmGray" />
        <span className="text-small text-warmGray">Vùng phụ trách:</span>
        {regions?.length
          ? regions.map(r => <span key={r} className="rounded-full border border-warmGray/20 bg-white px-3 py-1 text-xs font-semibold text-charcoal">{r}</span>)
          : <span className="text-small text-warmGray">Chưa gán vùng</span>}
      </section>

      {/* KPI */}
      <FarmFrame title="Tổng quan thiết bị" description="Trạng thái hệ thống trong khu vực bạn phụ trách">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map(k => (
            <StatTile
              key={k.label}
              icon={k.icon}
              iconClass={k.alert ? 'bg-alertRed/10 text-alertRed' : 'bg-limeMist text-charcoal'}
              alert={k.alert}
              label={k.label}
              value={k.value}
              sub={k.sub}
            />
          ))}
        </div>
      </FarmFrame>

      {/* Danh sách */}
      <FarmFrame title="Danh sách Nhà yến" description="Các nhà yến thuộc khu vực của bạn">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] max-w-sm flex-1">
              <SearchInput placeholder={t('toolbar.search')} value={search} onChange={v => { setSearch(v); setPage(1) }} />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={filter === 'all'} label={`${t('filter.all')} ${num(counts.all)}`} onClick={() => { setFilter('all'); setPage(1) }} />
              <FilterChip active={filter === 'ALERT'} label={`Cần xử lý ${num(counts.ALERT)}`} onClick={() => { setFilter('ALERT'); setPage(1) }} />
              <FilterChip active={filter === 'NORMAL'} label={`${t('health.normal')} ${num(counts.NORMAL)}`} onClick={() => { setFilter('NORMAL'); setPage(1) }} />
              <FilterChip active={filter === 'EMPTY'} label={`${t('health.empty')} ${num(counts.EMPTY)}`} onClick={() => { setFilter('EMPTY'); setPage(1) }} />
            </div>
            <Button size="sm" className="ml-auto h-9 text-xs" onClick={() => setShowAddHouse(true)}>
              <PlusIcon size={14} weight="bold" />
              {t('toolbar.addHouse')}
            </Button>
          </div>

          {visible.length === 0 ? (
            <EmptyState title={t('empty.noMatchTitle')} description={t('empty.noMatchDesc')} />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map(n => (
                <TechnicianHouseRow key={n.house._id} node={n} onOpen={() => navigate(`/farms/${n.farm._id}/houses/${n.house._id}`)} />
              ))}
              <Pagination page={safePage} limit={PAGE_SIZE} total={visible.length} onChange={setPage} variant="full" />
            </div>
          )}
        </div>
      </FarmFrame>

      <AddHouseModal open={showAddHouse} onClose={() => setShowAddHouse(false)} farms={farms ?? []} />
    </div>
  )
}
