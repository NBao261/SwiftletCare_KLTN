import type { ReactNode } from 'react'
import { Card, InfoTip } from '@/components/ui'
import { cn } from '@/lib/cn'

interface FarmFrameProps {
  title: ReactNode
  // Dòng mô tả dưới tiêu đề: chữ thường thì 1 dòng; ReactNode nhiều mục (địa chỉ, người phụ trách…) giữ nguyên
  description?: ReactNode
  // Giải thích dài: trong nút (i) cạnh tiêu đề
  help?: ReactNode
  // Nút/link bên phải header
  action?: ReactNode
  // Hàng nằm trên tiêu đề, trong cùng thẻ, có vạch ngăn bên dưới (VD chip chọn nhóm thành viên)
  top?: ReactNode
  className?: string
  children?: ReactNode
}

// Khung chung của màn Cấu trúc Farm: cùng kiểu EnvSensorPanel ở Dashboard: Card lớn, tiêu đề h2 + mô tả xám, không icon vuông
export default function FarmFrame({ title, description, help, action, top, className, children }: FarmFrameProps) {
  return (
    <Card size="lg" className={cn('flex flex-col gap-4', className)}>
      {top && <div className="border-b border-warmGray/15 pb-4">{top}</div>}
      {/* Tiêu đề + mô tả chiếm phần còn lại (mô tả dài thì xuống dòng trong cột), nút cùng hàng bên phải; điện thoại cho nút xuống hàng */}
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          {/* break-words: tên nhà, Zone dài không dấu cách không tràn khung */}
          <h2 className="flex flex-wrap items-center gap-2 break-words text-h2 text-charcoal">{title}{help && <InfoTip>{help}</InfoTip>}</h2>
          {description && (
            <div className={cn('mt-1 break-words text-body text-graphite', typeof description === 'string' && 'line-clamp-1')} title={typeof description === 'string' ? description : undefined}>
              {description}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  )
}
