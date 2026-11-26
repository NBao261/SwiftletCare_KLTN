import { Badge, type BadgeTone } from '@/components/ui'
import type { ConfigProfileStatus } from '@/types/expert.types'
import { t } from '@/i18n'

const CONFIG: Record<ConfigProfileStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Bản nháp', tone: 'warning' },
  APPROVED: { label: 'Đã duyệt', tone: 'positive' },
  ARCHIVED: { label: 'Lưu trữ', tone: 'neutral' },
}

export default function ProfileStatusBadge({ status, className }: { status: ConfigProfileStatus; className?: string }) {
  const { label, tone } = CONFIG[status]
  return <Badge tone={tone} className={className}>{t(label)}</Badge>
}
