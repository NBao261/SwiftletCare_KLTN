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
import Pagination from '@/components/ui/Pagination'
import { IconTicket } from '@/components/ui/icons'
import { TicketStatBar } from '@/components/features/technician/tickets/TicketStatBar'
import { TicketCard } from '@/components/features/technician/tickets/TicketCard'
import { TicketToolbar } from '@/components/features/technician/tickets/TicketToolbar'
import { TicketTableView } from '@/components/features/technician/tickets/TicketTableView'
import { UpdateStatusModal } from '@/components/features/technician/tickets/UpdateStatusModal'
import { ReassignModal } from '@/components/features/technician/tickets/ReassignModal'
import { useTicketsPageData } from '@/components/features/technician/tickets/useTicketsPageData'
import { PAGE_SIZE } from '@/components/features/technician/tickets/ticketListTypes'

export default function TechnicianTicketsPage() {
  const {
    // UI state
    isOverdueActive, viewMode, sortKey, sortDir, search, filterStatus,
    statusModal, reassignModal,
    // Actions
    handleOverdueToggle, handleSort,
    handleSearchChange, handleFilterStatusChange, handleClearFilters, handleViewModeChange,
    setPage, setStatusModal, setReassignModal,
    // Data
    displayRecords, filteredRecords,
    safePage, totalPages, paginTotal,
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
        search={search}                      onSearchChange={handleSearchChange}
        viewMode={viewMode}                  onViewModeChange={handleViewModeChange}
        sortKey={sortKey}                    sortDir={sortDir}  onSort={handleSort}
        onClearFilters={handleClearFilters}
        isLoading={isLoading}                resultCount={filteredRecords.length}
        overdueTotal={overdueTotal}
      />


      {/* ── Loading skeleton ── */}
      {isLoading && <LoadingSkeleton count={PAGE_SIZE} className="h-12 w-full" />}

      {/* ── Empty state ── */}
      {isEmpty && (
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
      {hasResults && viewMode === 'table' && (
        <TicketTableView
          records={displayRecords}
          sortKey={sortKey}       sortDir={sortDir}   onSort={handleSort}
          page={safePage}         totalItems={paginTotal}
          onPage={setPage}
          onUpdateStatus={setStatusModal}
          onReassign={setReassignModal}
        />
      )}

      {/* ── CARD VIEW ── */}
      {hasResults && viewMode === 'card' && (
        <div className="flex flex-col gap-3">
          {displayRecords.map(ticket => (
            <TicketCard
              key={ticket._id}
              ticket={ticket}
              onUpdateStatus={setStatusModal}
              onReassign={setReassignModal}
            />
          ))}
          {totalPages > 1 && (
            <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
              <Pagination
                page={safePage}
                total={paginTotal}
                limit={PAGE_SIZE}
                onChange={setPage}
                variant="numbered"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {statusModal   && <UpdateStatusModal ticket={statusModal}   onClose={() => setStatusModal(null)} />}
      {reassignModal && <ReassignModal     ticket={reassignModal} onClose={() => setReassignModal(null)} />}
    </div>
  )
}
