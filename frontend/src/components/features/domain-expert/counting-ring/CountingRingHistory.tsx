// VISION-FR-018 — lịch sử đổi vòng đếm của 1 camera (ai vẽ, vai trò, thời điểm, số đỉnh)
import { History } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { ROLE_LABEL } from '@/constants/roles'
import type { CameraNode, Role } from '@/types'
import { formatDateTime } from '@/lib/i18n'

interface Props {
  camera: CameraNode
}

export default function CountingRingHistory({ camera }: Props) {
  const history = camera.counting_ring_history ?? []
  if (history.length === 0) {
    return <EmptyState icon={<History className="w-7 h-7" />} title="Chưa có thay đổi vòng đếm nào." />
  }
  return (
    <div className="space-y-2">
      {history.map((entry, index) => (
        <div
          key={`${entry.changed_at}-${index}`}
          className="flex items-start justify-between gap-3 p-3 rounded-xl border border-warmGray/15 bg-white text-sm"
        >
          <div className="min-w-0">
            <p className="font-semibold text-charcoal">{entry.old_value ? 'Vẽ lại vòng đếm' : 'Vẽ vòng đếm'}</p>
            <p className="text-warmGray text-xs mt-0.5">
              {ROLE_LABEL[entry.changed_by_role as Role] ?? entry.changed_by_role} · {formatDateTime(entry.changed_at)}
            </p>
          </div>
          <span className="shrink-0 text-warmGray text-xs">{entry.new_value.points.length} đỉnh</span>
        </div>
      ))}
    </div>
  )
}
