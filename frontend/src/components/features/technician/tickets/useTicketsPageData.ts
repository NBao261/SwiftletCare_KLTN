// useTicketsPageData.ts — Custom hook: toàn bộ data fetching + derived state cho TechnicianTicketsPage
// Bóc tách khỏi Page component để:
//   1. Page chỉ còn render UI thuần túy
//   2. Logic phức tạp (dual-mode fetch, useMemo pipeline) dễ test riêng
//   3. Tái sử dụng nếu sau này có màn hình tương tự (Admin xem ticket của Technician)
import { useState, useMemo, useCallback } from 'react'
import { useTicketsList } from '@/hooks/shared/useTickets'
import { isSlaBreached } from '@/components/features/technician/tickets/ticketHelpers'
import { sortTickets, filterByStatus } from '@/components/features/technician/tickets/ticketListTypes'
import { PAGE_SIZE } from '@/components/features/technician/tickets/ticketListTypes'
import type { Ticket, TicketStatus } from '@/types'
import type { TechTab, SortKey, SortDir } from '@/components/features/technician/tickets/ticketListTypes'

export interface TicketsPageState {
  // isOverdueActive thay thế activeTab trong public API — TicketToolbar không cần biết về TechTab
  isOverdueActive: boolean
  sortKey: SortKey
  sortDir: SortDir
  filterStatus: TicketStatus | ''
  page: number
  // Modals
  statusModal: Ticket | null
  reassignModal: Ticket | null
}

export interface TicketsPageActions {
  // handleTabChange đã ẩn khỏi public API — dùng handleOverdueToggle thay thế
  handleOverdueToggle: () => void
  handleSort: (key: SortKey) => void
  // TODO [BE-GAP]: handleSearchChange sẽ được expose lại khi BE hỗ trợ ?search= param
  handleFilterStatusChange: (val: TicketStatus | '') => void
  handleClearFilters: () => void
  setPage: (p: number) => void
  setStatusModal: (t: Ticket | null) => void
  setReassignModal: (t: Ticket | null) => void
}

export interface TicketsPageData {
  displayRecords: Ticket[]
  filteredRecords: Ticket[]
  safePage: number
  totalPages: number
  paginTotal: number
  isLoading: boolean
  statsRecords: Ticket[]
  total: number
  // isOverdue vẫn giữ cho các warning/logic nội bộ, map từ isOverdueActive
  isOverdue: boolean
  overdueTotal: number
}

export function useTicketsPageData(): TicketsPageState & TicketsPageActions & TicketsPageData {
  // ── UI State ──────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState<TechTab>('mine')
  const [sortKey,       setSortKey]       = useState<SortKey>('created_at')
  const [sortDir,       setSortDir]       = useState<SortDir>('desc')
  const [filterStatus,  setFilterStatus]  = useState<TicketStatus | ''>('')
  const [page,          setPage]          = useState(1)
  const [statusModal,   setStatusModal]   = useState<Ticket | null>(null)
  const [reassignModal, setReassignModal] = useState<Ticket | null>(null)

  // ── Data Fetch — Chế độ 1: server pagination (mine + in_progress) ─────────
  // FIX (round 5): filterStatus đưa lên server để pagination không sai
  const serverQuery = useTicketsList(
    {
      assignedToMe: true,
      ...(activeTab === 'in_progress' ? { status: 'IN_PROGRESS' } : {}),
      ...(filterStatus && activeTab !== 'overdue' ? { status: filterStatus as TicketStatus } : {}),
      page,
      limit: PAGE_SIZE,
    },
    { enabled: activeTab !== 'overdue' },
  )

  // ── Data Fetch — Chế độ 2: bulk fetch cho overdue (client-side paginate) ──
  // TODO [BE-GAP]: khi backend hỗ trợ ?slaBreached=true, chuyển về server pagination.
  const overdueQuery = useTicketsList(
    { assignedToMe: true, limit: 100 },
    { enabled: activeTab === 'overdue', staleTime: 30_000 },
  )

  // ── Data Fetch — Stats query: luôn chạy (TicketStatBar không dùng KPI endpoint vì ADMIN-only) ──
  const statsQuery = useTicketsList(
    { assignedToMe: true, limit: 50 },
    { staleTime: 60_000 },
  )

  // ── Derived state ─────────────────────────────────────────────────────────
  const isOverdue = activeTab === 'overdue'
  const records   = isOverdue ? overdueQuery.records : serverQuery.records
  const total     = isOverdue ? overdueQuery.total : serverQuery.total
  const isLoading = isOverdue ? overdueQuery.isLoading : serverQuery.isLoading

  // Pipeline: overdue filter → status filter (overdue tab only, client-side bulk) → sort
  // Lưu ý: filterBySearch đã được GỤ Bỏ — search đang disabled ở TicketToolbar (chưa có BE hỗ trợ).
  // filterStatus được gửi xuống server (đã fix từ round 5), nên không cần client-filter ở tab mine/in_progress.
  const filteredRecords = useMemo(() => {
    let list = isOverdue ? records.filter(isSlaBreached) : records
    // filterStatus trên overdue tab vẫn client-side (bulk data)
    if (isOverdue) list = filterByStatus(list, filterStatus)
    return sortTickets(list, sortKey, sortDir)
  }, [records, isOverdue, filterStatus, sortKey, sortDir])

  const clientTotal    = filteredRecords.length
  const paginTotal     = isOverdue ? clientTotal : total
  const totalPages     = Math.max(1, Math.ceil(paginTotal / PAGE_SIZE))
  const safePage       = Math.min(page, totalPages)
  const displayRecords = isOverdue
    ? filteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filteredRecords

  // ── Actions ───────────────────────────────────────────────────────────────
  const resetPage = useCallback(() => setPage(1), [])

  /** Toggle chế độ Quá hạn SLA — thay thế handleTabChange trong public API */
  const handleOverdueToggle = useCallback(() => {
    if (activeTab === 'overdue') {
      // Tắt overdue → về tab 'mine' (tất cả)
      setActiveTab('mine')
    } else {
      // Bật overdue → clear filter status để tránh conflict
      setActiveTab('overdue')
      setFilterStatus('')
    }
    resetPage()
  }, [activeTab, resetPage])

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') } // Default to desc for new keys
    resetPage()
  }, [sortKey, resetPage])


  const handleFilterStatusChange = useCallback((val: TicketStatus | '') => {
    // Nếu đang ở overdue, click chip status → switch về mine
    if (activeTab === 'overdue') setActiveTab('mine')
    setFilterStatus(val)
    resetPage()
  }, [activeTab, resetPage])

  const handleClearFilters = useCallback(() => {
    setActiveTab('mine')
    setFilterStatus('')
    setSortKey('created_at')
    setSortDir('desc')
    resetPage()
  }, [resetPage])



  return {
    // State (public)
    isOverdueActive: isOverdue, // alias cho TicketToolbar — mapping từ internal activeTab
    sortKey, sortDir, filterStatus, page,
    statusModal, reassignModal,
    // Actions
    handleOverdueToggle, handleSort,
    handleFilterStatusChange, handleClearFilters,
    setPage, setStatusModal, setReassignModal,
    // Data
    displayRecords, filteredRecords,
    safePage, totalPages, paginTotal,
    isLoading,
    statsRecords: statsQuery.records,
    total,
    isOverdue, // giữ cho Page dùng trong EmptyState
    overdueTotal: overdueQuery.total,
  }
}
