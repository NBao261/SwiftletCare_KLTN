import { cn } from '@/lib/cn'
import type { ConfigProfileStatus } from '@/types/expert.types'

const CONFIG: Record<ConfigProfileStatus, { label: string; cls: string }> = {
  DRAFT:    { label: 'Bản nháp',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Đã duyệt',  cls: 'bg-green-50 text-green-700 border-green-200' },
  ARCHIVED: { label: 'Lưu trữ',   cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
}

export default function ProfileStatusBadge({
  status,
  className,
}: {
  status: ConfigProfileStatus
  className?: string
}) {
  const { label, cls } = CONFIG[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', cls, className)}>
      {label}
    </span>
  )
}
