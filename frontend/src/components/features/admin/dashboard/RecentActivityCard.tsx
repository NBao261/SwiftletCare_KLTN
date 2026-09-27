import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon, ClockCounterClockwiseIcon } from '@phosphor-icons/react'
import { useAuditLogList } from '@/hooks/admin/useSystem'
import { useUsersPicker } from '@/hooks/admin/useUsers'
import DataTable from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { buildAuditLogColumns } from '@/components/features/admin/audit-log/auditLogColumns'

const PAGE_SIZE = 6

/**
 * "Nhật ký hoạt động gần đây" cuối trang Tổng quan hệ thống — 6 bản ghi mới nhất/trang của GET /system/audit-logs
 * (SYSTEM-FR-001), dùng lại cột bảng của trang Nhật ký hệ thống. Tìm kiếm/lọc đầy đủ ở /system/audit-log.
 */
export default function RecentActivityCard() {
  const [page, setPage] = useState(1)
  const { records, total, isLoading } = useAuditLogList({ page, limit: PAGE_SIZE })
  const actors = useUsersPicker()
  const userNames = useMemo(() => new Map(actors.records.map(u => [u._id, u.full_name])), [actors.records])

  return (
    <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
            <ClockCounterClockwiseIcon size={20} weight="bold" />
          </span>
          <div className="min-w-0">
            <h2 className="text-h2 text-charcoal">Nhật ký hoạt động gần đây</h2>
            <p className="text-small text-graphite">Hành động quản trị và sự kiện hệ thống mới nhất</p>
          </div>
        </div>
        <Link to="/system/audit-log" className="group inline-flex items-center gap-1 text-small font-semibold text-charcoal hover:underline">
          Xem tất cả
          <ArrowRightIcon size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={PAGE_SIZE} className="h-12 w-full" />
      ) : (
        <DataTable
          columns={buildAuditLogColumns((page - 1) * PAGE_SIZE, userNames)}
          rows={records}
          getRowKey={log => log._id}
          emptyMessage="Chưa có nhật ký nào."
        />
      )}
      <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} />
    </section>
  )
}
