// useTicketsPageData.ts — Custom hook: toàn bộ data fetching + derived state cho TechnicianTicketsPage
// Bóc tách khỏi Page component để:
//   1. Page chỉ còn render UI thuần túy
//   2. Logic phức tạp (dual-mode fetch, useMemo pipeline) dễ test riêng
//   3. Tái sử dụng nếu sau này có màn hình tương tự (Admin xem ticket của Technician)
import { useState, useMemo, useCallback } from 'react'
import { useTicketsList } from '@/hooks/shared/useTickets'
import { isSlaBreached } from '@/components/features/technician/tickets/ticketHelpers'
import { sortTickets, filterBySearch, filterByStatus } from '@/components/features/technician/tickets/ticketListTypes'
import { PAGE_SIZE } from '@/components/features/technician/tickets/ticketListTypes'
import type { Ticket, TicketStatus } from '@/types'
import type { TechTab, SortKey, SortDir, ViewMode } from '@/components/features/technician/tickets/ticketListTypes'

export interface TicketsPageState {
  // isOverdueActive thay thế activeTab trong public API — TicketToolbar không cần biết về TechTab
  isOverdueActive: boolean
  viewMode: ViewMode
  sortKey: SortKey
  sortDir: SortDir
  search: string
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
  handleSearchChange: (val: string) => void
  handleFilterStatusChange: (val: TicketStatus | '') => void
  handleClearFilters: () => void
  handleViewModeChange: (mode: ViewMode) => void
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
  const [viewMode,      setViewMode]      = useState<ViewMode>('table')
  const [sortKey,       setSortKey]       = useState<SortKey>('priority')
  const [sortDir,       setSortDir]       = useState<SortDir>('asc')
  const [search,        setSearch]        = useState('')
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

  // Pipeline: overdue filter → search → status filter → sort
  const filteredRecords = useMemo(() => {
    let list = isOverdue ? records.filter(isSlaBreached) : records
    list = filterBySearch(list, search)
    // FIX: filterStatus trên overdue tab vẫn client-side (bulk data)
    if (isOverdue) list = filterByStatus(list, filterStatus)
    return sortTickets(list, sortKey, sortDir)
  }, [records, isOverdue, search, filterStatus, sortKey, sortDir])

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
    else { setSortKey(key); setSortDir('asc') }
    resetPage()
  }, [sortKey, resetPage])

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val)
    resetPage()
  }, [resetPage])

  const handleFilterStatusChange = useCallback((val: TicketStatus | '') => {
    // Nếu đang ở overdue, click chip status → switch về mine
    if (activeTab === 'overdue') setActiveTab('mine')
    setFilterStatus(val)
    resetPage()
  }, [activeTab, resetPage])

  const handleClearFilters = useCallback(() => {
    setActiveTab('mine')
    setSearch('')
    setFilterStatus('')
    setSortKey('priority')
    setSortDir('asc')
    resetPage()
  }, [resetPage])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
  }, [])

  return {
    // State (public)
    isOverdueActive: isOverdue, // alias cho TicketToolbar — mapping từ internal activeTab
    viewMode, sortKey, sortDir, search, filterStatus, page,
    statusModal, reassignModal,
    // Actions
    handleOverdueToggle, handleSort,
    handleSearchChange, handleFilterStatusChange, handleClearFilters, handleViewModeChange,
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
