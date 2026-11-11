import type { ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'

interface FarmFrameProps {
  title: ReactNode
  /** Dòng mô tả dưới tiêu đề — có thể chứa nhiều mục (địa chỉ, người phụ trách…) */
  description?: ReactNode
  /** Nút/link bên phải header */
  action?: ReactNode
  // Hàng nằm trên tiêu đề, trong cùng thẻ, có vạch ngăn bên dưới (VD chip chọn nhóm thành viên)
  top?: ReactNode
  className?: string
  children?: ReactNode
}

/** Khung chung của màn Cấu trúc Farm — cùng kiểu EnvSensorPanel ở Dashboard: Card lớn, tiêu đề h2 + mô tả xám, không icon vuông */
export default function FarmFrame({ title, description, action, top, className, children }: FarmFrameProps) {
  return (
    <Card size="lg" className={cn('flex flex-col gap-4', className)}>
      {top && <div className="border-b border-warmGray/15 pb-4">{top}</div>}
      {/* Tiêu đề + mô tả chiếm phần còn lại (mô tả dài thì xuống dòng trong cột), nút cùng hàng bên phải; điện thoại cho nút xuống hàng */}
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-h2 text-charcoal">{title}</h2>
          {description && <div className="mt-1 text-sm text-warmGray">{description}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  )
}
