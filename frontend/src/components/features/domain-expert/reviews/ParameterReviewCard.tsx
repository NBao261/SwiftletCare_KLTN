// ParameterReviewCard.tsx: Thẻ duyệt thay đổi tham số của Farm Owner

import { useState } from 'react';
import { ArrowRightIcon, MinusCircleIcon, PencilSimpleIcon, PlusCircleIcon } from '@phosphor-icons/react';
import { Badge, Button, type BadgeTone } from '@/components/ui';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatDateTime } from '@/lib/i18n';
import type { ParameterReview, ParameterReviewGroup, ParameterReviewStatus } from '@/types/expert/reviews.types';
import { t, translated } from '@/i18n';
import { ringList } from '@/components/common/countingRing.utils';
import { describeStructuredChange, type ChangeLine } from '@/components/features/domain-expert/reviews/reviewChanges.utils';

interface ParameterReviewCardProps {
  review: ParameterReview;
  onAccept: (reviewId: string) => Promise<void>;
  onRevert: (reviewId: string) => Promise<void>;
  isProcessing?: boolean;
  // Farm Owner xem mục duyệt, đề xuất nhưng không duyệt (chỉ của Domain Expert)
  readOnly?: boolean;
  // Tên nơi thay đổi, trang dựng một lần cho mọi thẻ
  places: ReviewPlaces;
}

// Tên Zone (kèm nhà) và tên nhà theo id, dựng một lần ở trang
export interface ReviewPlaces {
  zoneNames: Map<string, string>;
  houseNames: Map<string, string>;
}

// Nơi của mục: Zone, nhà, hoặc nhà kèm camera; không tra được thì "Không xác định"
export function reviewPlace(review: Pick<ParameterReview, 'group' | 'zone_id' | 'house_id'>, places: ReviewPlaces): string {
  if (review.zone_id) return places.zoneNames.get(review.zone_id) ?? t('Không xác định');
  const houseName = review.house_id ? places.houseNames.get(review.house_id) : undefined;
  if (!houseName) return t('Không xác định');
  if (review.group === 'counting_ring') return `${houseName} · ${t('Camera đếm chim')}`;
  return houseName;
}

const STATUS_TONE: Record<ParameterReviewStatus, { label: string; tone: BadgeTone }> = {
  PENDING_REVIEW: { label: 'Chờ duyệt', tone: 'warning' },
  ACCEPTED: { label: 'Đã giữ', tone: 'positive' },
  REVERTED: { label: 'Đã hoàn tác', tone: 'critical' },
  ADJUSTED: { label: 'Chuyên gia đã chỉnh', tone: 'neutral' },
};

// Tên mục theo nhóm tham số (Zone, nhà hoặc camera)
const GROUP_TITLE: Record<ParameterReviewGroup, string> = translated({
  thresholds: 'Thay đổi ngưỡng môi trường',
  fuzzy: 'Thay đổi hệ số điều khiển mờ',
  detection: 'Thay đổi tham số phát hiện',
  return_rate_drop: 'Thay đổi mức giảm tỷ lệ chim về',
  health_levels: 'Thay đổi mức chỉ số sức khoẻ',
  counting_schedule: 'Thay đổi lịch đếm chim',
  counting_ring: 'Vẽ lại vòng đếm',
});

const FIELD_LABELS: Record<string, string> = translated({
  temp_min: 'Nhiệt độ tối thiểu (°C)',
  temp_max: 'Nhiệt độ tối đa (°C)',
  humidity_min: 'Độ ẩm tối thiểu (%)',
  humidity_max: 'Độ ẩm tối đa (%)',
  light_max: 'Ánh sáng tối đa (lux)',
  nh3_max: 'Khí NH3 tối đa (ppm)',
  co2_max: 'Khí CO2 tối đa (ppm)',
  fuzzy_humidity_band: 'Dải biên độ ẩm (%RH)',
  fuzzy_temp_band: 'Dải biên nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt khử ẩm (%)',
  fuzzy_window_sec: 'Chu kỳ điều khiển (giây)',
  fuzzy_input_filter: 'Lọc nhiễu số đo',
  noise_margin_db: 'Mức ồn vượt nền (dB)',
  noise_min_sec: 'Thời gian ồn kéo dài tối thiểu (giây)',
  pump_dry_on_sec: 'Thời gian bơm chạy không tăng ẩm (giây)',
  pump_dry_min_rise_pct: 'Độ ẩm cần tăng tối thiểu (%)',
  speaker_drop_pct: 'Độ sụt âm lượng báo hỏng loa (%)',
  return_rate_drop_pct: 'Mức giảm tỷ lệ chim về (%)',
  in_range_slight_pct: 'Môi trường lệch nhẹ',
  in_range_clear_pct: 'Môi trường lệch rõ',
  air_slight_h: 'Không khí lệch nhẹ',
  air_clear_h: 'Không khí lệch rõ',
  noise_slight: 'Tiếng ồn lệch nhẹ',
  noise_clear: 'Tiếng ồn lệch rõ',
  profiles: 'Hồ sơ theo mùa',
  temporary: 'Khung tạm',
  default_windows: 'Khung mặc định của nhà',
  ring: 'Vòng đếm',
  rings: 'Vòng đếm',
});

// Lấy danh sách các trường có thay đổi giữa old_values và new_values; trường bị bỏ (chỉ còn ở bản cũ) cũng là thay đổi
export function getChangedParameterKeys(
  oldValues: Record<string, unknown> | undefined,
  newValues: Record<string, unknown> | undefined,
): string[] {
  const keys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
  return [...keys].filter(key => JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues?.[key]));
}

// Khung sáng, chiều của lịch đếm; không có là khung hệ thống
function formatDayWindows(value: unknown): string {
  const windows = value as { morning?: { start?: string; end?: string }; evening?: { start?: string; end?: string } } | null | undefined;
  const { morning, evening } = windows ?? {};
  // Bản ghi cũ thiếu giờ thì coi như khung hệ thống, không hiện "undefined"
  if (!morning?.start || !morning.end || !evening?.start || !evening.end) return t('Khung hệ thống');
  return t('Sáng {{morning}}, chiều {{evening}}', {
    morning: `${morning.start}–${morning.end}`,
    evening: `${evening.start}–${evening.end}`,
  });
}

// Định dạng giá trị hiển thị của tham số; lịch đếm, vòng đếm là cấu trúc lồng nhau nên chỉ tóm tắt
export function formatParamValue(value: unknown, key?: string): string {
  // Mục duyệt cũ ghi 1 vòng (ring), mục mới ghi danh sách (rings); không có vòng là vòng mặc định
  if (key === 'ring' || key === 'rings') {
    const rings = ringList(value);
    return rings.length > 0 ? t('{{n}} vòng', { n: rings.length }) : t('Vòng mặc định');
  }
  if (key === 'default_windows') return formatDayWindows(value);
  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') return value ? t('Bật') : t('Tắt');
  if (Array.isArray(value)) return t('{{n}} mục', { n: value.length });
  if (typeof value === 'object') return t('đã đổi');
  return String(value);
}

const LINE_ICON: Record<ChangeLine['kind'], { Icon: typeof PlusCircleIcon; className: string }> = {
  added: { Icon: PlusCircleIcon, className: 'text-accent-700' },
  removed: { Icon: MinusCircleIcon, className: 'text-alertRed' },
  changed: { Icon: PencilSimpleIcon, className: 'text-warmGray' },
};

// Thẻ hiển thị một mục duyệt thay đổi tham số của Farm Owner: tên mục và trạng thái, nơi · người sửa · giờ, từng tham số cũ → mới
export default function ParameterReviewCard({
  review,
  onAccept,
  onRevert,
  isProcessing = false,
  readOnly = false,
  places,
}: ParameterReviewCardProps): JSX.Element {
  const [showConfirmRevert, setShowConfirmRevert] = useState(false);
  const status = STATUS_TONE[review.status] || STATUS_TONE.PENDING_REVIEW;
  const isPending = review.status === 'PENDING_REVIEW';
  const changedKeys = getChangedParameterKeys(review.old_values, review.new_values);

  const place = reviewPlace(review, places);

  const authorName =
    typeof review.changed_by === 'object' && review.changed_by?.full_name
      ? review.changed_by.full_name
      : t('Chủ nhà yến');

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-charcoal">{GROUP_TITLE[review.group] ?? t('Thay đổi tham số')}</h4>
          <p className="mt-0.5 text-small text-warmGray">
            <span className="font-semibold text-charcoal">{place}</span> · {authorName} · {formatDateTime(review.updated_at || review.created_at)}
          </p>
        </div>
        <Badge tone={status.tone}>{t(status.label)}</Badge>
      </div>

      {/* Từng tham số đã đổi: giá trị cũ gạch ngang, giá trị mới đậm; lịch đếm và vòng đếm ghi từng thay đổi cụ thể */}
      {changedKeys.length === 0 ? (
        <p className="rounded-xl bg-warmGray/5 px-3 py-2 text-small text-warmGray">{t('Đã quay về giá trị cũ, không còn gì để duyệt')}</p>
      ) : (
        <ul className="divide-y divide-warmGray/10 rounded-xl bg-warmGray/5 px-3">
          {changedKeys.flatMap(key => {
            const lines = describeStructuredChange(key, review.old_values?.[key], review.new_values?.[key]);
            if (lines && lines.length > 0) {
              return lines.map((line, index) => {
                const { Icon, className } = LINE_ICON[line.kind];
                return (
                  <li key={`${key}-${index}`} className="flex items-start gap-2 py-2 text-sm text-charcoal">
                    <Icon size={16} weight="bold" aria-hidden className={`mt-0.5 shrink-0 ${className}`} />
                    <span className="min-w-0">{line.text}</span>
                  </li>
                );
              });
            }
            return [(
              <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-charcoal">{FIELD_LABELS[key] || key}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-warmGray line-through">{formatParamValue(review.old_values?.[key], key)}</span>
                  <ArrowRightIcon size={12} className="text-warmGray" />
                  <span className="font-bold text-charcoal">{formatParamValue(review.new_values?.[key], key)}</span>
                </span>
              </li>
            )];
          })}
        </ul>
      )}

      {/* Việc cần làm với mục chờ duyệt */}
      {isPending && !readOnly && (
        <div className="flex items-center justify-end gap-2">
          {/* Không còn khác biệt thì hoàn tác không đổi gì: chỉ để Giữ thay đổi đóng mục */}
          {changedKeys.length > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowConfirmRevert(true)} disabled={isProcessing}>
              {t('Hoàn tác về giá trị cũ')}
            </Button>
          )}
          <Button type="button" size="sm" loading={isProcessing} onClick={() => onAccept(review._id)}>
            {t('Giữ thay đổi')}
          </Button>
        </div>
      )}

      <ConfirmModal
        open={showConfirmRevert}
        title={t('Hoàn tác về giá trị cũ?')}
        description={t('Bộ điều khiển nhận lại giá trị cũ và mục này chuyển sang Đã hoàn tác.')}
        confirmLabel={t('Hoàn tác')}
        danger
        loading={isProcessing}
        onCancel={() => setShowConfirmRevert(false)}
        onConfirm={async () => {
          await onRevert(review._id);
          setShowConfirmRevert(false);
        }}
      />
    </div>
  );
}
