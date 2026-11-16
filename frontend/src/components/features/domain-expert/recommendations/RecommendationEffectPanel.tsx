import { Badge, DataTable, type DataTableColumn } from '@/components/ui'
import { recommendationsDict } from '@/constants/recommendations.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import type { RecommendationRuleEffect } from '@/types'

// EXPERT-FR-019 — mỗi luật: số khuyến nghị đã mở, đã chấp nhận, đã đo hiệu quả, có cải thiện
export default function RecommendationEffectPanel({ effects }: { effects: RecommendationRuleEffect[] }) {
  const { t, num } = useTranslation(recommendationsDict)
  const countCell = (value: number) => <span className="text-sm tabular-nums text-charcoal">{num(value)}</span>

  const columns: DataTableColumn<RecommendationRuleEffect>[] = [
    {
      key: 'rule',
      header: t('col.rule'),
      render: row => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-semibold text-charcoal">{row.name}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-warmGray">
            {t(`indicator.${row.indicator}`)}
            {!row.active && <Badge tone="neutral">{t('effects.off')}</Badge>}
          </span>
        </div>
      ),
    },
    { key: 'raised', header: t('effects.raised'), align: 'right', render: row => countCell(row.raised) },
    { key: 'accepted', header: t('effects.accepted'), align: 'right', render: row => countCell(row.accepted) },
    { key: 'measured', header: t('effects.measured'), align: 'right', render: row => countCell(row.measured) },
    {
      key: 'improved',
      header: t('effects.improved'),
      align: 'right',
      render: row => <span className="text-sm font-semibold tabular-nums text-accent-800">{num(row.improved)}</span>,
    },
  ]

  return <DataTable columns={columns} rows={effects} getRowKey={row => row.rule_id} emptyMessage={t('effects.empty')} minTableWidth={640} />
}
