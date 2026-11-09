import { useMemo } from 'react';

import HealthStatusBadge from '@/components/features/farm-owner/health/HealthStatusBadge';
import { isRatingDeadlineNear, lastRatingDay } from '@/components/features/farm-owner/health/healthDay.utils';
import { Button, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { HouseHealthDay } from '@/types';

// Khung bảng cố định 10 dòng (thiếu thì bù dòng trống, nhiều hơn thì phân trang) — cùng cách HarvestTable
const ROW_COUNT = 10;
const ROW_HEIGHT = 72;

interface HealthDayTableProps {
  days: HouseHealthDay[];
  // false = Domain Expert (SRS 4.2.0): không có cột "Đánh giá của bạn", mọi dòng chỉ Xem chi tiết
  canRate: boolean;
  // Ngày còn PENDING mở popup chấm, ngày khác mở chi tiết
  onRate: (day: HouseHealthDay) => void;
  onView: (day: HouseHealthDay) => void;
}

// Bảng các ngày: ngày chưa đánh giá không có trạng thái (BR-31), chỉ có nút Đánh giá
export default function HealthDayTable({ days, canRate, onRate, onView }: HealthDayTableProps): JSX.Element {
  const { t, date } = useTranslation(healthDict);

  // STT theo vị trí trong cả danh sách (không reset khi sang trang)
  const orderById = useMemo(() => new Map(days.map((day, index) => [day._id, index + 1])), [days]);

  const columns = useMemo(() => {
    const all: DataTableColumn<HouseHealthDay>[] = [
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
          // Không tô màu như cột Trạng thái (xanh/cam/đỏ là sức khỏe nhà): ngày cần chấm chữ đậm, ngày đã xong chữ xám;
          // chỉ dòng hạn đổi cam khi còn hôm nay hoặc ngày mai
          day.my_rating_state === 'PENDING' ? (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-charcoal">{t(`ratingState.${day.my_rating_state}`)}</span>
              <span className={cn('text-xs', isRatingDeadlineNear(day.rating_deadline) ? 'font-semibold text-climateOrange' : 'text-warmGray')}>
                {t('cell.deadline', { date: date(lastRatingDay(day.rating_deadline)) })}
              </span>
            </div>
          ) : (
            <span className="text-sm text-warmGray">{day.my_rating_state ? t(`ratingState.${day.my_rating_state}`) : NO_VALUE}</span>
          )
        ),
      },
      {
        key: 'actions',
        header: t('col.actions'),
        align: 'right',
        render: day => (day.my_rating_state === 'PENDING'
          ? <Button size="sm" variant="secondary" onClick={event => { event.stopPropagation(); onRate(day); }}>{t('action.rate')}</Button>
          : <Button size="sm" variant="secondary" onClick={event => { event.stopPropagation(); onView(day); }}>{t('action.view')}</Button>),
      },
    ];
    return canRate ? all : all.filter(column => column.key !== 'myRating');
  }, [t, date, canRate, onRate, onView, orderById]);

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
