// Trang chủ Chuyên gia: việc đang chờ của trại đang chọn; hàng tab lọc theo kiểu quyết định, mỗi loại việc một khung, bấm cả hàng để mở
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CaretRightIcon, ClipboardTextIcon } from '@phosphor-icons/react'
import StatusTabs from '@/components/common/StatusTabs'
import { groupsForTab, sectionTotal, targetOf, type QueueSection, type QueueTab } from '@/components/features/domain-expert/queue/queue.utils'
import { Badge, Button, EmptyState, LoadingSkeleton, SectionCard } from '@/components/ui'
import { NO_VALUE } from '@/constants/display'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useExpertQueue } from '@/hooks/domain-expert/useExpertQueue'
import { t } from '@/i18n'
import { formatDateTime, formatStandardDate } from '@/lib/i18n'
import { useZoneStore } from '@/stores/zoneStore'
import type { ExpertQueueGroup, ExpertQueueItem, ExpertQueueKind } from '@/types/expert/queue.types'

// Tên khung của từng loại việc; dựng trong component để đổi ngôn ngữ thì đổi theo
const kindTitle = (kind: ExpertQueueKind): string => ({
  alert_verdict: t('Cảnh báo chờ kết luận'),
  parameter_review: t('Thay đổi tham số chờ duyệt'),
  coefficient_proposal: t('Đề xuất hệ số mờ'),
  disagreeing_day: t('Ngày đánh giá khác hệ thống (14 ngày)'),
  report_conclusion: t('Báo cáo chờ kết luận'),
  weather_proposal: t('Đề xuất luật phun sương theo thời tiết'),
  profile_draft: t('Hồ sơ cấu hình chờ duyệt'),
  recommendation_rule: t('Luật khuyến nghị chờ bật'),
  season_conclusion: t('Mùa vụ chờ kết luận'),
})[kind]

const SECTIONS: Array<{ key: QueueSection; label: () => string }> = [
  { key: 'verdicts', label: () => t('Kết luận cảnh báo') },
  { key: 'reviews', label: () => t('Duyệt thay đổi') },
  { key: 'proposals', label: () => t('Duyệt đề xuất') },
  { key: 'conclusions', label: () => t('Viết kết luận') },
]

// Ngày lệch trả 'YYYY-MM-DD', các việc khác trả thời điểm
const whenOf = (item: ExpertQueueItem) => (/^\d{4}-\d{2}-\d{2}$/.test(item.at) ? formatStandardDate(item.at) : formatDateTime(item.at))

function QueueGroupCard({ group }: { group: ExpertQueueGroup }) {
  const navigate = useNavigate()
  const setHouse = useZoneStore(state => state.setHouse)
  // Luật thời tiết theo nhà: chọn nhà của đề xuất rồi mới mở trang
  const open = (item: ExpertQueueItem) => {
    if (group.kind === 'weather_proposal') setHouse(item.id)
    navigate(targetOf(group.kind, item))
  }
  return (
    <SectionCard
      title={kindTitle(group.kind)}
      description={t('{{n}} việc', { n: group.total })}
      action={group.total > group.items.length && (
        <Link to={targetOf(group.kind)} className="text-small font-medium text-accent-700 hover:underline">
          {t('Xem tất cả')}
        </Link>
      )}
    >
      <ul className="-my-2 divide-y divide-warmGray/10">
        {group.items.map(item => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-warmGray/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-700"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-charcoal">{item.title}</span>
                <span className="mt-0.5 flex items-center gap-2 text-small text-warmGray">
                  {item.reminded && <Badge tone="warning" className="shrink-0 whitespace-nowrap">{t('Chủ nhà yến đã nhắc')}</Badge>}
                  <span className="truncate">{item.house_name ?? NO_VALUE} · {whenOf(item)}</span>
                </span>
              </span>
              <CaretRightIcon className="h-4 w-4 shrink-0 text-warmGray" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

export default function DomainExpertQueuePage() {
  const [tab, setTab] = useState<QueueTab>('all')
  const farmId = useZoneStore(state => state.selectedFarmId)
  const queue = useExpertQueue(farmId)
  const apiErrorMessage = useApiErrorMessage()

  if (!farmId) return <EmptyState icon={<ClipboardTextIcon className="h-8 w-8" />} title={t('Chọn trang trại ở thanh trên để xem việc đang chờ')} />
  if (queue.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-xl space-y-5">
        <LoadingSkeleton className="h-11 w-full max-w-xl rounded-full" />
        <LoadingSkeleton count={3} className="h-14 w-full rounded-2xl" />
      </div>
    )
  }
  if (queue.isError || !queue.data) {
    return (
      <EmptyState
        icon={<ClipboardTextIcon className="h-8 w-8" />}
        title={apiErrorMessage(queue.error)}
        action={<Button variant="secondary" size="sm" onClick={() => void queue.refetch()}>{t('Thử lại')}</Button>}
      />
    )
  }

  const groups = queue.data.groups
  const total = SECTIONS.reduce((sum, section) => sum + sectionTotal(groups, section.key), 0)
  const visible = groupsForTab(groups, tab)

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-5">
      <StatusTabs
        ariaLabel={t('Lọc việc theo loại')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'all', label: t('Tất cả'), badge: total },
          ...SECTIONS.map(section => ({ id: section.key, label: section.label(), badge: sectionTotal(groups, section.key) })),
        ]}
      />

      {visible.length === 0
        ? <EmptyState icon={<ClipboardTextIcon className="h-8 w-8" />} title={t('Không có việc gì đang chờ')} />
        : visible.map(group => <QueueGroupCard key={group.kind} group={group} />)}
    </div>
  )
}
