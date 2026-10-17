import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, FilterChip, type DataTableColumn } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import TableEmptyState from '@/components/common/TableEmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { buildAlertRow, STATUS_BADGE_CLASS, type AlertLogRow, type SeverityGroup } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import SeverityBadge from '@/components/common/SeverityBadge'
import { DETAIL_BUTTON_CLASS } from '@/components/features/farm-owner/harvest/harvest.constants'
import { useHouseAlerts } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import type { AllZone } from '@/hooks/shared/useFarms'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { LEVELS } from '@/constants/severity'
import { levelDict } from '@/constants/severity.i18n'
import { cn } from '@/lib/cn'

const ROW_COUNT = 6
const ROW_HEIGHT = 64


interface SensorAlertLogTableProps {
  farmId: string
  houseId: string
  zones: AllZone[]
  deviceNames: Map<string, string>
}

// Bảng nhật ký cảnh báo
export default function SensorAlertLogTable({ farmId, houseId, zones, deviceNames }: SensorAlertLogTableProps) {
  const { t, num, time, day } = useTranslation(dashboardDict)
  const { t: tLevel } = useTranslation(levelDict)
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SeverityGroup | undefined>(undefined)
  const zoneIds = useMemo(() => zones.map(zone => zone._id), [zones])
  const locationNames = useMemo(() => new Map(zones.map(zone => [zone._id, `${zone.houseName} | ${zone.name}`])), [zones])
  const { records, isLoading, isError, refetch } = useHouseAlerts(farmId, zoneIds, !houseId)

  const allRows = useMemo(
    () => records.map(alert => buildAlertRow(
      alert,
      alert.node_id ? deviceNames.get(alert.node_id) ?? '—' : '—',
      alert.zone_id ? locationNames.get(alert.zone_id) ?? '—' : '—',
    )),
    [records, deviceNames, locationNames],
  )
  const rows = filter ? allRows.filter(row => row.group === filter) : allRows

  const paginationLabels = useMemo(() => ({
    summary: (from: number, to: number, total: number) => t('pager.summary', { from, to, total }),
    nav: t('pager.nav'),
    first: t('pager.first'),
    prev: t('pager.prev'),
    page: (n: number) => t('pager.page', { n }),
    next: t('pager.next'),
    last: t('pager.last'),
  }), [t])

  const counts = useMemo(() => {
    const result: Record<SeverityGroup, number> = { P1: 0, P2: 0, P3: 0 }
    allRows.forEach(row => { result[row.group] += 1 })
    return result
  }, [allRows])

  const formatValue = useCallback((value: number) => num(value, Number.isInteger(value) ? 0 : 1), [num])

  const columns = useMemo<DataTableColumn<AlertLogRow>[]>(() => [
    {
      key: 'severity', header: t('log.colSeverity'), className: 'w-[100px]',
      render: row => <SeverityBadge severity={row.severity} />,
    },
    {
      key: 'time', header: t('log.colTime'), className: 'w-[110px] whitespace-nowrap',
      render: row => (
        <div>
          <p className="font-medium text-charcoal">{time(row.createdAt)}</p>
          <p className="text-xs text-warmGray">{day(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'location', header: t('log.colLocation'), className: 'w-[220px]',
      render: row => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-charcoal">{row.locationName}</p>
          <p className="mt-0.5 truncate text-xs text-warmGray">{row.deviceName} - {t(`sensorKind.${row.sensorKind}`)}</p>
        </div>
      ),
    },
    {
      key: 'type', header: t('log.colType'),
      render: row => <span className="block">{t(`alertType.${row.type}`)}</span>,
    },
    {
      key: 'value', header: t('log.colValue'), className: 'w-[150px] whitespace-nowrap',
      render: row => row.breach ? (
        <p>
          <span className="font-bold text-safetyOrange">{formatValue(row.breach.value)} {row.breach.unit}</span>{' '}
          <span className="text-xs text-warmGray">/ {row.breach.sign} {formatValue(row.breach.limit)} {row.breach.unit}</span>
        </p>
      ) : <span className="text-warmGray">—</span>,
    },
    {
      key: 'status', header: t('log.colStatus'), className: 'w-[120px]',
      render: row => <Badge className={cn('whitespace-nowrap px-2.5 py-0.5 text-[11px] font-medium', STATUS_BADGE_CLASS[row.status])}>{t(`alertStatus.${row.status}`)}</Badge>,
    },
    {
      key: 'actions', header: t('log.colActions'), align: 'center', className: 'w-[120px] whitespace-nowrap',
      render: row => (
        <button
          type="button"
          onClick={event => { event.stopPropagation(); navigate(`/alerts?highlight=${row.id}`) }}
          className={DETAIL_BUTTON_CLASS}
        >
          {t('log.detail')}
        </button>
      ),
    },
  ], [t, time, day, navigate, formatValue])

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <h2 className="text-h2 text-charcoal">{t('log.title')}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-warmGray">{t('log.filter')}</span>
        <FilterChip
          active={filter === undefined}
          label={`${t('log.all')} (${allRows.length})`}
          onClick={() => setFilter(undefined)}
        />
        {LEVELS.map(level => (
          <FilterChip
            key={level}
            active={filter === level}
            label={`${tLevel(level)} (${counts[level]})`}
            onClick={() => setFilter(level)}
          />
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton count={3} className="h-16 w-full" />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-warmGray/30 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-charcoal">{t('log.error')}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>{t('log.retry')}</Button>
        </div>
      ) : (
        <FixedRowsTable
          columns={columns}
          rows={rows}
          getRowKey={row => row.id}
          onRowClick={row => navigate(`/alerts?highlight=${row.id}`)}
          rowHeight={ROW_HEIGHT}
          pageSize={ROW_COUNT}
          emptyNotice={t('log.empty')}
          emptyContent={<TableEmptyState title={t('log.empty')} />}
          paginationLabels={paginationLabels}
        />
      )}
    </Card>
  )
}
