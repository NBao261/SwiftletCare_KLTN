// DisagreementDayCard.tsx — Thẻ chi tiết 1 ngày có đánh giá thực địa lệch với hệ thống (EXPERT-FR-022, BR-28)

import {
  Calendar,
  SlidersHorizontal,
  UserCheck,
  ArrowLeftRight,
  MessageSquareText,
  Activity,
} from 'lucide-react';
import HealthStatusBadge from '@/components/common/HealthStatusBadge';
import { formatHealthReason } from '@/components/common/healthDay.utils';
import { Badge, type BadgeTone } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type {
  HealthDisagreementDay,
  HealthDisagreementItem,
} from '@/types/expert/disagreements.types';
import type {
  HealthLevel,
  HealthRatingValue,
  HealthSource,
} from '@/types/healthDay.types';

const SOURCES: HealthSource[] = ['environment', 'air', 'flock', 'noise'];

const LEVEL_TONE: Record<HealthLevel, BadgeTone> = {
  NORMAL: 'positive',
  SLIGHT: 'warning',
  CLEAR: 'critical',
};

const RATING_SEVERITY: Record<HealthRatingValue, number> = {
  GOOD: 0,
  WATCH: 1,
  ACTION: 2,
};

// Chiều lệch: STRICTER = người chấm nặng hơn ảnh chụp hệ thống, LENIENT = nhẹ hơn
export function getDisagreementDirection(
  rating: HealthRatingValue,
  snapshotStatus: HealthRatingValue,
): 'STRICTER' | 'LENIENT' {
  return RATING_SEVERITY[rating] > RATING_SEVERITY[snapshotStatus]
    ? 'STRICTER'
    : 'LENIENT';
}

interface DisagreementDayCardProps {
  day: HealthDisagreementDay;
  onEditLevels: (house: { id: string; name: string }) => void;
}

function DisagreementItemBlock({
  item,
  currentStatus,
}: {
  item: HealthDisagreementItem;
  currentStatus: HealthDisagreementDay['current_status'];
}) {
  const { t, dateTime, exact } = useTranslation(healthDict);
  const format = (value: number) => exact(value, 1);
  const direction = getDisagreementDirection(item.rating, item.snapshot_status);
  const hasSnapshotLevels = SOURCES.some(
    (source) => item.snapshot_levels?.[source] !== undefined,
  );

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-warmGray/20 bg-stone/30 p-3.5 sm:p-4">
      {/* Hàng 1: Thông tin người chấm thực địa + Thời điểm chấm */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warmGray/15 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-warmGray/20 bg-white text-charcoal">
            <UserCheck className="h-3.5 w-3.5 text-charcoal" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-charcoal">
              {item.assessor.full_name || t('dis.rater')}
            </span>
            <span className="text-warmGray">•</span>
            <span className="rounded-md border border-warmGray/15 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-graphite">
              {t(`role.${item.assessor.role}`)}
            </span>
          </div>
        </div>
        <span className="font-mono text-[11px] text-warmGray">
          {t('dis.ratedAt', { time: dateTime(item.at) })}
        </span>
      </div>

      {/* Hàng 2: Đối chiếu trực quan [Người chấm thực địa] vs [Ảnh chụp hệ thống lúc chấm] */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-stretch">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warmGray/20 bg-white p-3 md:col-span-7">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-warmGray">
              {t('dis.raterSide')}
            </span>
            <HealthStatusBadge status={item.rating} />
          </div>

          <div
            aria-hidden="true"
            className="flex flex-col items-center px-1 text-warmGray"
          >
            <ArrowLeftRight className="h-4 w-4 text-orange-700" />
            <span className="font-mono text-[10px] font-bold uppercase text-orange-900">
              {t('dis.compare')}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-warmGray">
              {t('dis.systemSide')}
            </span>
            <HealthStatusBadge status={item.snapshot_status} />
          </div>

          <div className="ml-auto">
            <span
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                direction === 'STRICTER'
                  ? 'border border-orange-200 bg-orange-50 text-orange-900'
                  : 'border border-accent-200 bg-accent-50 text-accent-900'
              }`}
            >
              {direction === 'STRICTER'
                ? t('dis.stricter')
                : t('dis.lenient')}
            </span>
          </div>
        </div>

        {/* Ghi chú quan sát tại hiện trường */}
        <div className="flex flex-col justify-center rounded-xl border border-warmGray/15 bg-white/90 p-3 md:col-span-5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-graphite">
            <MessageSquareText className="h-3.5 w-3.5 text-warmGray" />
            <span>{t('dis.note')}</span>
          </div>
          {item.note ? (
            <p className="mt-1 border-l-2 border-charcoal/30 pl-2.5 text-xs leading-relaxed text-charcoal">
              {item.note}
            </p>
          ) : (
            <p className="mt-1 pl-1 text-xs italic text-warmGray">
              {t('detail.noNote')}
            </p>
          )}
        </div>
      </div>

      {/* Hàng 3: Mức đánh giá từng nguồn trong ảnh chụp lúc chấm (snapshot_levels) + Lý do hệ thống lúc chấm (snapshot_reasons) */}
      {(hasSnapshotLevels || item.snapshot_reasons.length > 0) && (
        <div className="flex flex-col gap-2 rounded-lg border border-warmGray/15 bg-white/85 px-3 py-2.5">
          {hasSnapshotLevels && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <span className="text-[11px] font-semibold text-graphite">
                {t('dis.sourceLevels')}
              </span>
              {SOURCES.map((source) => {
                const level = item.snapshot_levels?.[source] ?? null;
                return (
                  <span
                    key={source}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warmGray/15 bg-stone/30 px-2 py-0.5 text-[11px]"
                  >
                    <span className="font-medium text-graphite">
                      {t(`source.${source}`)}:
                    </span>
                    <Badge tone={level ? LEVEL_TONE[level] : 'neutral'}>
                      {level ? t(`level.${level}`) : t('level.notAssessed')}
                    </Badge>
                  </span>
                );
              })}
            </div>
          )}

          {item.snapshot_reasons.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-graphite">
                  {t('dis.snapshotReasons')}
                </span>
                {currentStatus !== item.snapshot_status && (
                  <span className="text-[11px] italic text-warmGray">
                    {t('detail.snapshot', {
                      status: t(`status.${item.snapshot_status}`),
                    })}
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-1 border-l-2 border-orange-400/70 pl-2.5 text-xs text-charcoal">
                {item.snapshot_reasons.map((reason, index) => (
                  <li key={`${reason.code}-${reason.source ?? ''}-${index}`}>
                    {formatHealthReason(reason, t, format)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DisagreementDayCard({
  day,
  onEditLevels,
}: DisagreementDayCardProps) {
  const { t, date, exact } = useTranslation(healthDict);
  const format = (value: number) => exact(value, 1);

  return (
    <article
      aria-label={t('dis.dayLabel', { date: date(day.date), house: day.house_name })}
      className="relative z-10 flex w-full max-w-screen-xl flex-col gap-4 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card"
    >
      {/* Header của ngày lệch: Ngày + Nhà yến + Trạng thái hiện tại + Liên kết mức chỉ số cấp nhà */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warmGray/15 pb-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg bg-charcoal px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-white">
            <Calendar className="h-3.5 w-3.5 text-limeMist" aria-hidden="true" />
            <span>{date(day.date)}</span>
          </div>

          <span className="text-sm font-bold text-charcoal sm:text-base">
            {day.house_name}
          </span>

          <Badge tone="warning" className="font-mono tabular-nums">
            {t('dis.count', { n: day.disagreements.length })}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-warmGray">
            <span>{t('dis.currentStatus')}</span>
            <HealthStatusBadge status={day.current_status} />
          </div>

          <button
            type="button"
            onClick={() =>
              onEditLevels({ id: day.house_id, name: day.house_name })
            }
            aria-label={t('dis.houseLevelsLabel', { house: day.house_name })}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-graphite underline-offset-4 transition-colors hover:bg-stone/40 hover:text-charcoal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-warmGray" aria-hidden="true" />
            <span>{t('dis.houseLevels', { house: day.house_name })}</span>
          </button>
        </div>
      </div>

      {/* Danh sách các lượt chấm lệch trong ngày */}
      <div className="flex w-full flex-col gap-3">
        {day.disagreements.map((item, index) => (
          <DisagreementItemBlock
            key={`${day.day_id}-disagreement-${index}`}
            item={item}
            currentStatus={day.current_status}
          />
        ))}
      </div>

      {/* Bốn chỉ số thực đo của ngày (Môi trường, Không khí, Đàn chim, Tiếng ồn) */}
      <div className="flex w-full flex-col gap-2.5 pt-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-charcoal">
          <Activity className="h-3.5 w-3.5 text-graphite" />
          <span>{t('dis.indicators')}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {SOURCES.map((source) => {
            const indicator = day.indicators?.[source];
            const value = indicator?.value;
            return (
              <div
                key={source}
                className="flex flex-col justify-between gap-1.5 rounded-xl border border-warmGray/20 bg-stone/20 p-3"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold text-graphite">
                    {t(`source.${source}`)}
                  </span>
                  <Badge
                    tone={
                      indicator?.level
                        ? LEVEL_TONE[indicator.level]
                        : 'neutral'
                    }
                  >
                    {indicator?.level
                      ? t(`level.${indicator.level}`)
                      : t('level.notAssessed')}
                  </Badge>
                </div>
                <span className="font-mono text-base font-bold tabular-nums text-charcoal sm:text-lg">
                  {value === null || value === undefined
                    ? NO_VALUE
                    : t(`unit.${source}`, { value: format(value) })}
                </span>
                <span className="text-[11px] leading-snug text-warmGray">
                  {t(`unitHint.${source}`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lý do trạng thái hiện tại của hệ thống */}
      {day.current_reasons.length > 0 && (
        <div className="flex w-full flex-col gap-1 rounded-xl border border-warmGray/15 bg-stone/20 px-3.5 py-2.5 text-xs">
          <span className="font-semibold text-graphite">
            {t('dis.currentReasons')}
          </span>
          <ul className="flex flex-col gap-1 border-l-2 border-warmGray/30 pl-2.5 text-charcoal">
            {day.current_reasons.map((reason, index) => (
              <li key={`${reason.code}-${reason.source ?? ''}-${index}`}>
                {formatHealthReason(reason, t, format)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
