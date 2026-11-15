// EXPERT-FR-020, HARVEST-FR-007 — Danh sách chu kỳ thu hoạch, kết luận mùa vụ
import { useState } from 'react'
import { Wheat } from 'lucide-react'
import { Badge, DataTable, LoadingSkeleton, SelectMenu, SectionCard, type DataTableColumn } from '@/components/ui'
import TableEmptyState from '@/components/common/TableEmptyState'
import CycleConclusionDrawer from '@/components/features/domain-expert/harvest/CycleConclusionDrawer'
import { harvestCyclesDict } from '@/constants/harvestCycles.i18n'
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [page, setPage] = useState(1)
  const [selectedCycle, setSelectedCycle] = useState<HarvestCycle | null>(null)

  const hasScope = !!(scope?.farmId || scope?.houseId)

  const { data, isLoading } = useHarvestCycles(
    {
      farmId: scope?.farmId,
      houseId: scope?.houseId,
      status: statusFilter || undefined,
      page,
      limit: PAGE_SIZE,
    },
    hasScope,
  )

  const cycles = data?.cycles ?? []
  const totalPages = data?.meta ? Math.ceil((data.meta.total ?? 0) / PAGE_SIZE) : 1

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
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setSelectedCycle(row) }}
          disabled={row.status === 'OPEN'}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            row.status !== 'OPEN'
              ? 'bg-charcoal text-white hover:bg-charcoal/80'
              : 'bg-neutral-100 text-warmGray cursor-not-allowed'
          }`}
        >
          {row.conclusion ? t('action.edit') : t('action.write')}
        </button>
      ),
    },
  ]

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
        {!hasScope ? (
          <div className="py-10">
            <TableEmptyState title={t('section.noScope')} />
          </div>
        ) : isLoading ? (
          <LoadingSkeleton count={5} />
        ) : cycles.length === 0 ? (
          <div className="py-10">
            <TableEmptyState
              title={statusFilter ? t('empty.filteredTitle') : t('empty.title')}
              description={statusFilter ? t('empty.filteredDesc') : t('empty.desc')}
            />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={cycles}
              getRowKey={row => row._id}
              onRowClick={row => { if (row.status !== 'OPEN') setSelectedCycle(row) }}
              minTableWidth={900}
            />
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-warmGray/10 text-charcoal disabled:opacity-40 hover:bg-warmGray/20 transition-colors"
                >
                  ‹
                </button>
                <span className="text-xs text-warmGray">{page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-warmGray/10 text-charcoal disabled:opacity-40 hover:bg-warmGray/20 transition-colors"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <CycleConclusionDrawer
        cycle={selectedCycle}
        onClose={() => setSelectedCycle(null)}
      />
    </>
  )
}
