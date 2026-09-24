// TechnicianTicketsPage — SCR-TC02 / F-TC-02 / Stitch A1 + C2
//
// Architecture: Smart Container — chỉ giữ state và điều phối, KHÔNG chứa business logic.
// Logic phân trang dual-mode và data fetching → useTicketsPageData
// UI Tabs + Search + Filter → TicketToolbar
// Table thead + tbody + pagination → TicketTableView
// Card list + pagination → TicketCard (từ features/technician/tickets)
// Pagination → Pagination (components/ui, variant="numbered")
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import { IconTicket } from '@/components/ui/icons'
import { TicketStatBar } from '@/components/features/technician/tickets/TicketStatBar'
import { TicketToolbar } from '@/components/features/technician/tickets/TicketToolbar'
import { TicketTableView } from '@/components/features/technician/tickets/TicketTableView'
import { UpdateStatusModal } from '@/components/features/technician/tickets/UpdateStatusModal'
import { ReassignModal } from '@/components/features/technician/tickets/ReassignModal'
import { useTicketsPageData } from '@/components/features/technician/tickets/useTicketsPageData'
import { PAGE_SIZE } from '@/components/features/technician/tickets/ticketListTypes'

export default function TechnicianTicketsPage() {
  const {
    // UI state
    isOverdueActive, sortKey, sortDir, filterStatus,
    statusModal, reassignModal,
    // Actions
    handleOverdueToggle, handleSort,
    handleFilterStatusChange, handleClearFilters,
    setPage, setStatusModal, setReassignModal,
    // Data
    displayRecords, filteredRecords,
    safePage, paginTotal,
    isLoading, statsRecords, total,
    overdueTotal,
  } = useTicketsPageData()

  const hasResults = !isLoading && filteredRecords.length > 0
  const isEmpty    = !isLoading && filteredRecords.length === 0

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Ticket của tôi</h1>
          <p className="mt-0.5 text-sm text-warmGray">Quản lý và xử lý các ticket được gán</p>
        </div>
        <span className="rounded-full bg-graphite/10 px-3 py-1 text-sm font-semibold text-charcoal">
          {total} ticket
        </span>
      </div>

      {/* ── Stat Bar ── */}
      <TicketStatBar tickets={statsRecords} />

      {/* ── Search + Unified Filter + Sort + View Mode ── */}
      <TicketToolbar
        isOverdueActive={isOverdueActive}   onOverdueToggle={handleOverdueToggle}
        filterStatus={filterStatus}          onFilterStatusChange={handleFilterStatusChange}
        sortKey={sortKey}                    sortDir={sortDir}  onSort={handleSort}
        onClearFilters={handleClearFilters}
        isLoading={isLoading}
        overdueTotal={overdueTotal}
      />


      {/* ── Loading skeleton ── */}
      {isLoading && <LoadingSkeleton count={PAGE_SIZE} className="h-12 w-full" />}

      {/* ── Empty state ── */}
      {isEmpty && (
        <EmptyState
          icon={<IconTicket width={28} height={28} />}
          title={filterStatus ? 'Không tìm thấy ticket nào' : 'Không có ticket nào'}
          description={
            filterStatus
              ? 'Thử thay đổi bộ lọc.'
              : 'Chưa có ticket nào được gán cho bạn trong mục này.'
          }
        />
      )}

      {/* ── TABLE VIEW ── */}
      {hasResults && (
        <TicketTableView
          records={displayRecords}
          sortKey={sortKey}       sortDir={sortDir}   onSort={handleSort}
          page={safePage}         totalItems={paginTotal}
          onPage={setPage}
          onUpdateStatus={setStatusModal}
          onReassign={setReassignModal}
        />
      )}

      {/* ── Modals ── */}
      {statusModal   && <UpdateStatusModal ticket={statusModal}   onClose={() => setStatusModal(null)} />}
      {reassignModal && <ReassignModal     ticket={reassignModal} onClose={() => setReassignModal(null)} />}
    </div>
  )
}
