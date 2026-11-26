// lịch sử đổi vòng đếm của 1 camera (ai vẽ, vai trò, thời điểm, số vòng); 5 lần mới nhất hiện sẵn, còn lại bấm "Xem thêm"
import { useState } from 'react'
import EmptyState from '@/components/ui/EmptyState'
import { ROLE_LABEL } from '@/constants/roles'
import type { CameraNode, Role } from '@/types'
import { formatDateTime } from '@/lib/i18n'
import { t } from '@/i18n'
import { ringList } from '@/components/common/countingRing.utils'

const VISIBLE_ENTRIES = 5

interface Props {
  camera: CameraNode
}

export default function CountingRingHistory({ camera }: Props) {
  const [showAll, setShowAll] = useState(false)
  const history = camera.counting_ring_history ?? []
  if (history.length === 0) {
    return <EmptyState title={t('Chưa có thay đổi vòng đếm nào.')} />
  }
  const shown = showAll ? history : history.slice(0, VISIBLE_ENTRIES)
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-warmGray/10">
        {shown.map((entry, index) => {
          const before = ringList(entry.old_value)
          const after = ringList(entry.new_value)
          const title = after.length === 0 ? t('Xoá vòng đếm') : before.length > 0 ? t('Vẽ lại vòng đếm') : t('Vẽ vòng đếm')
          return (
            <li key={`${entry.changed_at}-${index}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-charcoal">{title}</p>
                <p className="mt-0.5 text-xs text-warmGray">
                  {ROLE_LABEL[entry.changed_by_role as Role] ?? entry.changed_by_role} · {formatDateTime(entry.changed_at)}
                </p>
              </div>
              <span className="shrink-0 text-xs text-warmGray">
                {after.length > 0 ? t('{{n}} vòng', { n: after.length }) : t('Vòng mặc định')}
              </span>
            </li>
          )
        })}
      </ul>
      {history.length > VISIBLE_ENTRIES && (
        <button type="button" onClick={() => setShowAll(current => !current)} className="self-start text-xs font-semibold text-charcoal underline-offset-2 hover:underline">
          {showAll ? t('Thu gọn') : t('Xem thêm {{n}} lần', { n: history.length - VISIBLE_ENTRIES })}
        </button>
      )}
    </div>
  )
}
