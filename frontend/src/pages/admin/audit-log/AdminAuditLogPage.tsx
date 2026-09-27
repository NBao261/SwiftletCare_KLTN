// ADMIN — Nhật ký hệ thống (SYSTEM-FR-001): GET /system/audit-logs, lọc theo
// người thực hiện / hành động / khoảng ngày (server) + ô tìm kiếm & sắp xếp (client, trên
// TOÀN BỘ nhật ký khớp bộ lọc). Hiển thị 1 bảng DataTable như trang Người dùng.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuditLogList, useAllAuditLogs } from '@/hooks/admin/useSystem'
import { useUsersPicker } from '@/hooks/admin/useUsers'
import { AUDIT_ACTION_LABEL } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { Button, ClearFiltersButton, SearchInput, SortChips } from '@/components/ui'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import { IconSearch } from '@/components/ui/icons'
import { buildAuditLogColumns, targetName } from '@/components/features/admin/audit-log/auditLogColumns'
import AuditLogStats from '@/components/features/admin/audit-log/AuditLogStats'
import type { AuditLogEntry } from '@/types'

const PAGE_SIZE = 10
const ALL = ''
const SEARCH_DEBOUNCE_MS = 300

const ACTION_OPTIONS: SelectMenuOption<string>[] = [
  { value: ALL, label: 'Tất cả hành động' },
  ...Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ value, label })),
]

/**
 * Backend so sánh `created_at >= from` / `<= to` theo mốc tuyệt đối, nên ngày
 * "đến" phải đẩy tới 23:59:59.999 (giờ máy người dùng) — không thì chọn
 * 20/09 → 20/09 chỉ khớp đúng 00:00:00 của ngày đó và ra rỗng.
 */
function startOfDayIso(date: string) { return new Date(`${date}T00:00:00`).toISOString() }
function endOfDayIso(date: string) { return new Date(`${date}T23:59:59.999`).toISOString() }

/** YYYY-MM-DD theo giờ máy người dùng, lùi `daysAgo` ngày — cùng định dạng value của <input type="date"> */
function localDay(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Lọc thời gian (dropdown): `days` ngày tính cả hôm nay, tới hết hôm nay */
const DATE_PRESETS = [
  { value: 'today', label: 'Hôm nay', days: 1 },
  { value: '3d', label: '3 ngày trước', days: 3 },
  { value: '7d', label: '7 ngày trước', days: 7 },
]

/** Bỏ dấu + đ→d + chữ thường, để "dang nhap" khớp "Đăng nhập" */
function fold(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase()
}

/** Substring trên hành động, người thực hiện, vai trò, tên/ID đối tượng, IP */
function matchesSearch(log: AuditLogEntry, q: string, userNames: Map<string, string>) {
  return [
    AUDIT_ACTION_LABEL[log.action] ?? log.action,
    log.actor_id?.full_name,
    log.actor_id && ROLE_LABEL[log.actor_id.role],
    targetName(log, userNames),
    log.target_id,
    log.ip_address,
  ].some(s => s && fold(s).includes(q))
}

export default function AdminAuditLogPage() {
  // ?action= (link "Xem lịch sử thay đổi" từ Cấu hình mặc định) và ?q= chỉ đọc làm giá trị khởi tạo;
  // riêng q được ghi ngược lên URL để giữ khi reload/chia sẻ link.
  const [searchParams, setSearchParams] = useSearchParams()
  const [actorId, setActorId] = useState(ALL)
  const [action, setAction] = useState(() => {
    const fromUrl = searchParams.get('action') ?? ALL
    return fromUrl in AUDIT_ACTION_LABEL ? fromUrl : ALL
  })
  const [datePreset, setDatePreset] = useState(ALL)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        if (search.trim()) next.set('q', search.trim())
        else next.delete('q')
        return next
      }, { replace: true })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search, setSearchParams])

  const actors = useUsersPicker()
  const actorOptions: SelectMenuOption<string>[] = [
    { value: ALL, label: 'Tất cả người thực hiện' },
    ...actors.records.map(u => ({ value: u._id, label: `${u.full_name} · ${ROLE_LABEL[u.role]}` })),
  ]
  // Cùng danh sách tài khoản của dropdown trên → tra tên cho đối tượng loại Người dùng
  const userNames = useMemo(() => new Map(actors.records.map(u => [u._id, u.full_name])), [actors.records])

  const preset = DATE_PRESETS.find(p => p.value === datePreset)
  const from = preset ? localDay(preset.days - 1) : ''
  const to = preset ? localDay(0) : ''

  const serverFilters = {
    actorId: actorId || undefined,
    action: action || undefined,
    from: from ? startOfDayIso(from) : undefined,
    to: to ? endOfDayIso(to) : undefined,
  }
  const q = fold(debouncedSearch.trim())
  // /system/audit-logs không có tìm chữ và luôn trả created_at giảm dần. Mặc định dùng phân trang server
  // (nhẹ); khi tìm chữ hoặc sắp "cũ nhất trước" thì tải TOÀN BỘ nhật ký khớp bộ lọc server rồi lọc/đảo/cắt
  // trang ở client — tìm ra bao nhiêu thì phân trang đúng bấy nhiêu, không chỉ trong trang đang xem.
  const clientSide = !!q || sortDir === 'asc'
  const serverPage = useAuditLogList({ ...serverFilters, page, limit: PAGE_SIZE })
  const all = useAllAuditLogs(serverFilters, clientSide)

  let visible: AuditLogEntry[]
  let total: number
  let isLoading: boolean
  if (clientSide) {
    const matched = (all.data ?? []).filter(log => !q || matchesSearch(log, q, userNames))
    const ordered = sortDir === 'asc' ? [...matched].reverse() : matched
    visible = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    total = ordered.length
    isLoading = all.isLoading
  } else {
    visible = serverPage.records
    total = serverPage.total
    isLoading = serverPage.isLoading
  }

  const hasFilter = !!(actorId || action || datePreset || search.trim()) || sortDir === 'asc'

  /** Đổi bất kỳ bộ lọc nào thì quay về trang 1 — trang N của bộ lọc cũ có thể không tồn tại ở bộ lọc mới */
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1) }
  }

  const dateOptions: SelectMenuOption<string>[] = [
    { value: ALL, label: 'Tất cả thời gian' },
    ...DATE_PRESETS.map(({ value, label }) => ({ value, label })),
  ]

  function clearFilters() {
    setActorId(ALL); setAction(ALL); setDatePreset(ALL); setSearch(''); setSortDir('desc'); setPage(1)
  }

  return (
    // Tiêu đề trang do AppHeader (topbar) tự tra từ menu — không lặp lại trong nội dung
    <div className="flex min-w-0 flex-col gap-5">
      {/* Hàng 0: 5 ô chỉ số (chỉ xem) — số liệu toàn hệ thống, cùng khuôn trang Ticket/Người dùng */}
      <AuditLogStats />

      {/* Hàng 1: ô tìm kiếm cỡ mặc định, rộng hết hàng — cùng bố cục trang Người dùng */}
      <SearchInput
        placeholder="Tìm theo hành động, người thực hiện, IP..."
        aria-label="Tìm nhật ký"
        value={search}
        // Tìm trên toàn bộ nhật ký → gõ từ khoá thì về trang 1
        onChange={withReset(setSearch)}
      />

      {/* Hàng 2: bộ lọc */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SelectMenu ariaLabel="Lọc theo người thực hiện" value={actorId} options={actorOptions} onChange={withReset(setActorId)} className="max-w-[16rem]" />
          <SelectMenu ariaLabel="Lọc theo hành động" value={action} options={ACTION_OPTIONS} onChange={withReset(setAction)} className="max-w-[16rem]" />
          <span className="label-caption">Thời gian:</span>
          <SelectMenu ariaLabel="Lọc theo khoảng thời gian" value={datePreset} options={dateOptions} onChange={withReset(setDatePreset)} className="max-w-[16rem]" />
          {/* 1 trường duy nhất, luôn đang chọn — bấm chỉ đảo chiều mới nhất/cũ nhất */}
          <SortChips
            fields={[{ key: 'time', label: 'Thời gian' }]}
            sortBy="time"
            sortDir={sortDir}
            onChange={() => { setSortDir(d => (d === 'desc' ? 'asc' : 'desc')); setPage(1) }}
          />
          {hasFilter && (
            <ClearFiltersButton onClick={clearFilters} />
          )}
        </div>
        {actors.truncated && (
          <p className="text-xs text-warmGray">
            Ô "người thực hiện" chỉ liệt kê {actors.records.length}/{actors.total} tài khoản đầu tiên (giới hạn 1 trang của /admin/users).
          </p>
        )}
      </div>

      {isLoading && <div className="flex flex-col gap-2"><LoadingSkeleton count={6} className="h-14 w-full" /></div>}

      {!isLoading && visible.length === 0 && (
        <EmptyState
          icon={<IconSearch width={28} height={28} />}
          title={hasFilter ? 'Không tìm thấy nhật ký phù hợp' : 'Chưa có nhật ký nào'}
          description={hasFilter
            ? 'Thử từ khoá khác, đổi khoảng thời gian hoặc bỏ bớt bộ lọc.'
            : 'Hành động quản trị (khoá tài khoản, đổi ngưỡng, can thiệp ticket...) sẽ được ghi lại ở đây.'}
          action={hasFilter ? <Button variant="secondary" size="sm" onClick={clearFilters}>Xoá bộ lọc</Button> : undefined}
        />
      )}

      {!isLoading && visible.length > 0 && (
        <DataTable columns={buildAuditLogColumns((page - 1) * PAGE_SIZE, userNames)} rows={visible} getRowKey={log => log._id} />
      )}

      {/* total = số nhật ký SAU khi tìm chữ — tìm ra 3 thì hiện "1–3 trong 3" */}
      <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} />
    </div>
  )
}
