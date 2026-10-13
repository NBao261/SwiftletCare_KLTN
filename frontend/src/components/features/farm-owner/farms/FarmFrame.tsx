import type { ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'

interface FarmFrameProps {
  title: ReactNode
  /** Dòng mô tả dưới tiêu đề — có thể chứa nhiều mục (địa chỉ, người phụ trách…) */
  description?: ReactNode
  /** Nút/link bên phải header */
  action?: ReactNode
  className?: string
  children?: ReactNode
}

/** Khung chung của màn Cấu trúc Farm — cùng kiểu EnvSensorPanel ở Dashboard: Card lớn, tiêu đề h2 + mô tả xám, không icon vuông */
export default function FarmFrame({ title, description, action, className, children }: FarmFrameProps) {
  return (
    <Card size="lg" className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-h2 text-charcoal">{title}</h2>
          {description && <div className="mt-1 text-sm text-warmGray">{description}</div>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}
