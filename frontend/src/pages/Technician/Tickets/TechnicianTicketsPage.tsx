// TechnicianTicketsPage — SCR-TC02 / F-TC-02 / Stitch A1 + C2
// Landing page: tab pills, stat bar, toolbar (search + sort + filter) + table list
// Logic nặng được tách sang ./components/
import { useState, useMemo } from 'react'
import { useTicketsList } from '@/hooks/useTickets'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { IconTicket } from '@/components/ui/icons'
import { isSlaBreached, getSlaUrgency, formatSlaCountdown } from './components/ticketHelpers'
import { TicketStatBar } from './components/TicketStatBar'
import { TicketCard } from './components/TicketCard'
import { UpdateStatusModal } from './components/UpdateStatusModal'
import { ReassignModal } from './components/ReassignModal'
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/constants/tickets'
import { Badge } from '@/components/ui'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '@/utils/helpers'
import type { Ticket, TicketStatus, TicketType } from '@/types'

// ── Tab config ────────────────────────────────────────────────────────────────
type TechTab = 'mine' | 'in_progress' | 'overdue'
type SortKey = 'created_at' | 'priority' | 'sla' | 'status'
type SortDir = 'asc' | 'desc'
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

// ── Table Row ─────────────────────────────────────────────────────────────────
function TicketTableRow({
  ticket, index, onUpdateStatus, onReassign,
}: {
  ticket: Ticket
  index: number
  onUpdateStatus: (t: Ticket) => void
  onReassign: (t: Ticket) => void
}) {
  const navigate = useNavigate()
  const sla      = formatSlaCountdown(ticket)
  const urgency  = getSlaUrgency(ticket)
  const breached = isSlaBreached(ticket)

  const slaColor =
    urgency === 'breached' ? 'text-alertRed font-semibold' :
    urgency === 'critical' ? 'text-alertRed'               :
    urgency === 'warning'  ? 'text-climateOrange'          :
    'text-warmGray'

  const rowBg = breached ? 'bg-alertRed/[0.03]' : index % 2 === 0 ? 'bg-white' : 'bg-graphite/[0.02]'

  return (
    <tr
      className={`${rowBg} group cursor-pointer transition-colors hover:bg-limeMist/10`}
      onClick={() => navigate(`/tickets/${ticket._id}`)}
      role="row"
    >
      {/* Priority */}
      <td className="whitespace-nowrap py-3 pl-5 pr-3">
        <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
      </td>

      {/* Loại */}
      <td className="max-w-[180px] truncate py-3 pr-3 text-sm font-medium text-charcoal">
        {TICKET_TYPE_LABEL[ticket.type as TicketType]}
      </td>

      {/* Trạng thái */}
      <td className="whitespace-nowrap py-3 pr-3">
        <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
      </td>

      {/* SLA */}
      <td className={`whitespace-nowrap py-3 pr-3 text-sm ${slaColor}`}>
        {sla.text}
      </td>

      {/* Ngày tạo */}
      <td className="whitespace-nowrap py-3 pr-3 text-sm text-warmGray">
        {formatDate(ticket.created_at)}
      </td>

      {/* Ghi chú ngắn */}
      <td className="max-w-[200px] py-3 pr-3">
        {ticket.notes[0] && (
          <p className="truncate text-sm text-warmGray">{ticket.notes[0].content}</p>
        )}
      </td>

      {/* Actions — hiện khi hover */}
      <td className="whitespace-nowrap py-3 pr-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          {ticket.status === 'NEW' && (
            <button
              onClick={() => onUpdateStatus(ticket)}
              className="rounded-full bg-charcoal px-2.5 py-1 text-xs font-medium text-white hover:bg-charcoal/90"
            >
              Tiếp nhận
            </button>
          )}
          <button
            onClick={() => onUpdateStatus(ticket)}
            className="rounded-full border border-graphite/20 px-2.5 py-1 text-xs font-medium text-charcoal hover:bg-graphite/10"
          >
            Cập nhật
          </button>
          <button
            onClick={() => onReassign(ticket)}
            className="rounded-full border border-graphite/20 px-2.5 py-1 text-xs font-medium text-charcoal hover:bg-graphite/10"
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
  const [statusModal,  setStatusModal]  = useState<Ticket | null>(null)
  const [reassignModal, setReassignModal] = useState<Ticket | null>(null)

  // Tabbed query
  const { records, total, isLoading } = useTicketsList({ ...TAB_QUERY[activeTab], limit: 50 })

  // Stats query
  const { records: statRecords } = useTicketsList(
    { assignedToMe: true, limit: 200 },
    { enabled: activeTab !== 'mine', staleTime: 60_000 },
  )
  const statData = useMemo(
    () => activeTab === 'mine' ? records : statRecords,
    [activeTab, records, statRecords],
  )

  // Pipeline: overdue filter → search → status filter → sort
  const displayRecords = useMemo(() => {
    let list = activeTab === 'overdue' ? records.filter(isSlaBreached) : records

    // Search: khớp loại hoặc ghi chú
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        TICKET_TYPE_LABEL[t.type as TicketType]?.toLowerCase().includes(q) ||
        t.notes.some(n => n.content.toLowerCase().includes(q)) ||
        STATUS_LABEL[t.status]?.toLowerCase().includes(q),
      )
    }

    // Filter by status
    if (filterStatus) {
      list = list.filter(t => t.status === filterStatus)
    }

    return sortTickets(list, sortKey, sortDir)
  }, [records, activeTab, search, filterStatus, sortKey, sortDir])

  // Toggle sort
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
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

      {/* Stat bar */}
      <TicketStatBar tickets={statData} />

      {/* Tab pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch(''); setFilterStatus('') }}
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

      {/* Toolbar: Search + Filter + Sort + View toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-warmGray/60 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo loại, ghi chú..."
            className="w-full rounded-xl border border-graphite/20 bg-white py-2.5 pl-9 pr-4 text-sm text-charcoal placeholder:text-warmGray/50 focus:border-charcoal focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warmGray/60 hover:text-charcoal"
            >✕</button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as TicketStatus | '')}
          className="rounded-xl border border-graphite/20 bg-white px-3.5 py-2.5 text-sm text-charcoal focus:border-charcoal focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="NEW">Mới</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="AWAITING_FIELD_CONFIRMATION">Chờ xác nhận</option>
          <option value="CLOSED">Đã đóng</option>
        </select>

        {/* Sort quick buttons (chỉ ở card view) */}
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
          >
            ☰
          </button>
          <button
            onClick={() => setViewMode('card')}
            title="Dạng thẻ"
            className={`px-3 py-2.5 text-sm transition-colors ${
              viewMode === 'card' ? 'bg-charcoal text-white' : 'bg-white text-warmGray hover:bg-graphite/10'
            }`}
          >
            ⊞
          </button>
        </div>

        {/* Result count */}
        {!isLoading && (
          <span className="text-sm text-warmGray">
            {displayRecords.length} kết quả
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && <LoadingSkeleton count={4} className="h-14 w-full" />}

      {/* Empty state */}
      {!isLoading && displayRecords.length === 0 && (
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
      {!isLoading && viewMode === 'table' && displayRecords.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-graphite/15 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" role="table">
              <thead>
                <tr className="border-b border-graphite/10 bg-graphite/[0.03]">
                  {/* Priority */}
                  <th
                    className="cursor-pointer whitespace-nowrap py-3 pl-5 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                    onClick={() => handleSort('priority')}
                  >
                    Ưu tiên<SortIcon active={sortKey === 'priority'} dir={sortDir} />
                  </th>
                  {/* Loại */}
                  <th className="whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray">
                    Loại ticket
                  </th>
                  {/* Trạng thái */}
                  <th
                    className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                    onClick={() => handleSort('status')}
                  >
                    Trạng thái<SortIcon active={sortKey === 'status'} dir={sortDir} />
                  </th>
                  {/* SLA */}
                  <th
                    className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                    onClick={() => handleSort('sla')}
                  >
                    Thời hạn SLA<SortIcon active={sortKey === 'sla'} dir={sortDir} />
                  </th>
                  {/* Ngày tạo */}
                  <th
                    className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                    onClick={() => handleSort('created_at')}
                  >
                    Ngày tạo<SortIcon active={sortKey === 'created_at'} dir={sortDir} />
                  </th>
                  {/* Ghi chú */}
                  <th className="py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray">
                    Ghi chú gần nhất
                  </th>
                  {/* Actions */}
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

          {/* Table footer */}
          <div className="border-t border-graphite/10 bg-graphite/[0.02] px-5 py-2.5">
            <p className="text-xs text-warmGray">
              Hiển thị <span className="font-semibold text-charcoal">{displayRecords.length}</span> / {total} ticket
              {(search || filterStatus) && ' (đã lọc)'}
            </p>
          </div>
        </div>
      )}

      {/* ── CARD VIEW ── */}
      {!isLoading && viewMode === 'card' && displayRecords.length > 0 && (
        <div className="flex flex-col gap-3">
          {displayRecords.map(ticket => (
            <TicketCard
              key={ticket._id}
              ticket={ticket}
              onUpdateStatus={setStatusModal}
              onReassign={setReassignModal}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {statusModal   && <UpdateStatusModal ticket={statusModal}   onClose={() => setStatusModal(null)} />}
      {reassignModal && <ReassignModal     ticket={reassignModal} onClose={() => setReassignModal(null)} />}
    </div>
  )
}
