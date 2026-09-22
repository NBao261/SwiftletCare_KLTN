import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

/** EmptyState – hiển thị khi danh sách rỗng (farm/device/alert chưa có dữ liệu) */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-warmGray/30 px-6 py-12 text-center">
      {icon && <div className="text-warmGray">{icon}</div>}
      <p className="font-semibold text-charcoal">{title}</p>
      {description && <p className="max-w-sm text-sm text-warmGray">{description}</p>}
      {action}
    </div>
  )
}
