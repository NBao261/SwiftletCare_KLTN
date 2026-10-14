import { useMemo, useState } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { useTicketKpi } from '@/hooks/shared/useTickets'
import { useUsersPicker } from '@/hooks/admin/useUsers'
import { Button, ClearFiltersButton, EmptyState, SearchInput, SelectMenu } from '@/components/ui'
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import { formatDuration } from '@/lib/helpers'
import { cn } from '@/lib/cn'
// File này dùng `t` làm tên tham số dòng trong render — đặt tên khác cho hàm dịch để không bị che
import { t as tr18, tr } from '@/i18n'

const HOUR_MS = 3_600_000
/** px — cùng chiều cao dòng các bảng Admin khác (nhật ký, người dùng) */
const ROW_HEIGHT = 52
const PAGE_SIZE = 10
/** Cùng ngưỡng mục tiêu SLA ô "Đúng hạn SLA" (TicketInsights) và SlaCard */
const SLA_TARGET = 80
const ALL = ''

interface TechRow {
  id: string
  name: string
  /** null = tài khoản đã xoá — không lọc được bảng ticket theo tên */
  fullName: string | null
  regions: string[]
  unaccepted: number
  working: number
  completed: number
  cancelled: number
  avgResolveHours: number | null
  slaComplianceRate: number | null
}

type LoadFilter = '' | 'unaccepted' | 'busy' | 'idle'
type SlaFilter = '' | 'below' | 'met'

const LOAD_OPTIONS: { value: LoadFilter; label: string }[] = [
  { value: ALL, label: 'Mọi tình trạng' },
  { value: 'unaccepted', label: 'Có ticket chưa nhận' },
  { value: 'busy', label: 'Đang có việc' },
  { value: 'idle', label: 'Đang rảnh' },
]
const SLA_OPTIONS: { value: SlaFilter; label: string }[] = [
  { value: ALL, label: 'Mọi mức SLA' },
  { value: 'below', label: `Dưới mục tiêu ${SLA_TARGET}%` },
  { value: 'met', label: `Đạt mục tiêu ${SLA_TARGET}%` },
]

/** Bỏ dấu + đ→d + chữ thường, để "nhi" khớp "Nhí" */
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase()

/** Số trong ô: 0 chữ xám nhạt để các con số khác 0 nổi lên khi quét dọc cột — không thêm màu riêng */
const Num = ({ n }: { n: number }) => <span className={n === 0 ? 'text-warmGray' : 'text-charcoal'}>{n}</span>

/** Cột bảng — cùng khuôn các bảng Admin khác: STT, tên đậm, cột số canh giữa, width % tổng 100 (5+19+16+9+9+10+8+12+12) */
function buildColumns(startIndex: number): DataTableColumn<TechRow>[] {
  return [
    { key: 'stt', header: 'STT', align: 'center', className: 'w-[5%]', render: (_t, i) => <span className="text-warmGray">{startIndex + i + 1}</span> },
    { key: 'name', header: 'Kỹ thuật viên', className: 'w-[19%]', render: t => <p className="truncate font-semibold text-charcoal" title={tr(t.name)}>{tr(t.name)}</p> },
    {
      key: 'regions', header: 'Khu vực phụ trách', className: 'w-[16%]',
      render: t => t.regions.length
        ? <p className="truncate text-charcoal" title={t.regions.join(', ')}>{t.regions.join(', ')}</p>
        // tr (không phải t): trong file này `t` là tham số dòng của render
        : <span className="text-warmGray">{tr('Chưa gán')}</span>,
    },
    // Chưa nhận = đã gán nhưng KTV chưa bấm tiếp nhận (Mới) · Đang làm = Đang xử lý + Chờ xác nhận hiện trường
    { key: 'unaccepted', header: 'Chưa nhận', align: 'center', className: 'w-[9%]', render: t => <Num n={t.unaccepted} /> },
    { key: 'working', header: 'Đang làm', align: 'center', className: 'w-[9%]', render: t => <Num n={t.working} /> },
    { key: 'completed', header: 'Hoàn thành', align: 'center', className: 'w-[10%]', render: t => <Num n={t.completed} /> },
    { key: 'cancelled', header: 'Đã huỷ', align: 'center', className: 'w-[8%]', render: t => <Num n={t.cancelled} /> },
    {
      key: 'avg', header: 'TB xử lý', align: 'center', className: 'w-[12%] whitespace-nowrap',
      render: t => t.avgResolveHours != null
        ? <span className="text-charcoal">{formatDuration(t.avgResolveHours * HOUR_MS)}</span>
        : <span className="text-warmGray">—</span>,
    },
    {
      key: 'sla', header: 'Đúng hạn SLA', align: 'center', className: 'w-[12%]',
      render: t => t.slaComplianceRate != null
        // Như cột "Giá trị đọc" bảng cảm biến: dưới mục tiêu = đỏ đậm, đạt = đen đậm
        ? <span className={cn('font-bold', t.slaComplianceRate < SLA_TARGET ? 'text-red-600' : 'text-charcoal')}>{t.slaComplianceRate}%</span>
        : <span className="text-warmGray">—</span>,
    },
  ]
}

/**
 * Tab "Theo kỹ thuật viên" trang Ticket của Admin — thống kê số lượng ticket + khu vực quản lý của từng kỹ thuật viên
 * (TICKET-FR-012, GET /tickets/kpi; khu vực từ /admin/users — AUTH-FR-005c). Gồm MỌI kỹ thuật viên, kể cả người
 * chưa từng được giao (kpi chỉ trả người đã có ticket → bù dòng 0). Tìm theo tên/email/khu vực + lọc khu vực, tình
 * trạng việc, mức SLA. Sắp người nhiều việc dở nhất lên đầu để thấy ai quá tải mà gán lại (TICKET-FR-005b).
 * Bấm 1 dòng → sang tab "Danh sách ticket" đã lọc theo người đó.
 */
export default function TechnicianWorkloadTable({ onSelectTechnician }: { onSelectTechnician: (name: string) => void }) {
  const { data: kpi, isLoading, isError, refetch } = useTicketKpi()
  const techUsers = useUsersPicker({ role: 'TECHNICIAN' })
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState(ALL)
  const [load, setLoad] = useState<LoadFilter>(ALL)
  const [sla, setSla] = useState<SlaFilter>(ALL)
  const [page, setPage] = useState(1)

  const rows = useMemo<TechRow[]>(() => {
    if (!kpi) return []
    const byId = new Map(kpi.byTechnician.map(t => [t.technician_id, t]))
    const regionsOf = new Map(techUsers.records.map(u => [u._id, u.assigned_regions ?? []]))
    const fromKpi: TechRow[] = kpi.byTechnician.map(t => ({
      id: t.technician_id,
      name: t.full_name ?? t.email ?? 'Tài khoản đã xoá',
      fullName: t.full_name,
      regions: regionsOf.get(t.technician_id) ?? [],
      unaccepted: t.unaccepted,
      // `closed` gộp cả ticket huỷ (status CLOSED + cancelled_at) → hoàn thành = closed − cancelled
      working: t.total - t.closed - t.unaccepted,
      completed: t.closed - t.cancelled,
      cancelled: t.cancelled,
      avgResolveHours: t.avgResolveHours,
      slaComplianceRate: t.slaComplianceRate,
    }))
    // KTV chưa từng được giao ticket — /tickets/kpi không trả, bù dòng toàn 0 để Admin thấy cả người đang rảnh
    const idle: TechRow[] = techUsers.records.filter(u => !byId.has(u._id)).map(u => ({
      id: u._id, name: u.full_name, fullName: u.full_name, regions: u.assigned_regions ?? [],
      unaccepted: 0, working: 0, completed: 0, cancelled: 0, avgResolveHours: null, slaComplianceRate: null,
    }))
    return [...fromKpi, ...idle].sort((a, b) =>
      (b.unaccepted + b.working) - (a.unaccepted + a.working) || (b.completed + b.cancelled) - (a.completed + a.cancelled))
  }, [kpi, techUsers.records])

  const regionOptions = useMemo(() => [
    { value: ALL, label: 'Mọi khu vực' },
    ...[...new Set(rows.flatMap(r => r.regions))].sort((a, b) => a.localeCompare(b, 'vi')).map(r => ({ value: r, label: r })),
  ], [rows])

  const q = fold(search.trim())
  const visible = rows.filter(r =>
    (!q || [r.name, ...r.regions].some(s => fold(s).includes(q)))
    && (!region || r.regions.includes(region))
    && (load !== 'unaccepted' || r.unaccepted > 0)
    && (load !== 'busy' || r.unaccepted + r.working > 0)
    && (load !== 'idle' || r.unaccepted + r.working === 0)
    && (sla !== 'below' || (r.slaComplianceRate != null && r.slaComplianceRate < SLA_TARGET))
    && (sla !== 'met' || (r.slaComplianceRate != null && r.slaComplianceRate >= SLA_TARGET)))
  const hasFilter = !!(search.trim() || region || load || sla)
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function clearFilters() { setSearch(''); setRegion(ALL); setLoad(ALL); setSla(ALL); setPage(1) }

  if (isLoading || techUsers.isLoading) return <LoadingSkeleton count={5} className="h-[52px] w-full" />
  if (isError || !kpi) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title="Không tải được số liệu kỹ thuật viên"
        description="Kiểm tra kết nối tới máy chủ rồi thử lại."
        action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  }

  return (
    <>
      {/* Hàng 1: tìm kiếm — cùng bố cục tab Danh sách ticket */}
      <SearchInput placeholder="Tìm tên kỹ thuật viên, khu vực..." value={search} onChange={v => { setSearch(v); setPage(1) }} />

      {/* Hàng 2: bộ lọc — đổi lọc thì về trang 1 */}
      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu ariaLabel="Lọc theo khu vực" value={region} onChange={v => { setRegion(v); setPage(1) }} options={regionOptions} />
        <SelectMenu ariaLabel="Lọc theo tình trạng việc" value={load} onChange={v => { setLoad(v); setPage(1) }} options={LOAD_OPTIONS} />
        <SelectMenu ariaLabel="Lọc theo mức SLA" value={sla} onChange={v => { setSla(v); setPage(1) }} options={SLA_OPTIONS} />
        {hasFilter && <ClearFiltersButton onClick={clearFilters} />}
      </div>

      <DataTable
        columns={buildColumns((page - 1) * PAGE_SIZE)}
        rows={pageRows}
        getRowKey={t => t.id}
        // Ô tìm kiếm của bảng ticket khớp theo full_name — tài khoản đã xoá (không tên) thì không lọc được
        onRowClick={t => { if (t.fullName) onSelectTechnician(t.fullName) }}
        // Cố định khung 10 dòng — ít kỹ thuật viên/trang cuối vẫn giữ chiều cao
        rowHeight={ROW_HEIGHT}
        minRows={PAGE_SIZE}
        emptyMessage={hasFilter ? 'Không có kỹ thuật viên nào khớp bộ lọc.' : 'Chưa có kỹ thuật viên nào.'}
      />
      <Pagination page={page} limit={PAGE_SIZE} total={visible.length} onChange={setPage} variant="full" />
      {techUsers.truncated && (
        <p className="text-xs text-warmGray">
          {tr18('Chỉ liệt kê {{shown}}/{{total}} kỹ thuật viên chưa có ticket (giới hạn 1 trang của /admin/users).', { shown: techUsers.records.length, total: techUsers.total })}
        </p>
      )}
    </>
  )
}
