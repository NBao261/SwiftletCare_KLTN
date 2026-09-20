// TechnicianTicketsPage — SCR-TC02 / F-TC-02 / Stitch A1 + C2
// Landing page: tab pills, stat bar, danh sách ticket + inline actions
// Logic nặng được tách sang ./components/
import { useState, useMemo } from 'react'
import { useTicketsList } from '@/hooks/useTickets'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { IconTicket } from '@/components/ui/icons'
import { isSlaBreached } from './components/ticketHelpers'
import { TicketStatBar } from './components/TicketStatBar'
import { TicketCard } from './components/TicketCard'
import { UpdateStatusModal } from './components/UpdateStatusModal'
import { ReassignModal } from './components/ReassignModal'
import type { Ticket, TicketStatus } from '@/types'

// ── Tab config ────────────────────────────────────────────────────────────────
type TechTab = 'mine' | 'in_progress' | 'overdue'

const TABS: { id: TechTab; label: string }[] = [
  { id: 'mine',        label: 'Của tôi' },
  { id: 'in_progress', label: 'Đang xử lý' },
  { id: 'overdue',     label: 'Quá hạn SLA' },
]

const TAB_QUERY: Record<TechTab, Partial<{ status: TicketStatus; assignedToMe: boolean }>> = {
  mine:        { assignedToMe: true },
  in_progress: { assignedToMe: true, status: 'IN_PROGRESS' },
  overdue:     { assignedToMe: true },
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TechnicianTicketsPage() {
  const [activeTab, setActiveTab] = useState<TechTab>('mine')
  const [statusModal,  setStatusModal]  = useState<Ticket | null>(null)
  const [reassignModal, setReassignModal] = useState<Ticket | null>(null)

  // Tabbed query
  const { records, total, isLoading } = useTicketsList({ ...TAB_QUERY[activeTab], limit: 50 })

  // Stats query — chạy riêng để lấy số liệu stat bar, staleTime cao để tránh refetch không cần thiết
  // Chỉ fetch khi không đang ở tab 'mine' (nếu đang ở mine → dùng lại records luôn)
  const { records: statRecords } = useTicketsList(
    { assignedToMe: true, limit: 200 },
    { enabled: activeTab !== 'mine', staleTime: 60_000 },
  )
  const statData = useMemo(
    () => activeTab === 'mine' ? records : statRecords,
    [activeTab, records, statRecords],
  )

  // Lọc overdue client-side (API không hỗ trợ filter is_sla_breached)
  const displayRecords = activeTab === 'overdue' ? records.filter(isSlaBreached) : records

  return (
    <div className="flex flex-col gap-6">
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
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-charcoal text-white'
                : 'bg-graphite/10 text-charcoal hover:bg-graphite/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading && <LoadingSkeleton count={4} className="h-36 w-full" />}

      {!isLoading && displayRecords.length === 0 && (
        <EmptyState
          icon={<IconTicket width={28} height={28} />}
          title="Không có ticket nào"
          description="Chưa có ticket nào được gán cho bạn trong mục này."
        />
      )}

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

      {/* Modals — render once at page level */}
      {statusModal  && <UpdateStatusModal ticket={statusModal}  onClose={() => setStatusModal(null)} />}
      {reassignModal && <ReassignModal    ticket={reassignModal} onClose={() => setReassignModal(null)} />}
    </div>
  )
}
