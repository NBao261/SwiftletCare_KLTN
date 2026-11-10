import { useState, type ReactNode } from 'react';

import { CloudRainIcon, DropIcon, PencilSimpleIcon, PlusIcon, ThermometerIcon } from '@phosphor-icons/react';
import HealthStatusBadge from '@/components/features/farm-owner/health/HealthStatusBadge';
import { formatHealthReason } from '@/components/features/farm-owner/health/healthDay.utils';
import { Badge, Button, Textarea, type BadgeTone } from '@/components/ui';
import { Drawer } from '@/components/ui/Drawer';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useAddHealthRatingNote } from '@/hooks/shared/useHealthDays';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { HealthLevel, HealthSource, HouseHealthDay } from '@/types';

const SOURCES: HealthSource[] = ['environment', 'air', 'flock', 'noise'];
const NOTE_MAX_LENGTH = 1000;

// Màu mức chỉ số, cùng thang với badge trạng thái ngày
const LEVEL_TONE: Record<HealthLevel, BadgeTone> = { NORMAL: 'positive', SLIGHT: 'warning', CLEAR: 'critical' };

function WeatherItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center gap-1.5 text-xs text-warmGray">{icon}{label}</dt>
      <dd className="font-semibold text-charcoal">{value}</dd>
    </div>
  );
}

interface HealthDayDrawerProps {
  // Ngày đã chấm, bỏ qua hoặc hết hạn (có trạng thái); null = đóng
  day: HouseHealthDay | null;
  onClose: () => void;
  onChanged: (day: HouseHealthDay) => void;
}

// ANALYTICS-FR-012, 013 — trạng thái ngày, lý do, 4 chỉ số, thời tiết, điểm của người chấm
export default function HealthDayDrawer({ day, onClose, onChanged }: HealthDayDrawerProps): JSX.Element {
  const { t, date, dateTime, exact } = useTranslation(healthDict);
  const userId = useAuthStore(state => state.user?._id);
  const addNote = useAddHealthRatingNote();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [note, setNote] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  // Số đo tối đa 1 chữ số lẻ (FE_Design 6.1)
  const format = (value: number) => exact(value, 1);
  const myRating = day?.ratings?.find(rating => rating.by._id === userId);

  function close(): void {
    setNote('');
    setIsNoteOpen(false);
    onClose();
  }

  function handleSaveNote(): void {
    if (!day || !note.trim()) return;
    addNote.mutate(
      { dayId: day._id, note: note.trim() },
      {
        onSuccess: updated => {
          push(t('detail.noteSaved'));
          setNote('');
          setIsNoteOpen(false);
          onChanged(updated);
        },
        onError: error => push(apiErrorMessage(error), 'error'),
      },
    );
  }

  return (
    <Drawer open={Boolean(day)} onClose={close} title={day ? t('detail.title', { date: date(day.date), house: day.house_name }) : undefined}>
      {/* Drawer không tự cuộn (overflow-hidden) — vùng cuộn đặt ở đây như DeviceDetailDrawer */}
      {day?.current_status && (
        <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-2">
          {/* Trạng thái + lý do trong một thẻ viền, cùng kiểu ô chỉ số/thời tiết bên dưới */}
          <section className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-charcoal">{t('detail.status')}</p>
            <div className="flex flex-col gap-3 rounded-xl border border-warmGray/30 p-3">
              {/* Hàng đầu: giờ tính trái, huy hiệu phải; giữa: lý do có vạch trái; cuối: câu lưu ý */}
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-xs font-semibold text-graphite">{t('detail.computedAt', { time: dateTime(day.computed_at) })}</span>
                <HealthStatusBadge status={day.current_status} />
              </div>
              <ul className="flex flex-col gap-1 border-l-2 border-warmGray/30 pl-3 text-sm text-charcoal" aria-label={t('detail.reasons')}>
                {(day.current_reasons ?? []).map((reason, index) => (
                  <li key={`${reason.code}-${reason.source ?? ''}-${index}`}>{formatHealthReason(reason, t, format)}</li>
                ))}
              </ul>
              <p className="text-xs italic text-warmGray">{t('detail.disclaimer')}</p>
            </div>
          </section>

          {/* Bốn chỉ số: số lớn + mức có màu, mô tả đơn vị ở dòng nhỏ */}
          <section className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-charcoal">{t('detail.indicators')}</p>
            <div className="grid grid-cols-2 gap-3">
              {SOURCES.map(source => {
                const indicator = day.indicators?.[source];
                const value = indicator?.value;
                return (
                  <div key={source} className="flex flex-col gap-1.5 rounded-xl border border-warmGray/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-graphite">{t(`source.${source}`)}</span>
                      <Badge tone={indicator?.level ? LEVEL_TONE[indicator.level] : 'neutral'}>
                        {indicator?.level ? t(`level.${indicator.level}`) : t('level.notAssessed')}
                      </Badge>
                    </div>
                    <span className="text-xl font-semibold text-charcoal">
                      {value === null || value === undefined ? NO_VALUE : t(`unit.${source}`, { value: format(value) })}
                    </span>
                    <span className="text-xs leading-snug text-warmGray">{t(`unitHint.${source}`)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Thời tiết: một hàng 3 ô có icon */}
          <section className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-charcoal">{t('detail.weather')}</p>
            {day.weather ? (
              <dl className="grid grid-cols-3 gap-3 rounded-xl border border-warmGray/30 p-3 text-sm">
                <WeatherItem
                  icon={<ThermometerIcon size={16} />}
                  label={t('detail.temperature')}
                  value={day.weather.temperature_min === null || day.weather.temperature_max === null
                    ? NO_VALUE
                    : t('detail.temperatureRange', { min: format(day.weather.temperature_min), max: format(day.weather.temperature_max) })}
                />
                <WeatherItem
                  icon={<DropIcon size={16} />}
                  label={t('detail.humidity')}
                  value={day.weather.humidity_avg === null ? NO_VALUE : `${format(day.weather.humidity_avg)} %`}
                />
                <WeatherItem
                  icon={<CloudRainIcon size={16} />}
                  label={t('detail.rain')}
                  value={day.weather.precipitation_mm === null ? NO_VALUE : `${format(day.weather.precipitation_mm)} mm`}
                />
              </dl>
            ) : (
              <p className="text-sm text-warmGray">{t('detail.weatherNone')}</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-charcoal">{t('detail.ratings')}</p>
            {(day.ratings ?? []).length === 0 ? (
              <p className="text-sm text-warmGray">{t('detail.noRatings')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {(day.ratings ?? []).map(rating => (
                  <li key={rating._id} className="flex flex-col gap-2 rounded-xl border border-warmGray/30 p-3 text-sm">
                    {/* Hàng 1: tên (bạn) trái, · vai trò phải; hàng 2: "Chấm điểm: <mức>"; ghi chú có vạch trái; cuối sát phải: giờ chấm */}
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 font-semibold text-charcoal">
                        {rating.by.full_name ?? NO_VALUE}
                        {rating.by._id === userId && <span className="ml-1.5 font-normal text-warmGray">{t('detail.you')}</span>}
                      </p>
                      <span className="shrink-0 font-semibold text-charcoal">
                        <span className="font-normal text-warmGray">·</span> {t(`role.${rating.role}`)}
                      </span>
                    </div>
                    {/* "Chấm điểm:" + mức đã chấm bọc nền màu như huy hiệu trạng thái; bỏ qua thì nền xám */}
                    <div className="flex items-center gap-2">
                      <span className="text-warmGray">{t('detail.ratedAs')}</span>
                      {rating.outcome === 'RATED' && rating.rating
                        ? <HealthStatusBadge status={rating.rating} />
                        : <Badge tone="neutral">{t('detail.skipped')}</Badge>}
                    </div>
                    {rating.note
                      ? <p className="whitespace-pre-line border-l-2 border-warmGray/30 pl-3 text-charcoal">{rating.note}</p>
                      : <p className="border-l-2 border-warmGray/30 pl-3 italic text-warmGray">{t('detail.noNote')}</p>}
                    {/* Chỉ nhắc trạng thái lúc chấm khi ngày đã được tính lại khác đi (độ khớp NFR-14 so với trạng thái lúc chấm) */}
                    {rating.outcome === 'RATED' && rating.snapshot.status !== day.current_status && (
                      <span className="text-xs text-warmGray">{t('detail.snapshot', { status: t(`status.${rating.snapshot.status}`) })}</span>
                    )}
                    <span className="self-end text-xs text-warmGray">{dateTime(rating.at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* Ghi chú của người đã đánh giá (SM-18 RATED → RATED); Domain Expert không có (403 theo SRS 4.2.0) */}
            {myRating?.outcome === 'RATED' && Boolean(day?.my_rating_state) && (isNoteOpen ? (
              <div className="flex flex-col gap-3">
                <Textarea
                  label={t(myRating.note ? 'detail.editNote' : 'detail.addNote')}
                  value={note}
                  maxLength={NOTE_MAX_LENGTH}
                  onChange={event => setNote(event.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setIsNoteOpen(false)}>{t('action.cancel')}</Button>
                  <Button size="sm" onClick={handleSaveNote} loading={addNote.isPending} disabled={!note.trim()}>{t('detail.noteSave')}</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" className="self-start" onClick={() => {
                setNote(myRating.note ?? '');
                setIsNoteOpen(true);
              }}>
                {myRating.note
                  ? <PencilSimpleIcon size={16} weight="bold" aria-hidden />
                  : <PlusIcon size={16} weight="bold" aria-hidden />}
                {t(myRating.note ? 'detail.editNote' : 'detail.addNote')}
              </Button>
            ))}
          </section>
        </div>
      )}
    </Drawer>
  );
}
