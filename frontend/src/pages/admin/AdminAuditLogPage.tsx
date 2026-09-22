// ADMIN — Nhật ký hệ thống (SYSTEM-FR-001): GET /system/audit-logs, lọc theo
// người thực hiện / hành động / khoảng ngày, phân trang server.
import { useState } from 'react'
import { useAuditLogList } from '@/hooks/admin/useSystem'
import { useUsersPicker } from '@/hooks/admin/useUsers'
import { AUDIT_ACTION_LABEL, AUDIT_TARGET_LABEL } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { Card, Badge, Button } from '@/components/ui'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import { IconSettings } from '@/components/ui/icons'
import { formatDate } from '@/lib/helpers'
import type { AuditLogEntry } from '@/types'

const PAGE_SIZE = 20
const ALL = ''

const ACTION_OPTIONS: SelectMenuOption<string>[] = [
  { value: ALL, label: 'Mọi hành động' },
  ...Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ value, label })),
]

/**
 * Backend so sánh `created_at >= from` / `<= to` theo mốc tuyệt đối, nên ngày
 * "đến" phải đẩy tới 23:59:59.999 (giờ máy người dùng) — không thì chọn
 * 20/09 → 20/09 chỉ khớp đúng 00:00:00 của ngày đó và ra rỗng.
 */
function startOfDayIso(date: string) { return new Date(`${date}T00:00:00`).toISOString() }
function endOfDayIso(date: string) { return new Date(`${date}T23:59:59.999`).toISOString() }

export default function AdminAuditLogPage() {
  const [actorId, setActorId] = useState(ALL)
  const [action, setAction] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const actors = useUsersPicker()
  const actorOptions: SelectMenuOption<string>[] = [
    { value: ALL, label: 'Mọi người thực hiện' },
    ...actors.records.map(u => ({ value: u._id, label: `${u.full_name} · ${ROLE_LABEL[u.role]}` })),
  ]

  const { records, total, limit, isLoading } = useAuditLogList({
    actorId: actorId || undefined,
    action: action || undefined,
    from: from ? startOfDayIso(from) : undefined,
    to: to ? endOfDayIso(to) : undefined,
    page,
    limit: PAGE_SIZE,
  })

  const hasFilter = !!(actorId || action || from || to)
  const invalidRange = !!from && !!to && from > to

  /** Đổi bất kỳ bộ lọc nào thì quay về trang 1 — trang N của bộ lọc cũ có thể không tồn tại ở bộ lọc mới */
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1) }
  }

  function clearFilters() {
    setActorId(ALL); setAction(ALL); setFrom(''); setTo(''); setPage(1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="label-caption">Quản trị hệ thống</p>
        <h1 className="text-h1 tracking-tight text-charcoal">Nhật ký hệ thống</h1>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SelectMenu ariaLabel="Lọc theo người thực hiện" value={actorId} options={actorOptions} onChange={withReset(setActorId)} className="max-w-[16rem]" />
          <SelectMenu ariaLabel="Lọc theo hành động" value={action} options={ACTION_OPTIONS} onChange={withReset(setAction)} className="max-w-[16rem]" />
          <input type="date" aria-label="Từ ngày" className="input h-8 w-auto rounded-full px-3.5 py-0 text-xs" value={from} max={to || undefined} onChange={e => withReset(setFrom)(e.target.value)} />
          <span className="text-xs text-warmGray">đến</span>
          <input type="date" aria-label="Đến ngày" className="input h-8 w-auto rounded-full px-3.5 py-0 text-xs" value={to} min={from || undefined} onChange={e => withReset(setTo)(e.target.value)} />
          {hasFilter && (
            <Button variant="danger" size="sm" className="h-8 px-3.5 text-xs" onClick={clearFilters}>Hủy lọc</Button>
          )}
        </div>
        {invalidRange && <p className="text-xs text-alertRed">Ngày "từ" đang sau ngày "đến" — không có kết quả nào khớp.</p>}
        {actors.truncated && (
          <p className="text-xs text-warmGray">
            Ô "người thực hiện" chỉ liệt kê {actors.records.length}/{actors.total} tài khoản đầu tiên (giới hạn 1 trang của /admin/users).
          </p>
        )}
      </div>

      {isLoading && <LoadingSkeleton count={4} className="h-16 w-full" />}

      {!isLoading && records.length === 0 && (
        <EmptyState
          icon={<IconSettings width={28} height={28} />}
          title={hasFilter ? 'Không có nhật ký nào khớp bộ lọc' : 'Chưa có nhật ký nào'}
          description={hasFilter ? 'Thử đổi khoảng thời gian hoặc bỏ bớt bộ lọc.' : 'Hành động quản trị (khoá tài khoản, đổi ngưỡng, can thiệp ticket...) sẽ được ghi lại ở đây.'}
        />
      )}

      <div className="flex flex-col gap-2">
        {records.map(log => <AuditLogRow key={log._id} log={log} />)}
      </div>

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />
    </div>
  )
}

function AuditLogRow({ log }: { log: AuditLogEntry }) {
  const reason = typeof log.metadata?.reason === 'string' ? log.metadata.reason : undefined
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-charcoal">{AUDIT_ACTION_LABEL[log.action] ?? log.action}</p>
          {log.actor_id
            ? <Badge tone="info">{log.actor_id.full_name} · {ROLE_LABEL[log.actor_id.role]}</Badge>
            : <Badge tone="neutral">Hệ thống</Badge>}
        </div>
        <p className="mt-1 truncate text-xs text-warmGray">
          {AUDIT_TARGET_LABEL[log.target_type] ?? log.target_type}
          {log.target_id && <> · <span className="font-mono">{log.target_id}</span></>}
          {log.ip_address && <> · IP {log.ip_address}</>}
        </p>
        {reason && <p className="mt-1 truncate text-xs text-charcoal">Lý do: {reason}</p>}
      </div>
      <span className="shrink-0 text-xs text-warmGray">{formatDate(log.created_at)}</span>
    </Card>
  )
}
