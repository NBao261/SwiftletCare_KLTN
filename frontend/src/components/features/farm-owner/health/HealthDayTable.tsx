import { useMemo } from 'react';

import HealthStatusBadge from '@/components/common/HealthStatusBadge';
import { HOVER_DARK_BUTTON, isRatingDeadlineNear, lastRatingDay } from '@/components/common/healthDay.utils';
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


  // Trạng thái ẩn tới khi đánh giá (BR-31): ghi một lần trên tiêu đề cột thay vì ở mỗi dòng (FO-07)
  const hasHiddenStatus = days.some(day => !day.current_status);

  const columns = useMemo(() => {
    const all: DataTableColumn<HouseHealthDay>[] = [
      // Ngày và nhà là khoá của dòng nên in đậm, như HarvestTable
      { key: 'date', header: t('col.date'), render: day => <span className="text-sm font-semibold text-charcoal">{date(day.date)}</span> },
      { key: 'house', header: t('col.house'), render: day => <span title={day.house_name} className="block truncate text-sm font-semibold text-charcoal">{day.house_name}</span> },
      {
        key: 'status',
        header: hasHiddenStatus ? t('col.statusHidden') : t('col.status'),
        render: day => (day.current_status ? <HealthStatusBadge status={day.current_status} /> : <span className="text-warmGray">{NO_VALUE}</span>),
      },
      {
        key: 'myRating',
        header: t('col.myRating'),
        render: day => (
          // Không tô màu (xanh/cam/đỏ dành cho trạng thái): ngày cần đánh giá chữ đậm, hạn sắp hết chữ cam
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
          ? <Button size="sm" variant="secondary" className={HOVER_DARK_BUTTON} onClick={event => { event.stopPropagation(); onRate(day); }}>{t('action.rate')}</Button>
          : <Button size="sm" variant="secondary" onClick={event => { event.stopPropagation(); onView(day); }}>{t('action.view')}</Button>),
      },
    ];
    return canRate ? all : all.filter(column => column.key !== 'myRating');
  }, [t, date, canRate, onRate, onView, hasHiddenStatus]);

  return (
    <FixedRowsTable
      columns={columns}
      rows={days}
      getRowKey={day => day._id}
      rowHeight={ROW_HEIGHT}
      pageSize={ROW_COUNT}
      emptyNotice={t('table.emptyTitle')}
      mobileCard={day => (
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-body font-semibold text-charcoal">{date(day.date)} · {day.house_name}</p>
              {canRate && day.my_rating_state && <p className="text-small text-warmGray">{t(`ratingState.${day.my_rating_state}`)}</p>}
            </div>
            {day.current_status ? <HealthStatusBadge status={day.current_status} /> : <span className="text-small text-warmGray">{t('cell.hidden')}</span>}
          </div>
          {day.my_rating_state === 'PENDING'
            ? <Button size="sm" className="w-full" onClick={() => onRate(day)}>{t('action.rate')}</Button>
            : <Button size="sm" variant="secondary" className="w-full" onClick={() => onView(day)}>{t('action.view')}</Button>}
        </div>
      )}
    />
  );
}
