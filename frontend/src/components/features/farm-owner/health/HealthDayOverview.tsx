import { useMemo, useState } from 'react';
import { CheckIcon, EyeIcon, MinusIcon, WarningIcon, type Icon } from '@phosphor-icons/react';

import HealthStatusBadge from '@/components/common/HealthStatusBadge';
import { formatHealthReason, isRatingDeadlineNear, lastRatingDay, shiftDate } from '@/components/common/healthDay.utils';
import { Badge, Button, type BadgeTone } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { HealthLevel, HealthSource, HealthStatus, HouseHealthDay } from '@/types';

const STATUSES: HealthStatus[] = ['GOOD', 'WATCH', 'ACTION', 'INSUFFICIENT_DATA'];
const SOURCES: HealthSource[] = ['environment', 'air', 'flock', 'noise'];
const LEVEL_TONE: Record<HealthLevel, BadgeTone> = { NORMAL: 'positive', SLIGHT: 'warning', CLEAR: 'critical' };

// Mỗi trạng thái có màu và biểu tượng riêng: không chỉ dựa vào màu
const CELL: Record<HealthStatus, { className: string; Glyph: Icon }> = {
  GOOD: { className: 'bg-accent-600 text-charcoal', Glyph: CheckIcon },
  WATCH: { className: 'bg-climateOrange/20 text-climateOrange', Glyph: EyeIcon },
  ACTION: { className: 'bg-alertRed text-white', Glyph: WarningIcon },
  INSUFFICIENT_DATA: { className: 'bg-warmGray/15 text-warmGray', Glyph: MinusIcon },
};

interface HealthDayOverviewProps {
  // Mọi ngày trong khoảng đang xem
  days: HouseHealthDay[];
  from: string;
  to: string;
  // Người xem có chấm ngày được không (chuyên gia chỉ xem)
  canRate: boolean;
  onRate: (day: HouseHealthDay) => void;
  onView: (day: HouseHealthDay) => void;
}

// Một khối cho cả trang: dải ô ngày (bấm để chọn), chú giải kèm số đếm, và chi tiết ngày đang chọn
export default function HealthDayOverview({ days, from, to, canRate, onRate, onView }: HealthDayOverviewProps): JSX.Element | null {
  const { t, num } = useTranslation(healthDict);
  const [pickedId, setPickedId] = useState('');

  const counts = useMemo(() => {
    const result: Record<HealthStatus, number> = { GOOD: 0, WATCH: 0, ACTION: 0, INSUFFICIENT_DATA: 0 };
    for (const day of days) result[day.current_status] += 1;
    return result;
  }, [days]);

  // Chưa đánh giá, hạn gần nhất đứng đầu
  const pending = useMemo(
    () => (canRate ? days.filter(day => day.my_rating_state === 'PENDING').sort((left, right) => left.rating_deadline.localeCompare(right.rating_deadline)) : []),
    [days, canRate],
  );

  // Các ngày từ đầu đến cuối khoảng, cũ bên trái mới bên phải
  const dates = useMemo(() => {
    const list: string[] = [];
    for (let cursor = from; cursor <= to; cursor = shiftDate(cursor, 1)) list.push(cursor);
    return list;
  }, [from, to]);

  // Mỗi nhà một dòng; thứ tự theo tên nhà
  const houses = useMemo(() => {
    const byHouse = new Map<string, { name: string; byDate: Map<string, HouseHealthDay> }>();
    for (const day of days) {
      const entry = byHouse.get(day.house_id) ?? { name: day.house_name, byDate: new Map<string, HouseHealthDay>() };
      entry.byDate.set(day.date, day);
      byHouse.set(day.house_id, entry);
    }
    return [...byHouse.entries()].sort((left, right) => left[1].name.localeCompare(right[1].name, 'vi'));
  }, [days]);

  if (days.length === 0) return null;

  // Ngày đang chọn: ngày người dùng bấm, chưa bấm (hoặc ngày đó rời khoảng) thì ngày gần nhất
  const latest = [...days].sort((left, right) => right.date.localeCompare(left.date))[0];
  const selected = days.find(day => day._id === pickedId) ?? latest;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-warmGray/15 p-5" aria-label={t('table.title')}>
      <div className="flex flex-col gap-4">
        {houses.map(([houseId, house]) => (
          <div key={houseId} className="flex flex-col gap-2">
            {houses.length > 1 && <p className="text-small font-semibold text-graphite">{house.name}</p>}
            <div className="flex flex-wrap gap-2">
              {dates.map(dateValue => (
                <DayCell key={dateValue} dateValue={dateValue} day={house.byDate.get(dateValue)} isSelected={house.byDate.get(dateValue)?._id === selected._id} onPick={day => setPickedId(day._id)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chú giải kèm số ngày: một dòng thay cho dải số liệu riêng */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-warmGray/15 pt-3">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-small text-warmGray">
          {STATUSES.map(status => {
            const { className, Glyph } = CELL[status];
            return (
              <li key={status} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('flex h-5 w-5 items-center justify-center rounded-md', className)}><Glyph size={12} weight="bold" /></span>
                {t(`status.${status}`)}
                <span className="font-semibold tabular-nums text-charcoal">{num(counts[status])}</span>
              </li>
            );
          })}
        </ul>
        {pending.length > 0 && (
          <div className="inline-flex flex-wrap items-center gap-2 text-small text-graphite">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-climateOrange" />
            {t('overview.pendingLine', { n: num(pending.length) })}
            <Button size="sm" variant="secondary" onClick={() => setPickedId(pending[0]._id)}>{t('overview.rateOldest')}</Button>
          </div>
        )}
      </div>

      <SelectedDay day={selected} canRate={canRate} onRate={onRate} onView={onView} />
    </section>
  );
}

// 1 ô ngày: thứ, ngày trong tháng và biểu tượng trạng thái; ngày chưa có trạng thái là ô nét đứt
function DayCell({ dateValue, day, isSelected, onPick }: { dateValue: string; day?: HouseHealthDay; isSelected: boolean; onPick: (day: HouseHealthDay) => void }): JSX.Element {
  const { t, lang, date } = useTranslation(healthDict);
  const weekday = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${dateValue}T00:00:00Z`));
  const body = (
    <>
      <span className="text-[10px] font-semibold leading-none opacity-80">{weekday}</span>
      <span className="text-base font-extrabold leading-none tabular-nums">{dateValue.slice(8)}</span>
    </>
  );

  if (!day) {
    return (
      <span
        title={`${date(dateValue)} · ${t('overview.noRecord')}`}
        className="flex h-14 w-12 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-warmGray/30 text-warmGray/70"
      >
        {body}
      </span>
    );
  }

  const { className, Glyph } = CELL[day.current_status];
  const isPending = day.my_rating_state === 'PENDING';
  const label = `${date(dateValue)} · ${t(`status.${day.current_status}`)}${isPending ? ` · ${t('ratingState.PENDING')}` : ''}`;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isSelected}
      onClick={() => onPick(day)}
      className={cn(
        'relative flex h-14 w-12 flex-col items-center justify-center gap-0.5 rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-charcoal',
        className,
        isSelected && 'ring-2 ring-charcoal ring-offset-2',
      )}
    >
      {body}
      <Glyph size={11} weight="bold" aria-hidden />
      {isPending && <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-climateOrange ring-2 ring-white" />}
    </button>
  );
}

// Ngày đang chọn: trạng thái, lý do bằng lời, 4 nguồn và nút hành động
function SelectedDay({ day, canRate, onRate, onView }: { day: HouseHealthDay; canRate: boolean; onRate: (day: HouseHealthDay) => void; onView: (day: HouseHealthDay) => void }): JSX.Element {
  const { t, date, dateTime, exact } = useTranslation(healthDict);
  const format = (value: number) => exact(value, 1);
  const isPending = canRate && day.my_rating_state === 'PENDING';

  return (
    <div className="grid grid-cols-1 gap-5 border-t border-warmGray/15 pt-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]" aria-live="polite">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-h3 text-charcoal">{date(day.date)}</h3>
          <HealthStatusBadge status={day.current_status} />
        </div>
        <p className="-mt-2 text-small text-warmGray">{t(`statusHint.${day.current_status}`)}</p>

        <ul className="flex flex-col gap-1 border-l-2 border-warmGray/30 pl-3 text-sm text-charcoal" aria-label={t('overview.why')}>
          {day.current_reasons.map((reason, index) => (
            <li key={`${reason.code}-${reason.source ?? ''}-${index}`}>{formatHealthReason(reason, t, format)}</li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          {canRate && day.my_rating_state && (
            <p className={cn('text-small', isPending && isRatingDeadlineNear(day.rating_deadline) ? 'font-semibold text-climateOrange' : 'text-warmGray')}>
              {t(`ratingState.${day.my_rating_state}`)}
              {isPending && ` · ${t('cell.deadline', { date: date(lastRatingDay(day.rating_deadline)) })}`}
            </p>
          )}
          <div>
            <Button size="sm" variant={isPending ? 'primary' : 'secondary'} onClick={() => (isPending ? onRate(day) : onView(day))}>
              {t(isPending ? 'overview.openRate' : 'action.view')}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {SOURCES.map(source => {
            const indicator = day.indicators?.[source];
            const value = indicator?.value;
            return (
              <div key={source} className="flex flex-col gap-1.5 rounded-xl bg-warmGray/[0.06] p-3">
                <span className="text-small font-semibold text-graphite">{t(`source.${source}`)}</span>
                <span className="text-2xl font-extrabold leading-tight text-charcoal tabular-nums">
                  {value === null || value === undefined ? NO_VALUE : t(`unit.${source}`, { value: format(value) })}
                </span>
                <Badge tone={indicator?.level ? LEVEL_TONE[indicator.level] : 'neutral'} className="self-start whitespace-nowrap">
                  {indicator?.level ? t(`level.${indicator.level}`) : t('level.notAssessed')}
                </Badge>
                <span className="text-small leading-snug text-warmGray">{t(`unitHint.${source}`)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-small text-warmGray">{t('detail.computedAt', { time: dateTime(day.computed_at) })} · {t('detail.disclaimer')}</p>
      </div>
    </div>
  );
}
