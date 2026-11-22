import { Badge, DataTable, type BadgeTone, type DataTableColumn } from '@/components/ui'
import { NO_VALUE } from '@/constants/display'
import { countingScheduleDict } from '@/constants/countingSchedule.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { cn } from '@/lib/cn'
import { historyRows, type HistoryEntry, type HistoryRow, type HistoryState } from '@/components/features/domain-expert/counting-schedule/scheduleHistory.utils'
import type { TimeWindow } from '@/types/expert.types'

const STATE_TONE: Record<HistoryState, BadgeTone> = { LATEST: 'positive', SUPERSEDED: 'neutral', APPLIED: 'info' }

// "05:30–07:00"
const span = (window: TimeWindow) => `${window.start}–${window.end}`
// 'MM-DD' → 'DD/MM'
const monthDay = (value: string) => value.split('-').reverse().join('/')

// bảng các lần sửa lịch đếm, mới nhất trước: ngày áp, người sửa, lúc sửa, hồ sơ, khung tạm, trạng thái
export default function ScheduleHistoryList({ history }: { history: HistoryEntry[] }) {
  const { t, date, dateTime } = useTranslation(countingScheduleDict)

  const columns: DataTableColumn<HistoryRow>[] = [
    {
      key: 'effectiveFrom',
      header: t('history.col.effectiveFrom'),
      className: 'w-32 whitespace-nowrap',
      render: ({ entry, state }) => (
        <span className={cn('text-sm font-semibold', state === 'SUPERSEDED' ? 'text-warmGray line-through' : 'text-charcoal')}>
          {date(entry.effective_from)}
        </span>
      ),
    },
    {
      key: 'changedBy',
      header: t('history.col.changedBy'),
      className: 'w-32 whitespace-nowrap',
      render: ({ entry }) => (
        <span className="text-sm text-charcoal">{t(entry.changed_by_role === 'FARM_OWNER' ? 'role.FARM_OWNER' : 'role.DOMAIN_EXPERT')}</span>
      ),
    },
    {
      key: 'changedAt',
      header: t('history.col.changedAt'),
      className: 'w-40 whitespace-nowrap',
      render: ({ entry }) => <span className="text-sm text-charcoal">{dateTime(entry.changed_at)}</span>,
    },
    {
      key: 'profiles',
      header: t('history.col.profiles'),
      render: ({ entry }) => {
        if (entry.schedule.profiles.length === 0) return <span className="text-sm text-warmGray">{NO_VALUE}</span>
        return (
          <ul className="flex flex-col gap-1">
            {entry.schedule.profiles.map(profile => (
              <li key={`${profile.name}-${profile.from}`} className="flex flex-col">
                <span className="text-sm font-semibold text-charcoal">{t('history.profileName', { name: profile.name, from: monthDay(profile.from), to: monthDay(profile.to) })}</span>
                <span className="text-xs text-warmGray">{t('history.windows', { morning: span(profile.morning), evening: span(profile.evening) })}</span>
              </li>
            ))}
          </ul>
        )
      },
    },
    {
      key: 'temporary',
      header: t('history.col.temporary'),
      render: ({ entry }) => {
        if (entry.schedule.temporary.length === 0) return <span className="text-sm text-warmGray">{NO_VALUE}</span>
        return (
          <ul className="flex flex-col gap-1">
            {entry.schedule.temporary.map(window => (
              <li key={window.from} className="flex flex-col">
                <span className="text-sm font-semibold text-charcoal">{t('history.dateRange', { from: date(window.from), to: date(window.to) })}</span>
                <span className="text-xs text-warmGray">{t('history.windows', { morning: span(window.morning), evening: span(window.evening) })}</span>
              </li>
            ))}
          </ul>
        )
      },
    },
    {
      key: 'state',
      header: t('history.col.state'),
      className: 'w-36 whitespace-nowrap',
      render: ({ state }) => (
        <Badge tone={STATE_TONE[state]} title={state === 'SUPERSEDED' ? t('history.supersededHint') : undefined}>
          {t(`history.state.${state}`)}
        </Badge>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={historyRows(history)}
      getRowKey={row => row.entry.changed_at}
      emptyMessage={t('history.empty')}
      minTableWidth={900}
    />
  )
}
