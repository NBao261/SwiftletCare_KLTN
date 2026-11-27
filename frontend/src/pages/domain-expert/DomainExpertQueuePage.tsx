// Trang chủ Chuyên gia: một hàng đợi chung của trại đang chọn; đầu trang là tổng số việc và nút làm việc đầu tiên, cột trái lọc theo kiểu quyết định, bấm cả hàng để mở việc
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRightIcon, CaretRightIcon, ChecksIcon, ClipboardTextIcon, FileTextIcon, LightbulbFilamentIcon, ListChecksIcon, ShieldCheckIcon,
} from '@phosphor-icons/react'
import {
  hiddenCounts, queueRows, remindedCount, sectionOf, sectionTotal, targetOf, type QueueRow, type QueueSection, type QueueTab,
} from '@/components/features/domain-expert/queue/queue.utils'
import { Badge, Button, EmptyState, LoadingSkeleton } from '@/components/ui'
import { NO_VALUE } from '@/constants/display'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useExpertQueue } from '@/hooks/domain-expert/useExpertQueue'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { formatDateTime, formatStandardDate } from '@/lib/i18n'
import { useZoneStore } from '@/stores/zoneStore'
import type { ExpertQueueItem, ExpertQueueKind } from '@/types/expert/queue.types'

// Tên loại việc; dựng trong component để đổi ngôn ngữ thì đổi theo
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

const SECTIONS: Array<{ key: QueueSection; label: () => string; icon: typeof ShieldCheckIcon }> = [
  { key: 'verdicts', label: () => t('Kết luận cảnh báo'), icon: ShieldCheckIcon },
  { key: 'reviews', label: () => t('Duyệt thay đổi'), icon: ChecksIcon },
  { key: 'proposals', label: () => t('Duyệt đề xuất'), icon: LightbulbFilamentIcon },
  { key: 'conclusions', label: () => t('Viết kết luận'), icon: FileTextIcon },
]
const SECTION_ICON = Object.fromEntries(SECTIONS.map(section => [section.key, section.icon])) as Record<QueueSection, typeof ShieldCheckIcon>

// Ngày lệch trả 'YYYY-MM-DD', các việc khác trả thời điểm
const whenOf = (item: ExpertQueueItem) => (/^\d{4}-\d{2}-\d{2}$/.test(item.at) ? formatStandardDate(item.at) : formatDateTime(item.at))

// Một việc trong hàng đợi: icon của kiểu quyết định, loại việc, nội dung, nhà và giờ
function QueueRowItem({ row, onOpen }: { row: QueueRow; onOpen: (row: QueueRow) => void }) {
  const Icon = SECTION_ICON[sectionOf(row.kind)]
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="flex min-h-[4.5rem] w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-warmGray/5 focus-visible:bg-warmGray/5 focus-visible:outline-none"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warmGray/10 text-charcoal">
          <Icon size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-warmGray">{kindTitle(row.kind)}</span>
          <span className="mt-0.5 line-clamp-2 text-sm font-semibold text-charcoal">{row.item.title}</span>
          <span className="mt-0.5 flex items-center gap-2 text-small text-warmGray">
            <span className="truncate">{row.item.house_name ?? NO_VALUE} · {whenOf(row.item)}</span>
            {row.item.reminded && <Badge tone="warning" className="shrink-0 whitespace-nowrap xl:hidden">{t('Chủ nhà yến đã nhắc')}</Badge>}
          </span>
        </span>
        {row.item.reminded && <Badge tone="warning" className="hidden shrink-0 whitespace-nowrap xl:inline-flex">{t('Chủ nhà yến đã nhắc')}</Badge>}
        <CaretRightIcon size={16} className="shrink-0 text-warmGray" aria-hidden />
      </button>
    </li>
  )
}

export default function DomainExpertQueuePage() {
  const [tab, setTab] = useState<QueueTab>('all')
  const navigate = useNavigate()
  const farmId = useZoneStore(state => state.selectedFarmId)
  const setHouse = useZoneStore(state => state.setHouse)
  const queue = useExpertQueue(farmId)
  const apiErrorMessage = useApiErrorMessage()

  // Luật thời tiết theo nhà: chọn nhà của đề xuất rồi mới mở trang
  const open = ({ kind, item }: QueueRow) => {
    if (kind === 'weather_proposal') setHouse(item.id)
    navigate(targetOf(kind, item))
  }

  if (!farmId) return <EmptyState icon={<ClipboardTextIcon className="h-8 w-8" />} title={t('Chọn trang trại ở thanh trên để xem việc đang chờ')} />
  if (queue.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-xl space-y-6">
        <LoadingSkeleton className="h-14 w-72 rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <LoadingSkeleton className="h-48 w-full rounded-2xl" />
          <LoadingSkeleton count={3} className="h-20 w-full rounded-2xl" />
        </div>
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
  if (total === 0) {
    return (
      <EmptyState
        icon={<ListChecksIcon className="h-8 w-8" />}
        title={t('Không có việc gì đang chờ')}
        description={t('Cảnh báo cần kết luận, thay đổi và đề xuất của Chủ nhà yến sẽ hiện ở đây.')}
      />
    )
  }

  const rows = queueRows(groups, tab)
  const first = queueRows(groups, 'all')[0]
  const reminded = remindedCount(groups)
  const hidden = hiddenCounts(groups, tab)
  const tabs: Array<{ id: QueueTab; label: string; count: number; icon: typeof ShieldCheckIcon }> = [
    { id: 'all', label: t('Tất cả'), count: total, icon: ListChecksIcon },
    ...SECTIONS.map(section => ({ id: section.key, label: section.label(), count: sectionTotal(groups, section.key), icon: section.icon })),
  ]

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex items-center gap-4">
          <span className="text-5xl font-semibold leading-none tracking-tight text-charcoal tabular-nums">{total}</span>
          <div>
            <p className="text-h2 text-charcoal">{t('việc đang chờ bạn')}</p>
            {reminded > 0 && <p className="mt-0.5 text-small text-warmGray">{t('{{n}} việc Chủ nhà yến đã nhắc', { n: reminded })}</p>}
          </div>
        </div>
        {first && (
          <Button onClick={() => open(first)}>
            {t('Làm việc đầu tiên')}
            <ArrowRightIcon size={16} weight="bold" aria-hidden />
          </Button>
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div
          role="tablist"
          aria-label={t('Lọc việc theo loại')}
          className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
        >
          {tabs.map(({ id, label, count, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-colors max-lg:h-10 lg:h-11 lg:w-full',
                  active ? 'bg-charcoal text-white' : 'text-graphite hover:bg-warmGray/10',
                )}
              >
                <Icon size={18} aria-hidden className={cn('max-lg:hidden', active ? 'text-limeMist' : 'text-warmGray')} />
                <span className="lg:flex-1 lg:text-left">{label}</span>
                <span className={cn('text-small tabular-nums', active ? 'text-white/70' : count > 0 ? 'text-charcoal' : 'text-warmGray/60')}>{count}</span>
              </button>
            )
          })}
        </div>

        <section className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
          {rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-warmGray">{t('Không có việc gì đang chờ')}</p>
          ) : (
            <ul className="divide-y divide-warmGray/10">
              {rows.map(row => <QueueRowItem key={`${row.kind}-${row.item.id}`} row={row} onOpen={open} />)}
            </ul>
          )}
          {hidden.length > 0 && (
            <div className="divide-y divide-warmGray/10 border-t border-warmGray/10 bg-warmGray/5">
              {hidden.map(({ kind, hidden: count }) => (
                <div key={kind} className="flex items-center justify-between gap-3 px-5 py-3 text-small">
                  <span className="min-w-0 truncate text-graphite">{kindTitle(kind)}: {t('còn {{n}} việc', { n: count })}</span>
                  <Link to={targetOf(kind)} className="shrink-0 font-medium text-accent-700 hover:underline">{t('Xem tất cả')}</Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
