import { useMemo } from 'react'
import { CaretRightIcon, WarningIcon } from '@phosphor-icons/react'
import { type DataTableColumn } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import TableEmptyState from '@/components/common/TableEmptyState'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { METRIC_BY_KEY } from '@/components/features/farm-owner/farms/farmStructure.constants'
import type { MetricKey, ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'
import { NO_VALUE } from '@/constants/display'
import { cn } from '@/lib/cn'

// 3 chỉ số chính ở bảng Zone; đủ 6 chỉ số ở trang chi tiết Zone
const TABLE_METRICS: MetricKey[] = ['temperature', 'humidity', 'nh3']

interface ZoneTableProps {
  zones: ZoneNode[]
  loadingMetrics: boolean
  onOpen: (node: ZoneNode) => void
}

// Bảng Zone của 1 nhà: mỗi Zone một hàng gồm tình trạng, 3 chỉ số chính và số thiết bị online; bấm cả hàng để mở
export default function ZoneTable({ zones, loadingMetrics, onOpen }: ZoneTableProps) {
  const { t, num } = useTranslation(farmDict)

  const columns = useMemo<DataTableColumn<ZoneNode>[]>(() => [
    {
      key: 'zone', header: 'Zone', className: 'w-[20%]',
      render: node => {
        const floorLabel = t('zone.floor', { n: node.zone.floor })
        return (
          <div className="min-w-0">
            <p className="truncate font-semibold text-charcoal">{node.zone.name}</p>
            {/* Tên Zone đã là "Tầng N" thì không lặp lại tầng */}
            {node.zone.name.trim() !== floorLabel && <p className="truncate text-xs text-warmGray">{floorLabel}</p>}
          </div>
        )
      },
    },
    {
      key: 'status', header: t('table.status'), className: 'w-[24%]',
      render: node => {
        const worst = node.breaches[0]
        if (worst) {
          const text = t(worst.direction === 'high' ? 'zone.over' : 'zone.under', { metric: t(METRIC_BY_KEY[worst.metric].labelKey) })
          return (
            <span title={text} className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-orange-800">
              <WarningIcon size={16} weight="fill" className="shrink-0" />
              <span className="truncate">{text}</span>
            </span>
          )
        }
        if (!node.metrics) return <span className="text-sm text-warmGray">{loadingMetrics ? '…' : t('zone.noSignal')}</span>
        return (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-charcoal">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent-600" />
            {t('health.normal')}
          </span>
        )
      },
    },
    ...TABLE_METRICS.map(key => {
      const meta = METRIC_BY_KEY[key]
      return {
        key, header: t(meta.labelKey), className: 'w-[11%] whitespace-nowrap',
        render: (node: ZoneNode) => {
          const value = node.metrics?.[key]
          if (value === undefined) return <span className="text-warmGray">{NO_VALUE}</span>
          const isOver = node.breaches.some(breach => breach.metric === key)
          return (
            <span className={cn('text-sm font-semibold', isOver ? 'text-climateOrange' : 'text-charcoal')}>
              {num(value, meta.decimals)}<span className="ml-1 text-xs font-medium text-warmGray">{meta.unit}</span>
            </span>
          )
        },
      }
    }),
    {
      key: 'devices', header: t('table.devices'), className: 'w-[12%] whitespace-nowrap',
      render: node => (
        <span className={cn('text-sm font-semibold', node.counts.total === 0 ? 'text-warmGray' : node.counts.online < node.counts.total ? 'text-climateOrange' : 'text-charcoal')}>
          {node.counts.total === 0 ? NO_VALUE : `${num(node.counts.online)}/${num(node.counts.total)}`}
        </span>
      ),
    },
    {
      key: 'actions', header: '', align: 'right', className: 'w-[4%]',
      render: () => <CaretRightIcon size={16} weight="bold" aria-hidden className="ml-auto text-warmGray" />,
    },
  ], [t, num, loadingMetrics])

  return (
    <FixedRowsTable
      columns={columns}
      rows={zones}
      getRowKey={node => node.zone._id}
      onRowClick={onOpen}
      rowHeight={60}
      emptyNotice={t('house.noZone')}
      emptyContent={<TableEmptyState title={t('house.noZone')} description={t('house.noZoneDesc')} />}
      mobileCard={node => {
        const worst = node.breaches[0]
        const statusText = worst
          ? t(worst.direction === 'high' ? 'zone.over' : 'zone.under', { metric: t(METRIC_BY_KEY[worst.metric].labelKey) })
          : node.metrics ? t('health.normal') : loadingMetrics ? '…' : t('zone.noSignal')
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-body font-semibold text-charcoal">{node.zone.name}</p>
              <span className={cn('shrink-0 text-small font-semibold', worst ? 'text-orange-800' : 'text-warmGray')}>{statusText}</span>
            </div>
            <p className="text-small text-warmGray">{t('card.devicesOnline', { online: num(node.counts.online), total: num(node.counts.total) })}</p>
          </div>
        )
      }}
    />
  )
}
