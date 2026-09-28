import { CalendarBlankIcon, ClipboardTextIcon, HandPalmIcon, TimerIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react'
import { useAuditLogList } from '@/hooks/admin/useSystem'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import StatTile from '@/components/ui/StatTile'
import type { ListAuditLogsQuery } from '@/apis/admin/system.api'

/** Nửa đêm (giờ máy người dùng) `daysAgo` ngày trước, dạng ISO cho tham số `from` */
function startOfDayIso(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Chỉ đếm — gọi GET /system/audit-logs với limit=1 và đọc `meta.total`, để backend tự đếm theo bộ lọc
 * thay vì tải hết nhật ký về client (bảng nhật ký chỉ tăng). Mỗi ô = 1 request rất nhẹ.
 */
function useAuditCount(query: Omit<ListAuditLogsQuery, 'page' | 'limit'>) {
  const { total, isLoading, isError, refetch } = useAuditLogList({ ...query, page: 1, limit: 1 })
  return { total, isLoading, isError, refetch }
}

/**
 * Hàng 5 ô chỉ số đầu trang Nhật ký hệ thống — cùng khuôn hàng KPI trang Ticket/Người dùng (StatTile).
 * Số liệu toàn hệ thống, không theo bộ lọc bảng. Tổng + hôm nay cho biết nhịp ghi nhật ký; 3 ô sau đếm
 * trong 7 ngày gần nhất các hành động Admin cần để mắt: đăng nhập thất bại (dấu hiệu dò mật khẩu),
 * Admin can thiệp ticket (TICKET-FR-005b), ticket vi phạm SLA (TICKET-FR-009) — đỏ khi có.
 */
export default function AuditLogStats() {
  const from7d = startOfDayIso(6)
  const all = useAuditCount({})
  const today = useAuditCount({ from: startOfDayIso(0) })
  const week = useAuditCount({ from: from7d })
  const loginFailed = useAuditCount({ action: 'LOGIN_FAILED', from: from7d })
  const overrides = useAuditCount({ action: 'TICKET_ADMIN_OVERRIDE', from: from7d })
  const slaBreached = useAuditCount({ action: 'TICKET_SLA_BREACHED', from: from7d })

  const counts = [all, today, week, loginFailed, overrides, slaBreached]
  if (counts.some(c => c.isLoading)) return <LoadingSkeleton count={1} className="h-28 w-full" />
  // Lỗi thì không hiện ô nào — "0 đăng nhập thất bại" trông như số thật
  if (counts.some(c => c.isError)) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title="Không tải được thống kê nhật ký"
        description="Kiểm tra kết nối tới máy chủ rồi thử lại."
        action={<Button variant="secondary" size="sm" onClick={() => counts.forEach(c => c.isError && c.refetch())}>Thử lại</Button>}
      />
    )
  }

  return (
    // 5 ô bằng nhau trên desktop; mobile: ô Tổng chiếm trọn hàng đầu, 4 ô còn lại xếp 2×2 — như trang Ticket
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile
        className="col-span-2 lg:col-span-1"
        icon={ClipboardTextIcon}
        iconClass="bg-charcoal text-limeMist"
        label="Tổng nhật ký"
        value={all.total}
        sub={`${today.total} bản ghi hôm nay`}
      />
      <StatTile
        icon={CalendarBlankIcon}
        iconClass="bg-accent-300 text-charcoal"
        label="7 ngày qua"
        value={week.total}
        sub={`TB ${Math.round(week.total / 7)} bản ghi / ngày`}
      />
      <StatTile
        icon={WarningIcon}
        iconClass={loginFailed.total > 0 ? 'bg-orange-100 text-orange-600' : 'bg-warmGray/10 text-charcoal'}
        label="Đăng nhập thất bại"
        value={loginFailed.total}
        sub="trong 7 ngày qua"
      />
      <StatTile
        icon={HandPalmIcon}
        iconClass="bg-warmGray/10 text-charcoal"
        label="Can thiệp ticket"
        value={overrides.total}
        sub="Admin can thiệp · 7 ngày qua"
      />
      <StatTile
        icon={TimerIcon}
        iconClass={slaBreached.total > 0 ? 'bg-alertRed text-white' : 'bg-accent-300 text-charcoal'}
        alert={slaBreached.total > 0}
        label="Ticket vi phạm SLA"
        value={slaBreached.total}
        sub={slaBreached.total > 0 ? 'trong 7 ngày qua' : 'Không có trong 7 ngày qua'}
      />
    </div>
  )
}
