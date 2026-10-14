// Cấu hình cột DataTable của AdminAuditLogPage — tách khỏi trang giống userColumns.tsx.
// Không có icon/màu theo nhóm hành động — chỉ chữ.
import type { DataTableColumn } from '@/components/ui/DataTable'
import { AUDIT_ACTION_LABEL } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { formatDateOnly, formatRelativeTime, formatTimeOnly } from '@/lib/helpers'
import type { AuditLogEntry } from '@/types'
import { t, translated } from '@/i18n'

/**
 * Chỉ tên người thực hiện — không ghi "→ tài khoản bị tác động" (theo yêu cầu giữ cột gọn). Không có người thực
 * hiện (đăng nhập thất bại bằng email chưa đăng ký) thì rơi về tên tài khoản backend tra sẵn (`target_name`),
 * không bao giờ hiện ObjectId.
 */
function PersonCell({ log }: { log: AuditLogEntry }) {
  const who = log.actor_id?.full_name ?? log.target_name ?? t('Không xác định')
  return <p className="truncate font-semibold text-charcoal" title={who}>{who}</p>
}

/** Viết hoa chữ cái đầu — lý do Admin tự nhập có thể bắt đầu bằng chữ thường */
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('vi') + s.slice(1)

/** Mã lý do đăng nhập thất bại (auth.service.ts) → chữ */
const LOGIN_FAILED_REASON: Record<string, string> = translated({
  WRONG_PASSWORD: 'Sai mật khẩu',
  UNKNOWN_EMAIL: 'Email chưa đăng ký',
  ACCOUNT_DISABLED: 'Tài khoản đang bị khoá',
})

/**
 * Lý do lưu ở `metadata.reason`: khoá (bắt buộc)/mở khoá tài khoản — chữ Admin tự nhập (AUTH-FR-011), hiện nguyên
 * văn; đăng nhập thất bại — mã backend, dịch qua LOGIN_FAILED_REASON. Hành động khác không có lý do.
 */
export function reasonOf(log: AuditLogEntry): string | undefined {
  const reason = log.metadata?.reason
  if (typeof reason !== 'string' || !reason.trim()) return undefined
  if (log.action === 'LOGIN_FAILED') return LOGIN_FAILED_REASON[reason] ?? capitalize(reason.trim())
  if (log.action === 'ACCOUNT_LOCKED' || log.action === 'ACCOUNT_UNLOCKED') return capitalize(reason.trim())
  return undefined
}

/**
 * Cùng bố cục bảng Người dùng (userColumns.tsx): STT liên tục qua các
 * trang (`startIndex` = (page-1)*limit), người thực hiện, vai trò cột riêng,
 * width % tổng 100 cho table-fixed (6+20+19+18+21+16). Không có cột thao tác — nhật ký chỉ đọc.
 */
export function buildAuditLogColumns(startIndex: number): DataTableColumn<AuditLogEntry>[] {
  return [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[6%]',
      render: (_log, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    // Căn đều: width = độ dài nội dung thường gặp + 1 khoảng trống như nhau, để khe giữa chữ cột này và cột sau
    // đều nhau (6/20/19/18/21/16 = 100%). Hành động thường ngắn ("Đăng nhập") nên không chiếm rộng — nhãn dài
    // (VD "Cập nhật vùng phụ trách Technician") mờ dần ở đuôi. Độ đậm theo thứ bậc:
    // Người thực hiện đậm (ai làm) > Hành động vừa (làm gì) > Thời gian thường > Vai trò xám.
    {
      key: 'action', header: 'Hành động', className: 'w-[20%]',
      render: log => {
        const label = AUDIT_ACTION_LABEL[log.action] ?? log.action
        // Dài thì mờ dần ở đuôi (text-fade) thay vì "…" — chỉ riêng cột này; rê chuột xem đủ
        return <p className="text-fade font-medium text-charcoal" title={label}>{label}</p>
      },
    },
    { key: 'person', header: 'Người thực hiện', className: 'w-[19%]', render: log => <PersonCell log={log} /> },
    {
      key: 'role', header: 'Vai trò', className: 'w-[18%]',
      render: log => <p className="truncate text-graphite">{log.actor_id ? ROLE_LABEL[log.actor_id.role] : '—'}</p>,
    },
    {
      key: 'reason', header: 'Lý do', className: 'w-[21%]',
      render: log => {
        const reason = reasonOf(log)
        return reason
          ? <p className="truncate text-charcoal" title={reason}>{reason}</p>
          : <span className="italic text-warmGray/60">{t('Không có')}</span>
      },
    },
    {
      key: 'created_at', header: 'Thời gian', className: 'w-[16%] whitespace-nowrap',
      // 2 tầng như bảng nhật ký cảnh báo Farm Owner: giờ "20:35:10" trên, ngày "7/10/2026" xám dưới — rê chuột
      // xem thêm thời gian tương đối. leading-tight + -my-1 (ăn bớt py-3 của ô): 2 dòng vẫn vừa hàng 52px như cũ,
      // bảng không cao thêm
      render: log => (
        <div className="-my-1 flex flex-col leading-tight" title={formatRelativeTime(log.created_at)}>
          <span className="font-semibold text-charcoal">{formatTimeOnly(log.created_at)}</span>
          <span className="text-small text-warmGray">{formatDateOnly(log.created_at)}</span>
        </div>
      ),
    },
  ]
}
