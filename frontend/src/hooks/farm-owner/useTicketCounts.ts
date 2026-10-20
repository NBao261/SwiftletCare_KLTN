import { useTicketsList } from '@/hooks/shared/useTickets'

// Số ticket cho hàng KPI + ô lọc trạng thái: đếm bằng meta.total của các truy vấn limit=1 (backend đếm trên DB, đúng phạm vi farm)
export function useTicketCounts() {
  const all = useTicketsList({ limit: 1 })
  const fresh = useTicketsList({ status: 'NEW', limit: 1 })
  const freshUnassigned = useTicketsList({ status: 'NEW', unassigned: true, limit: 1 })
  const inProgress = useTicketsList({ status: 'IN_PROGRESS', limit: 1 })
  const awaiting = useTicketsList({ status: 'AWAITING_FIELD_CONFIRMATION', limit: 1 })
  const closed = useTicketsList({ status: 'CLOSED', limit: 1 })
  // Cờ quá hạn còn giữ sau khi đóng — trừ phần đã đóng để chỉ còn ticket chưa đóng đang quá hạn
  const breached = useTicketsList({ slaBreached: true, limit: 1 })
  const breachedClosed = useTicketsList({ slaBreached: true, status: 'CLOSED', limit: 1 })

  const queries = [all, fresh, freshUnassigned, inProgress, awaiting, closed, breached, breachedClosed]
  // Truy vấn lỗi đầu tiên — có lỗi thì không hiện số 0 giả
  const failedQuery = queries.find(query => query.isError)

  return {
    isLoading: queries.some(query => query.isLoading),
    isError: failedQuery !== undefined,
    error: failedQuery?.error,
    refetch: () => queries.forEach(query => void query.refetch()),
    all: all.total,
    NEW: fresh.total,
    newUnassigned: freshUnassigned.total,
    IN_PROGRESS: inProgress.total,
    AWAITING_FIELD_CONFIRMATION: awaiting.total,
    CLOSED: closed.total,
    openBreached: Math.max(0, breached.total - breachedClosed.total),
  }
}
