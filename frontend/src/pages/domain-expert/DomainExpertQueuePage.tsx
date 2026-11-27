// Trang chủ Chuyên gia: một bảng việc đang chờ của trại đang chọn, hàng tab lọc theo kiểu quyết định, bấm cả dòng để mở việc
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CaretRightIcon, ChecksIcon, ClipboardTextIcon, FileTextIcon, LightbulbFilamentIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import StatusTabs from '@/components/common/StatusTabs'
import TableEmptyState from '@/components/common/TableEmptyState'
import {
  hiddenCounts, queueRows, sectionOf, sectionTotal, targetOf, type QueueRow, type QueueSection, type QueueTab,
} from '@/components/features/domain-expert/queue/queue.utils'
import { Badge, Button, EmptyState, LoadingSkeleton, SectionCard } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import type { DataTableColumn } from '@/components/ui/DataTable'
import { NO_VALUE } from '@/constants/display'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useExpertQueue } from '@/hooks/domain-expert/useExpertQueue'
import { t } from '@/i18n'
import { formatDateTime, formatStandardDate } from '@/lib/i18n'
import { useZoneStore } from '@/stores/zoneStore'
import type { ExpertQueueItem, ExpertQueueKind } from '@/types/expert/queue.types'

// Tên loại việc; dựng trong component để đổi ngôn ngữ thì đổi theo
const kindTitle = (kind: ExpertQueueKind): string => ({
  alert_verdict: t('Cảnh báo chờ kiểm chứng'),
  parameter_review: t('Thay đổi tham số chờ duyệt'),
  coefficient_proposal: t('Đề xuất hệ số mờ'),
  disagreeing_day: t('Ngày đánh giá khác hệ thống (14 ngày qua)'),
  report_conclusion: t('Báo cáo chờ kết luận'),
  weather_proposal: t('Đề xuất luật phun sương theo thời tiết'),
  profile_draft: t('Hồ sơ cấu hình chờ duyệt'),
  recommendation_rule: t('Luật khuyến nghị chờ bật'),
  season_conclusion: t('Mùa vụ chờ kết luận'),
})[kind]

const SECTIONS: Array<{ key: QueueSection; label: () => string; icon: typeof ShieldCheckIcon }> = [
  { key: 'verdicts', label: () => t('Kiểm chứng cảnh báo'), icon: ShieldCheckIcon },
  { key: 'reviews', label: () => t('Duyệt thay đổi'), icon: ChecksIcon },
  { key: 'proposals', label: () => t('Duyệt đề xuất'), icon: LightbulbFilamentIcon },
  { key: 'conclusions', label: () => t('Viết kết luận'), icon: FileTextIcon },
]
const SECTION_ICON = Object.fromEntries(SECTIONS.map(section => [section.key, section.icon])) as Record<QueueSection, typeof ShieldCheckIcon>

// Ngày lệch trả 'YYYY-MM-DD', các việc khác trả thời điểm
const whenOf = (item: ExpertQueueItem) => (/^\d{4}-\d{2}-\d{2}$/.test(item.at) ? formatStandardDate(item.at) : formatDateTime(item.at))

const rowKey = (row: QueueRow) => `${row.kind}-${row.item.id}`

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

  const columns = useMemo<DataTableColumn<QueueRow>[]>(() => [
    {
      key: 'kind', header: t('Loại việc'), className: 'w-[27%]',
      render: ({ kind }) => {
        const Icon = SECTION_ICON[sectionOf(kind)]
        return (
          <span className="flex items-center gap-2.5 text-sm text-charcoal">
            <Icon size={18} aria-hidden className="shrink-0 text-warmGray" />
            <span className="line-clamp-2">{kindTitle(kind)}</span>
          </span>
        )
      },
    },
    {
      key: 'title', header: t('Nội dung'), className: 'w-[38%]',
      render: ({ item }) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="line-clamp-2 text-sm font-semibold text-charcoal">{item.title}</span>
          {item.reminded && <Badge tone="warning">{t('Chủ nhà yến đã nhắc')}</Badge>}
        </div>
      ),
    },
    { key: 'house', header: t('Nhà'), className: 'w-[13%]', render: ({ item }) => <span className="text-sm text-charcoal">{item.house_name ?? NO_VALUE}</span> },
    { key: 'time', header: t('Thời gian'), className: 'w-[16%] whitespace-nowrap', render: ({ item }) => <span className="text-sm text-graphite">{whenOf(item)}</span> },
    { key: 'open', header: '', align: 'right', className: 'w-[6%]', render: () => <CaretRightIcon size={16} weight="bold" aria-hidden className="ml-auto text-warmGray" /> },
  ], [])

  if (!farmId) return <EmptyState icon={<ClipboardTextIcon className="h-8 w-8" />} title={t('Chọn trang trại ở thanh trên để xem việc đang chờ')} />
  if (queue.isLoading) return <LoadingSkeleton count={4} className="h-16 w-full rounded-2xl" />
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
  const rows = queueRows(groups, tab)
  const hidden = hiddenCounts(groups, tab)

  return (
    <div className="relative flex w-full flex-1 flex-col gap-6">
      <SectionCard description={t('Việc chủ nhà yến đã nhắc và việc chờ lâu nhất đứng trước.')}>
        <StatusTabs
          variant="underline"
          ariaLabel={t('Lọc việc theo loại')}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'all', label: t('Tất cả'), badge: total },
            ...SECTIONS.map(section => ({ id: section.key, label: section.label(), badge: sectionTotal(groups, section.key) })),
          ]}
        />

        <FixedRowsTable
          columns={columns}
          rows={rows}
          getRowKey={rowKey}
          onRowClick={open}
          rowHeight={72}
          emptyNotice={t('Không có việc gì đang chờ')}
          emptyContent={<TableEmptyState title={t('Không có việc gì đang chờ')} description={t('Cảnh báo cần kết luận, thay đổi và đề xuất của chủ nhà yến sẽ hiện ở đây.')} />}
          mobileCard={row => (
            <div className="flex flex-col gap-1.5">
              <p className="text-small text-warmGray">{kindTitle(row.kind)}</p>
              <p className="text-body font-semibold text-charcoal">{row.item.title}</p>
              <p className="text-small text-warmGray">{row.item.house_name ?? NO_VALUE} · {whenOf(row.item)}</p>
              {row.item.reminded && <div><Badge tone="warning">{t('Chủ nhà yến đã nhắc')}</Badge></div>}
            </div>
          )}
        />

        {hidden.length > 0 && (
          <div className="flex flex-col gap-2">
            {hidden.map(({ kind, hidden: count }) => (
              <div key={kind} className="flex items-center justify-between gap-3 text-small">
                <span className="min-w-0 truncate text-graphite">{kindTitle(kind)}: {t('còn {{n}} việc', { n: count })}</span>
                <Link to={targetOf(kind)} className="shrink-0 font-medium text-accent-700 hover:underline">{t('Xem tất cả')}</Link>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
