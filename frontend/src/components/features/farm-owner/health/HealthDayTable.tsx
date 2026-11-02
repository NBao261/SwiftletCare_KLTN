import { useMemo } from 'react';

import HealthStatusBadge from '@/components/features/farm-owner/health/HealthStatusBadge';
import { lastRatingDay } from '@/components/features/farm-owner/health/healthDay.utils';
import { Button, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { HouseHealthDay } from '@/types';

// Khung bảng cố định 10 dòng (thiếu thì bù dòng trống, nhiều hơn thì phân trang) — cùng cách HarvestTable
const ROW_COUNT = 10;
const ROW_HEIGHT = 72;

interface HealthDayTableProps {
  days: HouseHealthDay[];
  // Ngày còn PENDING mở popup chấm, ngày khác mở chi tiết
  onRate: (day: HouseHealthDay) => void;
  onView: (day: HouseHealthDay) => void;
}

// Bảng các ngày: ngày chưa đánh giá không có trạng thái (BR-31), chỉ có nút Đánh giá
export default function HealthDayTable({ days, onRate, onView }: HealthDayTableProps): JSX.Element {
  const { t, date } = useTranslation(healthDict);

  // STT theo vị trí trong cả danh sách (không reset khi sang trang)
  const orderById = useMemo(() => new Map(days.map((day, index) => [day._id, index + 1])), [days]);

  const columns = useMemo<DataTableColumn<HouseHealthDay>[]>(() => [
    { key: 'index', header: t('col.index'), className: 'w-16', render: day => <span className="text-sm text-warmGray">{orderById.get(day._id)}</span> },
    // Ngày và nhà là khoá của dòng nên in đậm, như HarvestTable
    { key: 'date', header: t('col.date'), render: day => <span className="text-sm font-semibold text-charcoal">{date(day.date)}</span> },
    { key: 'house', header: t('col.house'), render: day => <span className="text-sm font-semibold text-charcoal">{day.house_name}</span> },
    {
      key: 'status',
      header: t('col.status'),
      render: day => (day.current_status
        ? <HealthStatusBadge status={day.current_status} />
        : <span className="text-sm italic text-warmGray">{t('cell.hidden')}</span>),
    },
    {
      key: 'myRating',
      header: t('col.myRating'),
      render: day => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-charcoal">{t(`ratingState.${day.my_rating_state}`)}</span>
          {day.my_rating_state === 'PENDING' && (
            <span className="text-xs text-warmGray">{t('cell.deadline', { date: date(lastRatingDay(day.rating_deadline)) })}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('col.actions'),
      align: 'right',
      render: day => (day.my_rating_state === 'PENDING'
        ? <Button size="sm" variant="accent" onClick={event => { event.stopPropagation(); onRate(day); }}>{t('action.rate')}</Button>
        : <Button size="sm" variant="secondary" onClick={event => { event.stopPropagation(); onView(day); }}>{t('action.view')}</Button>),
    },
  ], [t, date, onRate, onView, orderById]);

  return (
    <FixedRowsTable
      columns={columns}
      rows={days}
      getRowKey={day => day._id}
      onRowClick={day => (day.my_rating_state === 'PENDING' ? onRate(day) : onView(day))}
      rowHeight={ROW_HEIGHT}
      pageSize={ROW_COUNT}
      emptyNotice={t('table.emptyTitle')}
    />
  );
}
