// EXPERT-FR-020, HARVEST-FR-007 — Danh sách chu kỳ thu hoạch, kết luận mùa vụ
import { useState } from 'react'
import { Wheat } from 'lucide-react'
import { Badge, Button, DataTable, LoadingSkeleton, Pagination, SelectMenu, SectionCard, type DataTableColumn } from '@/components/ui'
import TableEmptyState from '@/components/common/TableEmptyState'
import CycleConclusionDrawer from '@/components/features/domain-expert/harvest/CycleConclusionDrawer'
import { harvestCyclesDict } from '@/constants/harvestCycles.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useHarvestCycles } from '@/hooks/domain-expert/useHarvestCycles'
import type { HarvestCycle, HarvestCycleStatus } from '@/types/harvest.types'
import type { BadgeTone } from '@/components/ui/Badge'

interface HarvestCyclesSectionProps {
  scope: { houseId?: string; farmId?: string } | null
}

type StatusFilter = '' | HarvestCycleStatus

const STATUS_TONE: Record<HarvestCycleStatus, BadgeTone> = {
  OPEN: 'warning',
  CLOSED: 'neutral',
  CONCLUDED: 'positive',
}

const PAGE_SIZE = 10

export default function HarvestCyclesSection({ scope }: HarvestCyclesSectionProps) {
  const { t, date: formatDate } = useTranslation(harvestCyclesDict)
  const apiErrorMessage = useApiErrorMessage()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [page, setPage] = useState(1)
  const [selectedCycle, setSelectedCycle] = useState<HarvestCycle | null>(null)

  const hasScope = !!(scope?.farmId || scope?.houseId)

  const { records: cycles, total, isLoading, isError, error, refetch } = useHarvestCycles(
    {
      farmId: scope?.farmId,
      houseId: scope?.houseId,
      status: statusFilter || undefined,
      page,
      limit: PAGE_SIZE,
    },
    hasScope,
  )

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: '', label: t('filter.all') },
    { value: 'OPEN', label: t('status.OPEN') },
    { value: 'CLOSED', label: t('status.CLOSED') },
    { value: 'CONCLUDED', label: t('status.CONCLUDED') },
  ]

  const columns: DataTableColumn<HarvestCycle>[] = [
    {
      key: 'period',
      header: t('col.period'),
      render: row => (
        <span className="text-xs text-charcoal">
          {row.end_date
            ? t('cell.period', { from: formatDate(row.start_date), to: formatDate(row.end_date) })
            : t('cell.periodOpen', { from: formatDate(row.start_date) })}
        </span>
      ),
    },
    {
      key: 'yield',
      header: t('col.yield'),
      align: 'right',
      render: row => {
        const c = row.closing_harvest
        if (!c) return <span className="text-xs text-warmGray">—</span>
        return (
          <span className="text-xs text-charcoal">
            {t('cell.yieldSummary', {
              n: c.nest_count,
              kg: (c.weight_grams / 1000).toFixed(2),
            })}
          </span>
        )
      },
    },
    {
      key: 'comparison',
      header: t('col.comparison'),
      align: 'right',
      render: row => {
        const pct = row.comparison?.previous?.nest_count_change_pct ?? null
        if (pct === null) return <span className="text-xs text-warmGray">—</span>
        const isPos = pct >= 0
        return (
          <span className={`text-xs font-semibold ${isPos ? 'text-success' : 'text-alertRed'}`}>
            {isPos ? '+' : ''}{pct.toFixed(1)}%
          </span>
        )
      },
    },
    {
      key: 'status',
      header: t('col.status'),
      align: 'center',
      render: row => (
        <Badge tone={STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</Badge>
      ),
    },
    {
      key: 'conclusion',
      header: t('col.conclusion'),
      align: 'center',
      render: row => (
        <Badge tone={row.conclusion ? 'positive' : 'neutral'}>
          {row.conclusion ? t('cell.hasConclusion') : t('cell.noConclusion')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('col.actions'),
      align: 'center',
      render: row => (
        <Button
          size="sm"
          onClick={e => { e.stopPropagation(); setSelectedCycle(row) }}
          disabled={row.status === 'OPEN'}
        >
          {row.conclusion ? t('action.edit') : t('action.write')}
        </Button>
      ),
    },
  ]

  // Chưa chọn phạm vi → nhắc chọn; tải → khung chờ; lỗi → báo kèm Thử lại; rỗng → khung rỗng; còn lại là bảng (FE_Design 13.5)
  let body = (
    <div className="py-10">
      <TableEmptyState title={t('section.noScope')} />
    </div>
  )
  if (hasScope && isLoading) body = <LoadingSkeleton count={5} />
  if (hasScope && !isLoading && isError) {
    body = (
      <div className="py-10">
        <TableEmptyState title={t('error.title')} description={apiErrorMessage(error)} />
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('error.retry')}</Button>
        </div>
      </div>
    )
  }
  if (hasScope && !isLoading && !isError && cycles.length === 0) {
    body = (
      <div className="py-10">
        <TableEmptyState
          title={statusFilter ? t('empty.filteredTitle') : t('empty.title')}
          description={statusFilter ? t('empty.filteredDesc') : t('empty.desc')}
        />
      </div>
    )
  }
  if (hasScope && !isLoading && !isError && cycles.length > 0) {
    body = (
      <>
        <DataTable
          columns={columns}
          rows={cycles}
          getRowKey={row => row._id}
          onRowClick={row => { if (row.status !== 'OPEN') setSelectedCycle(row) }}
          minTableWidth={900}
        />
        <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} />
      </>
    )
  }

  return (
    <>
      <SectionCard
        title={t('section.title')}
        description={t('section.subtitle')}
        icon={<Wheat className="w-4 h-4" />}
        action={
          <SelectMenu
            value={statusFilter}
            onChange={v => { setStatusFilter(v as StatusFilter); setPage(1) }}
            options={statusOptions}
            ariaLabel={t('filter.status')}
          />
        }
      >
        {body}
      </SectionCard>

      <CycleConclusionDrawer
        cycle={selectedCycle}
        onClose={() => setSelectedCycle(null)}
      />
    </>
  )
}
