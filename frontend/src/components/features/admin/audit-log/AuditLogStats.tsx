import { CalendarBlankIcon, ClipboardTextIcon, UserGearIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react'
import { useAuditLogList } from '@/hooks/admin/useSystem'
import { AUDIT_TARGET_TYPE } from '@/constants/auditActions'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import KpiTile from '@/components/common/KpiTile'
import { t } from '@/i18n'
import type { ListAuditLogsQuery } from '@/apis/admin/system.api'

const ICON = 'bg-warmGray/10 text-charcoal'

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
  // Cùng phạm vi bảng bên dưới: chỉ nhật ký tài khoản
  const { total, isLoading, isError, refetch } = useAuditLogList({ ...query, targetType: AUDIT_TARGET_TYPE, page: 1, limit: 1 })
  return { total, isLoading, isError, refetch }
}

// AD-06 — 4 ô đầu trang Nhật ký hệ thống, chỉ nhật ký tài khoản, không theo bộ lọc bảng, không bọc card. Tổng và 7 ngày
// cho biết nhịp ghi nhật ký; đăng nhập thất bại (dấu hiệu dò mật khẩu) và thay đổi tài khoản trong 7 ngày là việc Admin cần để mắt
export default function AuditLogStats() {
  const from7d = startOfDayIso(6)
  const all = useAuditCount({})
  const today = useAuditCount({ from: startOfDayIso(0) })
  const week = useAuditCount({ from: from7d })
  const loginFailed = useAuditCount({ action: 'LOGIN_FAILED', from: from7d })
  const locked = useAuditCount({ action: 'ACCOUNT_LOCKED', from: from7d })
  // Tài khoản mới: Admin tạo chủ nhà yến (AUTH-FR-005c) và người nhận lời mời tự tạo (AUTH-FR-010)
  const ownerCreated = useAuditCount({ action: 'FARM_OWNER_CREATED', from: from7d })
  const invitedCreated = useAuditCount({ action: 'ACCOUNT_CREATED_FROM_INVITATION', from: from7d })
  const created = ownerCreated.total + invitedCreated.total

  const counts = [all, today, week, loginFailed, locked, ownerCreated, invitedCreated]
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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiTile icon={ClipboardTextIcon} iconClass={ICON} label="Tổng nhật ký" value={all.total} sub={t('Hôm nay thêm {{n}} bản ghi', { n: today.total })} />
      <KpiTile
        icon={CalendarBlankIcon}
        iconClass={ICON}
        label="Nhật ký 7 ngày qua"
        value={week.total}
        sub={t('Trung bình {{n}} bản ghi/ngày', { n: Math.round(week.total / 7) })}
      />
      <KpiTile
        icon={WarningIcon}
        iconClass={ICON}
        label="Đăng nhập thất bại"
        value={loginFailed.total}
        // Tín hiệu bảo mật duy nhất của hàng → nổi cam khi có ≥ 1 lần (không có ngưỡng có nguồn nên không tự đặt số)
        tone={loginFailed.total > 0 ? 'warning' : undefined}
        sub="Trong 7 ngày qua"
      />
      {/* Gộp lượt khoá và tài khoản mới tạo trong 7 ngày */}
      <KpiTile
        icon={UserGearIcon}
        iconClass={ICON}
        label="Thay đổi tài khoản"
        value={locked.total + created}
        sub={t('7 ngày: {{locked}} khoá, {{created}} tạo mới', { locked: locked.total, created })}
      />
    </div>
  )
}
