// TechnicianTicketsPage — SCR-TC02 / F-TC-02 / Stitch A1 + C2
// Landing page: tab pills, stat bar, toolbar (search + sort + filter) + table list + pagination
// Logic nặng được tách sang ./components/
// Pagination: tab mine/in_progress dùng server-side (page+limit:12).
//             tab overdue dùng bulk fetch (limit:100) + client filter + client paginate
//             vì server không có ?slaBreached param, phân trang server trên tap overdue bị sai.
import { useState, useMemo } from 'react'
import { useTicketsList } from '@/hooks/useTickets'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { IconTicket } from '@/components/ui/icons'
import { isSlaBreached } from './components/ticketHelpers'
import { TicketStatBar } from './components/TicketStatBar'
import { TicketCard } from './components/TicketCard'
import { SlaRing } from './components/SlaRing'
import { UpdateStatusModal } from './components/UpdateStatusModal'
import { ReassignModal } from './components/ReassignModal'
import { TICKET_TYPE_LABEL, STATUS_LABEL } from '@/constants/tickets'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '@/utils/helpers'
import type { Ticket, TicketStatus, TicketType } from '@/types'

// ── Config ────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12   // số ticket mỗi trang

type TechTab  = 'mine' | 'in_progress' | 'overdue'
type SortKey  = 'created_at' | 'priority' | 'sla' | 'status'
type SortDir  = 'asc' | 'desc'
type ViewMode = 'table' | 'card'

const TABS: { id: TechTab; label: string; icon: string }[] = [
  { id: 'mine',        label: 'Tất cả của tôi', icon: '📋' },
  { id: 'in_progress', label: 'Đang xử lý',     icon: '⚙️' },
  { id: 'overdue',     label: 'Quá hạn SLA',    icon: '🔴' },
]

const TAB_QUERY: Record<TechTab, Partial<{ status: TicketStatus; assignedToMe: boolean }>> = {
  mine:        { assignedToMe: true },
  in_progress: { assignedToMe: true, status: 'IN_PROGRESS' },
  overdue:     { assignedToMe: true },
}

const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 }
const STATUS_ORDER: Record<string, number>   = { NEW: 0, IN_PROGRESS: 1, AWAITING_FIELD_CONFIRMATION: 2, CLOSED: 3 }

// ── Sort helper ────────────────────────────────────────────────────────────────
function sortTickets(tickets: Ticket[], key: SortKey, dir: SortDir): Ticket[] {
  return [...tickets].sort((a, b) => {
    let cmp = 0
    if (key === 'priority') {
      cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    } else if (key === 'status') {
      cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    } else if (key === 'sla') {
      const ta = a.sla_resolve_due_at ? new Date(a.sla_resolve_due_at).getTime() : Infinity
      const tb = b.sla_resolve_due_at ? new Date(b.sla_resolve_due_at).getTime() : Infinity
      cmp = ta - tb
    } else {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

// ── SortIcon ──────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block text-xs transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}>
      {active && dir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

// ── Pagination Bar ─────────────────────────────────────────────────────────────
interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPage: (p: number) => void
}

function PaginationBar({ page, totalPages, totalItems, pageSize, onPage }: PaginationProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, totalItems)

  // Tạo mảng trang hiển thị: luôn giữ first/last + 2 trang xung quanh current
  function getPages(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '…')[] = [1]
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite/10 bg-graphite/[0.02] px-5 py-3">
      {/* Info */}
      <p className="text-xs text-warmGray">
        Hiển thị <span className="font-semibold text-charcoal">{from}–{to}</span> / <span className="font-semibold text-charcoal">{totalItems}</span> ticket
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite/20 text-sm text-charcoal transition-colors hover:bg-graphite/10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Trang trước"
        >
          ‹
        </button>

        {getPages().map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-warmGray">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-charcoal text-white shadow-sm'
                  : 'border border-graphite/20 text-charcoal hover:bg-graphite/10'
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite/20 text-sm text-charcoal transition-colors hover:bg-graphite/10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Trang tiếp"
        >
          ›
        </button>
      </div>

      {/* Page size info */}
      <p className="text-xs text-warmGray">{PAGE_SIZE} / trang</p>
    </div>
  )
}

// Priority dot color map
const PRIORITY_DOT_CLS: Record<string, string> = {
  P1: 'bg-alertRed ring-alertRed/20',
  P2: 'bg-climateOrange ring-climateOrange/20',
  P3: 'bg-warmGray ring-warmGray/20',
}

// Status dot color map
const STATUS_DOT_CLS: Record<string, string> = {
  NEW: 'bg-charcoal',
  IN_PROGRESS: 'bg-climateOrange',
  AWAITING_FIELD_CONFIRMATION: 'bg-limeMist',
  CLOSED: 'bg-warmGray',
}

function TicketTableRow({
  ticket, index, onUpdateStatus, onReassign,
}: {
  ticket: Ticket
  index: number
  onUpdateStatus: (t: Ticket) => void
  onReassign: (t: Ticket) => void
}) {
  const navigate = useNavigate()
  const breached = isSlaBreached(ticket)

  const rowBg = breached ? 'bg-alertRed/[0.03]' : index % 2 === 0 ? 'bg-white' : 'bg-graphite/[0.02]'
  const dotCls = PRIORITY_DOT_CLS[ticket.priority] ?? PRIORITY_DOT_CLS.P3
  const statusDotCls = STATUS_DOT_CLS[ticket.status] ?? 'bg-warmGray'

  return (
    <tr
      className={`${rowBg} group cursor-pointer transition-all duration-200 hover:bg-limeMist/10 hover:shadow-sm`}
      onClick={() => navigate(`/tickets/${ticket._id}`)}
      role="row"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Priority dot */}
      <td className="whitespace-nowrap py-3 pl-5 pr-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full ring-4 ${dotCls} ${ticket.priority === 'P1' ? 'animate-pulse-sla' : ''}`} />
          <span className="text-xs font-bold text-charcoal">{ticket.priority}</span>
        </div>
      </td>
      {/* Type */}
      <td className="max-w-[180px] truncate py-3 pr-3 text-sm font-medium text-charcoal">
        {TICKET_TYPE_LABEL[ticket.type as TicketType]}
      </td>
      {/* Status with dot */}
      <td className="whitespace-nowrap py-3 pr-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-graphite/10 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal shadow-icon">
          <span className={`inline-block h-2 w-2 rounded-full ${statusDotCls}`} />
          {STATUS_LABEL[ticket.status]}
        </span>
      </td>
      {/* SLA Ring */}
      <td className="whitespace-nowrap py-3 pr-3">
        <SlaRing ticket={ticket} size={28} />
      </td>
      {/* Date */}
      <td className="whitespace-nowrap py-3 pr-3 text-sm text-warmGray">
        {formatDate(ticket.created_at)}
      </td>
      {/* Note */}
      <td className="max-w-[200px] py-3 pr-3">
        {ticket.notes[0] && (
          <p className="truncate text-sm text-warmGray">💬 {ticket.notes[0].content}</p>
        )}
      </td>
      {/* Actions */}
      <td className="whitespace-nowrap py-3 pr-5" onClick={e => e.stopPropagation()}>
        {/* M2: group-focus-within để keyboard user nhìn thấy nút khi tab vào */}
        <div className="flex items-center gap-1.5 opacity-0 transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {ticket.status === 'NEW' && (
            <button
              onClick={() => onUpdateStatus(ticket)}
              className="rounded-full bg-charcoal px-2.5 py-1 text-xs font-medium text-white transition-all hover:bg-charcoal/90 active:scale-95"
            >
              Tiếp nhận
            </button>
          )}
          {/* M1: Disable Cập nhật + Gán lại khi CLOSED */}
          <button
            onClick={() => onUpdateStatus(ticket)}
            disabled={ticket.status === 'CLOSED'}
            className="rounded-full border border-graphite/15 px-2.5 py-1 text-xs font-medium text-charcoal transition-all hover:border-charcoal/30 hover:bg-graphite/5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cập nhật
          </button>
          <button
            onClick={() => onReassign(ticket)}
            disabled={ticket.status === 'CLOSED'}
            className="rounded-full border border-graphite/15 px-2.5 py-1 text-xs font-medium text-charcoal transition-all hover:border-charcoal/30 hover:bg-graphite/5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Gán lại
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TechnicianTicketsPage() {
  const [activeTab,    setActiveTab]    = useState<TechTab>('mine')
  const [viewMode,     setViewMode]     = useState<ViewMode>('table')
  const [sortKey,      setSortKey]      = useState<SortKey>('priority')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('')
  const [page,         setPage]         = useState(1)   // pagination state
  const [statusModal,  setStatusModal]  = useState<Ticket | null>(null)
  const [reassignModal, setReassignModal] = useState<Ticket | null>(null)

  // ── Data fetch theo 2 chế độ ────────────────────────────────────────────────────────────
  // CHẾA ĐỘ 1: mine + in_progress — server pagination (page+limit:PAGE_SIZE)
  const serverQuery = useTicketsList(
    { ...TAB_QUERY[activeTab], page, limit: PAGE_SIZE },
    { enabled: activeTab !== 'overdue' },
  )

  // CHẾA ĐỘ 2: overdue — bulk fetch rồi filter isSlaBreached client-side,
  // sau đó tự paginate trên tập đã lọc. Lý do không dùng server pagination:
  // TAB_QUERY.overdue = { assignedToMe:true } (giống mine), server không biết
  // ticket nào overdue nằm ở trang nào → totalPages tính sai, rải rác nhiều trang.
  // TODO [BE-GAP]: khi backend hỗ trợ ?slaBreached=true, chuyển về server pagination.
  const overdueQuery = useTicketsList(
    { assignedToMe: true, limit: 100 },
    { enabled: activeTab === 'overdue', staleTime: 30_000 },
  )

  // Stats query riêng — luôn fetch bất kể tab đang mở để stat bar không bị 0
  // khi đổi sang tab in_progress/overdue.
  // Lý do không dùng GET /tickets/kpi: endpoint đó là requireRole('ADMIN'),
  // Technician gọi → 403. Chấp nhận capped ở limit:50 — đủ với phần lớn Technician.
  const statsQuery = useTicketsList(
    { assignedToMe: true, limit: 50 },
    { staleTime: 60_000 },
  )

  const isOverdue = activeTab === 'overdue'
  const records   = isOverdue ? overdueQuery.records : serverQuery.records
  const total     = isOverdue ? overdueQuery.total   : serverQuery.total
  const isLoading = isOverdue ? overdueQuery.isLoading : serverQuery.isLoading

  // Pipeline: overdue → search → status filter → sort
  const filteredRecords = useMemo(() => {
    let list = isOverdue ? records.filter(isSlaBreached) : records
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        TICKET_TYPE_LABEL[t.type as TicketType]?.toLowerCase().includes(q) ||
        t.notes.some(n => n.content.toLowerCase().includes(q)) ||
        STATUS_LABEL[t.status]?.toLowerCase().includes(q),
      )
    }
    if (filterStatus) list = list.filter(t => t.status === filterStatus)
    return sortTickets(list, sortKey, sortDir)
  }, [records, isOverdue, search, filterStatus, sortKey, sortDir])

  // Pagination: chế độ overdue dùng client total (số ticket overdue đã lọc)
  //             chế độ mine/in_progress dùng server total
  const clientTotal  = filteredRecords.length
  const paginTotal   = isOverdue ? clientTotal : total
  const totalPages   = Math.max(1, Math.ceil(paginTotal / PAGE_SIZE))
  const safePage     = Math.min(page, totalPages)
  // overdue: slice client; mine/in_progress: records đã đúng page từ server
  const displayRecords = isOverdue
    ? filteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filteredRecords

  // Helper: reset về trang 1 khi filter/sort/tab thay đổi
  function resetPage() { setPage(1) }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    resetPage()
  }

  function handleTabChange(tab: TechTab) {
    setActiveTab(tab)
    setSearch('')
    setFilterStatus('')
    resetPage()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Ticket của tôi</h1>
          <p className="mt-0.5 text-sm text-warmGray">Quản lý và xử lý các ticket được gán</p>
        </div>
        <span className="rounded-full bg-graphite/10 px-3 py-1 text-sm font-semibold text-charcoal">
          {total} ticket
        </span>
      </div>

      {/* Stat bar — nhận tickets từ stats query riêng (không dùng KPI endpoint vì ADMIN-only) */}
      <TicketStatBar tickets={statsQuery.records} />

      {/* Tab pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-charcoal text-white'
                : 'bg-graphite/10 text-charcoal hover:bg-graphite/20'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-warmGray/60 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage() }}
            placeholder="Tìm theo loại, ghi chú..."
            className="w-full rounded-xl border border-graphite/20 bg-white py-2.5 pl-9 pr-4 text-sm text-charcoal placeholder:text-warmGray/50 focus:border-charcoal focus:outline-none"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); resetPage() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warmGray/60 hover:text-charcoal"
            >✕</button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value as TicketStatus | ''); resetPage() }}
          className="rounded-xl border border-graphite/20 bg-white px-3.5 py-2.5 text-sm text-charcoal focus:border-charcoal focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="NEW">Mới</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="AWAITING_FIELD_CONFIRMATION">Chờ xác nhận</option>
          <option value="CLOSED">Đã đóng</option>
        </select>

        {/* Sort buttons — card view only */}
        {viewMode === 'card' && (
          <div className="flex items-center gap-2 rounded-xl border border-graphite/20 bg-white px-3 py-2">
            <span className="text-xs font-semibold text-warmGray">Sắp xếp:</span>
            {(['priority', 'sla', 'created_at', 'status'] as SortKey[]).map(k => (
              <button
                key={k}
                onClick={() => handleSort(k)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortKey === k ? 'bg-charcoal text-white' : 'text-warmGray hover:bg-graphite/10'
                }`}
              >
                {{ priority: 'Ưu tiên', sla: 'SLA', created_at: 'Ngày', status: 'Trạng thái' }[k]}
                {sortKey === k && <SortIcon active dir={sortDir} />}
              </button>
            ))}
          </div>
        )}

        {/* View mode toggle */}
        <div className="flex overflow-hidden rounded-xl border border-graphite/20">
          <button
            onClick={() => setViewMode('table')}
            title="Dạng bảng"
            className={`px-3 py-2.5 text-sm transition-colors ${
              viewMode === 'table' ? 'bg-charcoal text-white' : 'bg-white text-warmGray hover:bg-graphite/10'
            }`}
          >☰</button>
          <button
            onClick={() => setViewMode('card')}
            title="Dạng thẻ"
            className={`px-3 py-2.5 text-sm transition-colors ${
              viewMode === 'card' ? 'bg-charcoal text-white' : 'bg-white text-warmGray hover:bg-graphite/10'
            }`}
          >⊞</button>
        </div>

        {/* Result count */}
        {!isLoading && (
          <span className="text-sm text-warmGray">
            {filteredRecords.length} kết quả
            {(search || filterStatus) && <span className="ml-1 text-xs text-warmGray/70">(đã lọc)</span>}
          </span>
        )}
      </div>

      {/* Search/sort hoạt động trong phạm vi dữ liệu đã tải */}
      {/* Tab overdue: tải 100 records, search/sort trên toàn bộ */}
      {/* Tab mine/in_progress: tải 12 records/trang, search/sort trong trang hiện tại */}
      {/* TODO [BE-GAP]: khi backend có ?search, chuyển search lên server để hoạt động cross-page */}


      {/* Loading */}
      {isLoading && <LoadingSkeleton count={PAGE_SIZE} className="h-12 w-full" />}

      {/* Empty */}
      {!isLoading && filteredRecords.length === 0 && (
        <EmptyState
          icon={<IconTicket width={28} height={28} />}
          title={search || filterStatus ? 'Không tìm thấy ticket nào' : 'Không có ticket nào'}
          description={
            search || filterStatus
              ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
              : 'Chưa có ticket nào được gán cho bạn trong mục này.'
          }
        />
      )}

      {/* ── TABLE VIEW ── */}
      {!isLoading && viewMode === 'table' && filteredRecords.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-graphite/15 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" role="table">
              <thead>
                <tr className="border-b border-graphite/10 bg-graphite/[0.03]">
                  <th
                    className="cursor-pointer whitespace-nowrap py-3 pl-5 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                    onClick={() => handleSort('priority')}
                  >
                    Ưu tiên<SortIcon active={sortKey === 'priority'} dir={sortDir} />
                  </th>
                  <th className="whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray">
                    Loại ticket
                  </th>
                  <th
                    className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                    onClick={() => handleSort('status')}
                  >
                    Trạng thái<SortIcon active={sortKey === 'status'} dir={sortDir} />
                  </th>
                  <th
                    className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                    onClick={() => handleSort('sla')}
                  >
                    Thời hạn SLA<SortIcon active={sortKey === 'sla'} dir={sortDir} />
                  </th>
                  <th
                    className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                    onClick={() => handleSort('created_at')}
                  >
                    Ngày tạo<SortIcon active={sortKey === 'created_at'} dir={sortDir} />
                  </th>
                  <th className="py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray">
                    Ghi chú gần nhất
                  </th>
                  <th className="py-3 pr-5 text-[11px] font-semibold uppercase tracking-wider text-warmGray">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite/[0.06]">
                {displayRecords.map((ticket, i) => (
                  <TicketTableRow
                    key={ticket._id}
                    ticket={ticket}
                    index={i}
                    onUpdateStatus={setStatusModal}
                    onReassign={setReassignModal}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination — totalItems theo chế độ: overdue=client, mine/in_progress=server */}
          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            totalItems={paginTotal}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </div>
      )}

      {/* ── CARD VIEW ── */}
      {!isLoading && viewMode === 'card' && filteredRecords.length > 0 && (
        <div className="flex flex-col gap-3">
          {displayRecords.map(ticket => (
            <TicketCard
              key={ticket._id}
              ticket={ticket}
              onUpdateStatus={setStatusModal}
              onReassign={setReassignModal}
            />
          ))}

          {/* Pagination dưới card view — totalItems từ server */}
          {totalPages > 1 && (
            <div className="overflow-hidden rounded-2xl border border-graphite/15 bg-white shadow-sm">
              <PaginationBar
                page={safePage}
                totalPages={totalPages}
                totalItems={paginTotal}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {statusModal   && <UpdateStatusModal ticket={statusModal}   onClose={() => setStatusModal(null)} />}
      {reassignModal && <ReassignModal     ticket={reassignModal} onClose={() => setReassignModal(null)} />}
    </div>
  )
}
