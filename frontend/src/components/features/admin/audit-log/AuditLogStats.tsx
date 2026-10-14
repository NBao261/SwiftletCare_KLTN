import { CalendarBlankIcon, ClipboardTextIcon, LockSimpleIcon, UserPlusIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react'
import { useAuditLogList } from '@/hooks/admin/useSystem'
import { AUDIT_TARGET_TYPE } from '@/constants/auditActions'
import { Button, Card, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import StatTile from '@/components/ui/StatTile'
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

/**
 * Hàng 5 ô chỉ số đầu trang Nhật ký hệ thống — cùng khuôn hàng KPI trang Ticket/Người dùng (StatTile).
 * Chỉ nhật ký tài khoản, không theo bộ lọc bảng. Tổng + hôm nay cho biết nhịp ghi nhật ký; 3 ô sau đếm
 * trong 7 ngày gần nhất việc Admin cần để mắt: đăng nhập thất bại (dấu hiệu dò mật khẩu), tài khoản bị
 * khoá (AUTH-FR-011), tài khoản nhân viên mới tạo (AUTH-FR-005c). Icon xám như ReadingTile Dashboard Farm Owner.
 */
export default function AuditLogStats() {
  const from7d = startOfDayIso(6)
  const all = useAuditCount({})
  const today = useAuditCount({ from: startOfDayIso(0) })
  const week = useAuditCount({ from: from7d })
  const loginFailed = useAuditCount({ action: 'LOGIN_FAILED', from: from7d })
  const locked = useAuditCount({ action: 'ACCOUNT_LOCKED', from: from7d })
  const created = useAuditCount({ action: 'USER_CREATED', from: from7d })

  const counts = [all, today, week, loginFailed, locked, created]
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
    // Cùng kiểu card "Chỉ số vận hành toàn hệ thống" (Tổng quan) và "Thống kê tài khoản" (Người dùng):
    // bọc Card + tiêu đề, ô bên trong bỏ shadow riêng
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">{t('Thống kê nhật ký')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('Hoạt động tài khoản trên toàn hệ thống')}</p>
      </div>

      {/* 5 ô bằng nhau trên desktop; mobile: ô Tổng chiếm trọn hàng đầu, 4 ô còn lại xếp 2×2 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          className="col-span-2 shadow-none lg:col-span-1"
          icon={ClipboardTextIcon}
          iconClass={ICON}
          label="Tổng nhật ký"
          value={all.total}
          sub={t('Hôm nay thêm {{n}} bản ghi', { n: today.total })}
        />
        <StatTile
          className="shadow-none"
          icon={CalendarBlankIcon}
          iconClass={ICON}
          label="Nhật ký 7 ngày qua"
          value={week.total}
          sub={t('Trung bình {{n}} bản ghi/ngày', { n: Math.round(week.total / 7) })}
        />
        <StatTile
          className="shadow-none"
          icon={WarningIcon}
          iconClass={ICON}
          label="Đăng nhập thất bại"
          value={loginFailed.total}
          sub="Trong 7 ngày qua"
        />
        {/* Đếm LƯỢT Admin khoá (ACCOUNT_LOCKED), không phải số tài khoản đang bị khoá — nhãn nói rõ để khỏi nhầm */}
        <StatTile
          className="shadow-none"
          icon={LockSimpleIcon}
          iconClass={ICON}
          label="Lượt khoá tài khoản"
          value={locked.total}
          sub="Trong 7 ngày qua"
        />
        {/* USER_CREATED chỉ ghi khi Admin tạo Technician/Sales Staff — Farm Owner tự đăng ký không ghi log này */}
        <StatTile
          className="shadow-none"
          icon={UserPlusIcon}
          iconClass={ICON}
          label="Nhân viên mới"
          value={created.total}
          sub="Trong 7 ngày qua"
        />
      </div>
    </Card>
  )
}
