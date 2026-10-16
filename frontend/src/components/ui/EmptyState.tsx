import { ReactNode } from 'react'
import { tr } from '@/i18n'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

/** EmptyState – hiển thị khi danh sách rỗng (farm/device/alert chưa có dữ liệu). Chữ tự dịch theo VI/EN */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-warmGray/30 px-6 py-12 text-center">
      {icon && <div className="text-warmGray">{icon}</div>}
      <p className="font-semibold text-charcoal">{tr(title)}</p>
      {description && <p className="max-w-sm text-sm text-warmGray">{tr(description)}</p>}
      {action}
    </div>
  )
}
