// Cột bảng nhật ký hệ thống
import type { DataTableColumn } from '@/components/ui/DataTable'
import { AUDIT_ACTION_LABEL } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { formatDateOnly, formatRelativeTime, formatTimeOnly } from '@/lib/helpers'
import type { AuditLogEntry } from '@/types'
import { t, translated } from '@/i18n'

// Không có người thực hiện thì dùng target_name, không bao giờ hiện ObjectId
function PersonCell({ log }: { log: AuditLogEntry }) {
  const who = log.actor_id?.full_name ?? log.target_name ?? t('Không xác định')
  return <p className="truncate font-semibold text-charcoal" title={who}>{who}</p>
}

// Viết hoa chữ cái đầu: lý do Admin tự nhập có thể bắt đầu bằng chữ thường
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('vi') + s.slice(1)

// Mã lý do đăng nhập thất bại (auth.service.ts) → chữ
const LOGIN_FAILED_REASON: Record<string, string> = translated({
  WRONG_PASSWORD: 'Sai mật khẩu',
  UNKNOWN_EMAIL: 'Email chưa đăng ký',
  ACCOUNT_DISABLED: 'Tài khoản đang bị khoá',
})

// Lý do khoá, từ chối hiện nguyên văn; đăng nhập thất bại dịch qua LOGIN_FAILED_REASON
export function reasonOf(log: AuditLogEntry): string | undefined {
  const reason = log.metadata?.reason
  if (typeof reason !== 'string' || !reason.trim()) return undefined
  if (log.action === 'LOGIN_FAILED') return LOGIN_FAILED_REASON[reason] ?? capitalize(reason.trim())
  // Khoá, mở khoá và từ chối yêu cầu xoá: lý do Admin tự nhập
  if (['ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'DELETION_REJECTED'].includes(log.action)) return capitalize(reason.trim())
  return undefined
}

// Width % cho table-fixed, tổng 100; sắp xếp bấm ở tiêu đề cột Thời gian
export function buildAuditLogColumns(): DataTableColumn<AuditLogEntry>[] {
  return [
    // Nhãn hành động dài thì mờ dần ở đuôi
    {
      key: 'action', header: 'Hành động', className: 'w-[24%]',
      render: log => {
        const label = AUDIT_ACTION_LABEL[log.action] ?? log.action
        // Dài thì mờ dần ở đuôi (text-fade) thay vì "…": chỉ riêng cột này; rê chuột xem đủ
        return <p className="text-fade font-semibold text-charcoal" title={label}>{label}</p>
      },
    },
    // Tên đậm, vai trò xám bên dưới
    {
      key: 'person', header: 'Người thực hiện', className: 'w-[28%]',
      render: log => (
        <div className="flex min-w-0 flex-col">
          <PersonCell log={log} />
          {log.actor_id && <p className="truncate text-small text-warmGray">{ROLE_LABEL[log.actor_id.role]}</p>}
        </div>
      ),
    },
    {
      key: 'reason', header: 'Lý do', className: 'w-[26%]',
      render: log => {
        const reason = reasonOf(log)
        return reason
          ? <p className="truncate text-charcoal" title={reason}>{reason}</p>
          : <span className="italic text-warmGray/60">{t('Không có')}</span>
      },
    },
    {
      key: 'time', header: 'Thời gian', sortable: true, className: 'w-[22%] whitespace-nowrap',
      // Giờ trên, ngày dưới; vẫn vừa hàng 60px
      render: log => (
        <div className="-my-1 flex flex-col leading-tight" title={formatRelativeTime(log.created_at)}>
          <span className="font-semibold text-charcoal">{formatTimeOnly(log.created_at)}</span>
          <span className="text-small text-warmGray">{formatDateOnly(log.created_at)}</span>
        </div>
      ),
    },
  ]
}

// Thẻ 1 nhật ký trên điện thoại: hành động đậm, người thực hiện · vai trò, lý do nếu có, giờ ngày
export function AuditLogCard({ log }: { log: AuditLogEntry }) {
  const label = AUDIT_ACTION_LABEL[log.action] ?? log.action
  const who = log.actor_id?.full_name ?? log.target_name ?? t('Không xác định')
  const reason = reasonOf(log)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body font-semibold text-charcoal">{label}</p>
      <p className="text-small text-warmGray">{log.actor_id ? `${who} · ${ROLE_LABEL[log.actor_id.role]}` : who}</p>
      {reason && <p className="text-small text-charcoal">{reason}</p>}
      <p className="text-small text-warmGray">{formatTimeOnly(log.created_at)} · {formatDateOnly(log.created_at)}</p>
    </div>
  )
}
