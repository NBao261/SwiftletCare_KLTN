import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'
import InfoTip from '@/components/ui/InfoTip'

interface SectionCardProps {
  /** Icon trong ô vuông bo góc nền charcoal — ở các trang Admin là icon của mục menu sidebar tương ứng. Bỏ trống = không có ô icon */
  icon?: ReactNode
  /** Bỏ trống khi trang chỉ có 1 card: tên trang đã ở header (FE_Design §1.1), card chỉ còn dòng mô tả */
  title?: ReactNode
  /** Dòng mô tả dưới tiêu đề: chữ thường thì 1 dòng (C-07); ReactNode nhiều mục (VD địa chỉ + chủ sở hữu) giữ nguyên */
  description?: ReactNode
  /** Giải thích dài (quy tắc, lý do) — hiện trong nút (i) cạnh tiêu đề thay vì đoạn chữ dưới card */
  help?: ReactNode
  /** Nút/link bên phải header (VD "Xem tất cả", "Thiết bị & Cảm biến") */
  action?: ReactNode
  className?: string
  children?: ReactNode
}

/**
 * Card trắng có header "icon + tiêu đề + mô tả (+ action phải)", nội dung xếp dọc bên dưới — khuôn chung
 * của các khối danh sách/chi tiết ở trang Admin, để chỉnh bo góc/padding chỉ sửa 1 chỗ (FE_Design mục 9).
 */
export default function SectionCard({ icon, title, description, help, action, className, children }: SectionCardProps) {
  return (
    <section className={cn('flex flex-col gap-5 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {title && <h2 className="flex flex-wrap items-center gap-2 break-words text-h2 text-charcoal">{tr(title)}{help && <InfoTip>{help}</InfoTip>}</h2>}
            {/* Mô tả là chữ đọc: text-body màu graphite, chuỗi chỉ 1 dòng (rê chuột xem đủ) */}
            {description && (
              <div className={cn('flex items-center gap-1 break-words text-body text-graphite', title && 'mt-1')}>
                <div className={cn('min-w-0', typeof description === 'string' && 'line-clamp-1')} title={typeof description === 'string' ? tr(description) : undefined}>{tr(description)}</div>
                {help && !title && <InfoTip>{help}</InfoTip>}
              </div>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
