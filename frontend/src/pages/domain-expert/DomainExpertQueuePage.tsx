// Trang chủ Chuyên gia: mọi việc đang chờ của trại đang chọn, 4 ô tóm tắt và một khung cho mỗi loại việc
import { Link, useNavigate } from 'react-router-dom'
import { ChecksIcon, ClipboardTextIcon, FileTextIcon, LightbulbFilamentIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import KpiTile from '@/components/common/KpiTile'
import { KIND_ORDER, sectionTotal, targetOf, type QueueSection } from '@/components/features/domain-expert/queue/queue.utils'
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

const SECTIONS: Array<{ key: QueueSection; label: () => string; sub: () => string; icon: typeof ShieldCheckIcon }> = [
  { key: 'verdicts', label: () => t('Kết luận cảnh báo'), sub: () => t('cảnh báo suy luận'), icon: ShieldCheckIcon },
  { key: 'reviews', label: () => t('Duyệt thay đổi'), sub: () => t('tham số và hệ số mờ'), icon: ChecksIcon },
  { key: 'proposals', label: () => t('Duyệt đề xuất'), sub: () => t('luật phun sương, hồ sơ, luật khuyến nghị'), icon: LightbulbFilamentIcon },
  { key: 'conclusions', label: () => t('Viết kết luận'), sub: () => t('ngày đánh giá khác, báo cáo, mùa vụ'), icon: FileTextIcon },
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
      <div className="divide-y divide-warmGray/10">
        {group.items.map(item => (
          <div key={item.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-charcoal">
                <span className="truncate">{item.title}</span>
                {item.reminded && <Badge tone="warning">{t('Chủ nhà yến đã nhắc')}</Badge>}
              </p>
              <p className="truncate text-small text-warmGray">{item.house_name ?? NO_VALUE} · {whenOf(item)}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => open(item)}>{t('Mở')}</Button>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

export default function DomainExpertQueuePage() {
  const farmId = useZoneStore(state => state.selectedFarmId)
  const queue = useExpertQueue(farmId)
  const apiErrorMessage = useApiErrorMessage()

  if (!farmId) return <EmptyState icon={<ClipboardTextIcon className="h-8 w-8" />} title={t('Chọn trang trại ở thanh trên để xem việc đang chờ')} />
  if (queue.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-xl space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SECTIONS.map(section => <LoadingSkeleton key={section.key} className="h-28 w-full rounded-2xl" />)}
        </div>
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
  const byKind = new Map(groups.map(group => [group.kind, group]))
  const pending = KIND_ORDER.map(kind => byKind.get(kind)).filter((group): group is ExpertQueueGroup => Boolean(group && group.total > 0))

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SECTIONS.map(section => {
          const total = sectionTotal(groups, section.key)
          return (
            <KpiTile
              key={section.key}
              icon={section.icon}
              label={section.label()}
              value={total}
              sub={section.sub()}
              tone={total > 0 ? 'orange' : 'neutral'}
              className="h-full"
            />
          )
        })}
      </div>

      {pending.length === 0
        ? <EmptyState icon={<ClipboardTextIcon className="h-8 w-8" />} title={t('Không có việc gì đang chờ')} />
        : pending.map(group => <QueueGroupCard key={group.kind} group={group} />)}
    </div>
  )
}
