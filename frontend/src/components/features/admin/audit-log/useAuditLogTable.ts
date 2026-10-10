// Trạng thái lọc/sắp xếp/phân trang bảng nhật ký tài khoản — dùng chung cho trang Nhật ký hệ thống (AdminAuditLogPage)
// và card "Nhật ký hoạt động gần đây" (trang Tổng quan), để 2 nơi lọc giống hệt nhau mà không chép code.
import { useEffect, useState } from 'react'
import { useAuditLogList, useAllAuditLogs } from '@/hooks/admin/useSystem'
import { AUDIT_ACTION_LABEL, AUDIT_TARGET_TYPE } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { reasonOf } from '@/components/features/admin/audit-log/auditLogColumns'
import type { AuditLogEntry } from '@/types'

export const ALL = ''
const SEARCH_DEBOUNCE_MS = 300

/** Lọc thời gian (dropdown): `days` ngày tính cả hôm nay, tới hết hôm nay */
export const DATE_PRESETS = [
  { value: 'today', label: 'Hôm nay', days: 1 },
  { value: '3d', label: '3 ngày trước', days: 3 },
  { value: '7d', label: '7 ngày trước', days: 7 },
]

/**
 * Backend so sánh `created_at >= from` / `<= to` theo mốc tuyệt đối, nên ngày
 * "đến" phải đẩy tới 23:59:59.999 (giờ máy người dùng) — không thì chọn
 * 20/09 → 20/09 chỉ khớp đúng 00:00:00 của ngày đó và ra rỗng.
 */
function startOfDayIso(date: string) { return new Date(`${date}T00:00:00`).toISOString() }
function endOfDayIso(date: string) { return new Date(`${date}T23:59:59.999`).toISOString() }

/** YYYY-MM-DD theo giờ máy người dùng, lùi `daysAgo` ngày */
function localDay(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Bỏ dấu + đ→d + chữ thường, để "dang nhap" khớp "Đăng nhập" */
function fold(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase()
}

/** Substring trên hành động, người thực hiện, vai trò, tên tài khoản bị tác động, lý do */
function matchesSearch(log: AuditLogEntry, q: string) {
  return [
    AUDIT_ACTION_LABEL[log.action] ?? log.action,
    log.actor_id?.full_name,
    log.actor_id && ROLE_LABEL[log.actor_id.role],
    log.target_name,
    reasonOf(log),
  ].some(s => s && fold(s).includes(q))
}

export function useAuditLogTable(pageSize: number, initial: { action?: string; search?: string } = {}) {
  const [actorId, setActorId] = useState(ALL)
  const [action, setAction] = useState(initial.action ?? ALL)
  const [datePreset, setDatePreset] = useState(ALL)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(initial.search ?? '')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  const preset = DATE_PRESETS.find(p => p.value === datePreset)
  const serverFilters = {
    targetType: AUDIT_TARGET_TYPE,
    actorId: actorId || undefined,
    action: action || undefined,
    from: preset ? startOfDayIso(localDay(preset.days - 1)) : undefined,
    to: preset ? endOfDayIso(localDay(0)) : undefined,
  }
  const q = fold(debouncedSearch.trim())
  // /system/audit-logs không có tìm chữ và luôn trả created_at giảm dần. Mặc định dùng phân trang server
  // (nhẹ); khi tìm chữ hoặc sắp "cũ nhất trước" thì tải TOÀN BỘ nhật ký khớp bộ lọc server rồi lọc/đảo/cắt
  // trang ở client — tìm ra bao nhiêu thì phân trang đúng bấy nhiêu, không chỉ trong trang đang xem.
  const clientSide = !!q || sortDir === 'asc'
  const serverPage = useAuditLogList({ ...serverFilters, page, limit: pageSize })
  const all = useAllAuditLogs(serverFilters, clientSide)

  let visible: AuditLogEntry[]
  let total: number
  let isLoading: boolean
  if (clientSide) {
    const matched = (all.data ?? []).filter(log => !q || matchesSearch(log, q))
    const ordered = sortDir === 'asc' ? [...matched].reverse() : matched
    visible = ordered.slice((page - 1) * pageSize, page * pageSize)
    total = ordered.length
    isLoading = all.isLoading
  } else {
    visible = serverPage.records
    total = serverPage.total
    isLoading = serverPage.isLoading
  }

  /** Đổi bất kỳ bộ lọc nào thì quay về trang 1 — trang N của bộ lọc cũ có thể không tồn tại ở bộ lọc mới */
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1) }
  }

  return {
    actorId, setActorId: withReset(setActorId),
    action, setAction: withReset(setAction),
    datePreset, setDatePreset: withReset(setDatePreset),
    search, setSearch: withReset(setSearch), debouncedSearch,
    sortDir, toggleSort: () => { setSortDir(d => (d === 'desc' ? 'asc' : 'desc')); setPage(1) },
    page, setPage,
    visible, total, isLoading,
    hasFilter: !!(actorId || action || datePreset || search.trim()) || sortDir === 'asc',
    clearFilters: () => {
      setActorId(ALL); setAction(ALL); setDatePreset(ALL); setSearch(''); setSortDir('desc'); setPage(1)
    },
  }
}

export type AuditLogTableState = ReturnType<typeof useAuditLogTable>
