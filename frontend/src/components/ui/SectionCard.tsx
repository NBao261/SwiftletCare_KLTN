import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionCardProps {
  /** Icon trong ô vuông bo góc nền charcoal — ở các trang Admin là icon của mục menu sidebar tương ứng */
  icon: ReactNode
  title: ReactNode
  /** Dòng mô tả dưới tiêu đề — có thể nhiều dòng (VD địa chỉ + chủ sở hữu farm) */
  description?: ReactNode
  /** Nút/link bên phải header (VD "Xem tất cả", "Thiết bị & Cảm biến") */
  action?: ReactNode
  className?: string
  children?: ReactNode
}

/**
 * Card trắng có header "icon + tiêu đề + mô tả (+ action phải)", nội dung xếp dọc bên dưới — khuôn chung
 * của các khối danh sách/chi tiết ở trang Admin, để chỉnh bo góc/padding chỉ sửa 1 chỗ (FE_Design mục 9).
 */
export default function SectionCard({ icon, title, description, action, className, children }: SectionCardProps) {
  return (
    <section className={cn('flex flex-col gap-5 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-h2 text-charcoal">{title}</h2>
            {description && <div className="text-small text-graphite">{description}</div>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
