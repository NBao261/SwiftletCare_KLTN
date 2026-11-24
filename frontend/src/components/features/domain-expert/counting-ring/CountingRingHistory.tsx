// lịch sử đổi vòng đếm của 1 camera (ai vẽ, vai trò, thời điểm, số vòng)
import { History } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { ROLE_LABEL } from '@/constants/roles'
import type { CameraNode, Role } from '@/types'
import { formatDateTime } from '@/lib/i18n'
import { t } from '@/i18n'
import { ringList } from '@/components/common/countingRing.utils'

interface Props {
  camera: CameraNode
}

export default function CountingRingHistory({ camera }: Props) {
  const history = camera.counting_ring_history ?? []
  if (history.length === 0) {
    return <EmptyState icon={<History className="w-7 h-7" />} title={t('Chưa có thay đổi vòng đếm nào.')} />
  }
  return (
    <div className="space-y-2">
      {history.map((entry, index) => {
        const before = ringList(entry.old_value)
        const after = ringList(entry.new_value)
        const title = after.length === 0 ? t('Xoá vòng đếm') : before.length > 0 ? t('Vẽ lại vòng đếm') : t('Vẽ vòng đếm')
        return (
          <div
            key={`${entry.changed_at}-${index}`}
            className="flex items-start justify-between gap-3 p-3 rounded-xl border border-warmGray/15 bg-white text-sm"
          >
            <div className="min-w-0">
              <p className="font-semibold text-charcoal">{title}</p>
              <p className="text-warmGray text-xs mt-0.5">
                {ROLE_LABEL[entry.changed_by_role as Role] ?? entry.changed_by_role} · {formatDateTime(entry.changed_at)}
              </p>
            </div>
            <span className="shrink-0 text-warmGray text-xs">
              {after.length > 0 ? t('{{n}} vòng', { n: after.length }) : t('Vòng mặc định')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
