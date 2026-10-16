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

const DEFAULT_SORT_KEY: SortKey = 'created_at'
const DEFAULT_SORT_DIR: SortDir = 'desc'

export interface TicketsPageState {
  // isOverdueActive thay thế activeTab trong public API — TicketToolbar không cần biết về TechTab
  isOverdueActive: boolean
  /** Tab "Hàng đợi chung": ticket chưa gán (GET /tickets?unassigned=true) — chỉ xem */
  isQueueActive: boolean
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
  handleQueueToggle: () => void
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
  const [activeTab, setActiveTab] = useState<TechTab>('mine')
  // Mặc định khớp thứ tự backend (GET /tickets luôn trả created_at desc, chưa có tham số sort)
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY)
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR)
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('')
  const [page, setPage] = useState(1)
  const [statusModal, setStatusModal] = useState<Ticket | null>(null)
  const [reassignModal, setReassignModal] = useState<Ticket | null>(null)

  // ── Data Fetch — Chế độ 1: server pagination (mine + in_progress) ─────────
  // FIX (round 5): filterStatus đưa lên server để pagination không sai
  const serverQuery = useTicketsList(
    activeTab === 'unassigned'
      // Hàng đợi chung: BE bỏ qua `unassigned` nếu có assignedToMe → KHÔNG gửi assignedToMe
      ? { unassigned: true, ...(filterStatus ? { status: filterStatus as TicketStatus } : {}), page, limit: PAGE_SIZE }
      : {
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
  const isQueue = activeTab === 'unassigned'
  const records = isOverdue ? overdueQuery.records : serverQuery.records
  const total = isOverdue ? overdueQuery.total : serverQuery.total
  const isLoading = isOverdue ? overdueQuery.isLoading : serverQuery.isLoading

  // Pipeline: overdue filter → status filter → sort — CHỈ áp dụng ở tab Quá hạn SLA (đã tải toàn bộ).
  // Tab phân trang server giữ nguyên thứ tự backend: sort trên 1 trang 12 dòng sẽ làm lệch thứ tự giữa các trang.
  // TODO [BE-GAP]: khi GET /tickets hỗ trợ ?sort=, gửi sortKey/sortDir xuống server.
  const filteredRecords = useMemo(() => {
    if (!isOverdue) return records
    const list = filterByStatus(records.filter(isSlaBreached), filterStatus)
    return sortTickets(list, sortKey, sortDir)
  }, [records, isOverdue, filterStatus, sortKey, sortDir])

  const clientTotal = filteredRecords.length
  const paginTotal = isOverdue ? clientTotal : total
  const totalPages = Math.max(1, Math.ceil(paginTotal / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const displayRecords = isOverdue
    ? filteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filteredRecords

  // ── Actions ───────────────────────────────────────────────────────────────
  const resetPage = useCallback(() => setPage(1), [])
  const resetSort = useCallback(() => { setSortKey(DEFAULT_SORT_KEY); setSortDir(DEFAULT_SORT_DIR) }, [])

  /** Toggle chế độ Quá hạn SLA — thay thế handleTabChange trong public API */
  const handleOverdueToggle = useCallback(() => {
    if (activeTab === 'overdue') {
      // Tắt overdue → về tab 'mine' (tất cả), trả sort về thứ tự server
      setActiveTab('mine')
      resetSort()
    } else {
      // Bật overdue → clear filter status để tránh conflict
      setActiveTab('overdue')
      setFilterStatus('')
    }
    resetPage()
  }, [activeTab, resetPage, resetSort])

  /** Toggle "Hàng đợi chung" — clear filter status để tránh conflict */
  const handleQueueToggle = useCallback(() => {
    if (activeTab === 'unassigned') {
      setActiveTab('mine')
    } else {
      setActiveTab('unassigned')
      setFilterStatus('')
    }
    resetSort()
    resetPage()
  }, [activeTab, resetPage, resetSort])

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') } // Default to desc for new keys
    resetPage()
  }, [sortKey, resetPage])

  const handleFilterStatusChange = useCallback((val: TicketStatus | '') => {
    // Nếu đang ở overdue / hàng đợi chung, click chip status → switch về mine
    if (activeTab === 'overdue' || activeTab === 'unassigned') setActiveTab('mine')
    setFilterStatus(val)
    resetSort()
    resetPage()
  }, [activeTab, resetPage, resetSort])

  const handleClearFilters = useCallback(() => {
    setActiveTab('mine')
    setFilterStatus('')
    resetSort()
    resetPage()
  }, [resetPage, resetSort])

  return {
    // State (public)
    isOverdueActive: isOverdue, // alias cho TicketToolbar — mapping từ internal activeTab
    isQueueActive: isQueue,
    sortKey, sortDir, filterStatus, page,
    statusModal, reassignModal,
    // Actions
    handleOverdueToggle, handleQueueToggle, handleSort,
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
