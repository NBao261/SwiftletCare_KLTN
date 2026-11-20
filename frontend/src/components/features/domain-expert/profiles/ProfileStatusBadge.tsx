import { cn } from '@/lib/cn'
import type { ConfigProfileStatus } from '@/types/expert.types'
import { t } from '@/i18n'

const CONFIG: Record<ConfigProfileStatus, { label: string; cls: string }> = {
  DRAFT:    { label: 'Bản nháp',   cls: 'bg-statusYellow/10 text-statusYellow border-statusYellow/30' },
  APPROVED: { label: 'Đã duyệt',  cls: 'bg-success/10 text-success border-success/30' },
  ARCHIVED: { label: 'Lưu trữ',   cls: 'bg-warmGray/10 text-warmGray border-warmGray/20' },
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
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-small font-semibold', cls, className)}>
      {t(label)}
    </span>
  )
}
