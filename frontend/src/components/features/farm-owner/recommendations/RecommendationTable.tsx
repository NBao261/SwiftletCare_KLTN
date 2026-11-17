import { useMemo } from 'react';
import { RECOMMENDATION_STATUS_TONE, ruleOf } from '@/components/features/farm-owner/recommendations/recommendations.constants';
import { Badge, Button, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { NO_VALUE } from '@/constants/display';
import { recommendationsDict } from '@/constants/recommendations.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { RECOMMENDATIONS_PAGE_SIZE } from '@/hooks/farm-owner/useRecommendations';
import { useRecommendationText } from '@/hooks/shared/useRecommendationText';
import type { Recommendation } from '@/types';

// Cùng chiều cao dòng bảng kế hoạch bảo trì
const ROW_HEIGHT = 72;

interface RecommendationTableProps {
  recommendations: Recommendation[];
  serverPagination: { page: number; total: number; onChange: (page: number) => void };
  houseNames: Map<string, string>;
  // Farm Owner quyết định khuyến nghị đang mở; người khác chỉ xem
  canDecide: boolean;
  emptyNotice: string;
  onOpen: (recommendation: Recommendation) => void;
}

// EXPERT-FR-017 — bảng khuyến nghị: nhà, luật, ngày thoả, đề xuất, trạng thái
export default function RecommendationTable({
  recommendations, serverPagination, houseNames, canDecide, emptyNotice, onOpen,
}: RecommendationTableProps): JSX.Element {
  const { t, date } = useTranslation(recommendationsDict);
  const text = useRecommendationText();

  const columns = useMemo<DataTableColumn<Recommendation>[]>(() => [
    {
      key: 'house',
      header: t('col.house'),
      className: 'w-[16%]',
      render: row => <span className="block truncate text-small text-charcoal">{houseNames.get(row.house_id) ?? NO_VALUE}</span>,
    },
    {
      key: 'rule',
      header: t('col.rule'),
      className: 'w-[22%]',
      render: row => <span className="block truncate text-small font-semibold text-charcoal">{ruleOf(row)?.name ?? NO_VALUE}</span>,
    },
    { key: 'raisedFor', header: t('col.raisedFor'), className: 'w-[12%] whitespace-nowrap', render: row => <span className="text-small text-charcoal">{date(row.raised_for)}</span> },
    {
      key: 'action',
      header: t('col.action'),
      render: row => {
        const rule = ruleOf(row);
        return <span className="line-clamp-2 text-small text-charcoal">{rule ? text.action(rule.action) : NO_VALUE}</span>;
      },
    },
    {
      key: 'status',
      header: t('col.status'),
      className: 'w-[14%] whitespace-nowrap',
      render: row => <Badge tone={RECOMMENDATION_STATUS_TONE[row.status]}>{t(`status.${row.status}`)}</Badge>,
    },
    {
      key: 'open',
      header: '',
      align: 'center',
      className: 'w-48',
      render: row => {
        const decide = canDecide && row.status === 'OPEN';
        return (
          <Button
            size="sm"
            className="whitespace-nowrap"
            variant={decide ? 'primary' : 'secondary'}
            onClick={event => {
              event.stopPropagation();
              onOpen(row);
            }}
          >
            {t(decide ? 'row.open' : 'row.view')}
          </Button>
        );
      },
    },
  ], [t, date, text, houseNames, canDecide, onOpen]);

  return (
    <FixedRowsTable
      columns={columns}
      rows={recommendations}
      getRowKey={row => row._id}
      onRowClick={onOpen}
      rowHeight={ROW_HEIGHT}
      pageSize={RECOMMENDATIONS_PAGE_SIZE}
      emptyNotice={emptyNotice}
      serverPagination={serverPagination}
    />
  );
}
