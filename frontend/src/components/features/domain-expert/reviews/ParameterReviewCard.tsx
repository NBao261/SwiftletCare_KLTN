// ParameterReviewCard.tsx: Thẻ duyệt thay đổi tham số của Farm Owner

import { useState } from 'react';
import {
  SlidersHorizontal,
  Thermometer,
  RotateCcw,
  CheckCircle,
  Clock,
  ArrowRight,
  User,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatDateTime } from '@/lib/i18n';
import type { ParameterReview, ParameterReviewGroup, ParameterReviewStatus } from '@/types/expert/reviews.types';
import { t, translated } from '@/i18n';
import { ringList } from '@/components/common/countingRing.utils';

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
  if (review.group === 'counting_ring') return `${houseName} • ${t('Camera đếm chim')}`;
  return houseName;
}

const STATUS_CONFIG: Record<
  ParameterReviewStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING_REVIEW: {
    label: 'Chờ duyệt',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  ACCEPTED: {
    label: 'Đã chấp thuận',
    bg: 'bg-accent-50',
    text: 'text-accent-900',
    border: 'border-accent-600/30',
  },
  REVERTED: {
    label: 'Đã hoàn nguyên',
    bg: 'bg-red-50',
    text: 'text-alertRed',
    border: 'border-red-200',
  },
  ADJUSTED: {
    label: 'Chuyên gia đã chỉnh',
    bg: 'bg-stone',
    text: 'text-graphite',
    border: 'border-warmGray/25',
  },
};

// Tên mục theo nhóm tham số (Zone, nhà hoặc camera)
const GROUP_TITLE: Record<ParameterReviewGroup, string> = translated({
  thresholds: 'Thay đổi ngưỡng vi khí hậu',
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
  fuzzy_fan_dry_level: 'Mức quạt hút khử ẩm (%)',
  fuzzy_window_sec: 'Chu kỳ điều khiển (giây)',
  fuzzy_input_filter: 'Lọc nhiễu cảm biến đầu vào',
  noise_margin_db: 'Biên độ ồn vượt nền (dB)',
  noise_min_sec: 'Thời gian ồn tối thiểu (giây)',
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
  ring: 'Vòng đếm',
  rings: 'Vòng đếm',
});

// Lấy danh sách các trường có thay đổi giữa old_values và new_values
export function getChangedParameterKeys(
  oldValues: Record<string, unknown> | undefined,
  newValues: Record<string, unknown> | undefined,
): string[] {
  return Object.keys(newValues || {}).filter(
    key => JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues?.[key]),
  );
}

// Định dạng giá trị hiển thị của tham số; lịch đếm, vòng đếm là cấu trúc lồng nhau nên chỉ tóm tắt
export function formatParamValue(value: unknown, key?: string): string {
  // Mục duyệt cũ ghi 1 vòng (ring), mục mới ghi danh sách (rings); không có vòng là vòng mặc định
  if (key === 'ring' || key === 'rings') {
    const rings = ringList(value);
    return rings.length > 0 ? t('{{n}} vòng', { n: rings.length }) : t('Vòng mặc định');
  }
  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') return value ? t('Bật') : t('Tắt');
  if (Array.isArray(value)) return t('{{n}} mục', { n: value.length });
  if (typeof value === 'object') return t('đã đổi');
  return String(value);
}

// Thẻ hiển thị một mục duyệt thay đổi tham số của Farm Owner
export default function ParameterReviewCard({
  review,
  onAccept,
  onRevert,
  isProcessing = false,
  readOnly = false,
  places,
}: ParameterReviewCardProps): JSX.Element {
  const [showConfirmRevert, setShowConfirmRevert] = useState(false);
  const statusConfig = STATUS_CONFIG[review.status] || STATUS_CONFIG.PENDING_REVIEW;
  const isPending = review.status === 'PENDING_REVIEW';
  const changedKeys = getChangedParameterKeys(review.old_values, review.new_values);

  const place = reviewPlace(review, places);

  const authorName =
    typeof review.changed_by === 'object' && review.changed_by?.full_name
      ? review.changed_by.full_name
      : t('Chủ nhà yến');

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card border border-warmGray/15 flex flex-col gap-4 transition-all hover:border-warmGray/30">
      {/* Top Bar: Group badge & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-warmGray/10 flex items-center justify-center text-charcoal">
            {review.group === 'thresholds' ? (
              <Thermometer className="w-4 h-4 text-accent-700" />
            ) : (
              <SlidersHorizontal className="w-4 h-4 text-accent-700" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-charcoal leading-tight">
              {GROUP_TITLE[review.group] ?? t('Thay đổi tham số')}
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-small text-warmGray mt-0.5">
              <span className="flex items-center gap-1 font-semibold text-charcoal">
                <MapPin className="w-3 h-3 text-accent-700" />
                {place}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {authorName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(review.updated_at || review.created_at)}
              </span>
            </div>
          </div>
        </div>

        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
        >
          {t(statusConfig.label)}
        </span>
      </div>

      {/* Diff Table: So sánh giá trị cũ vs mới */}
      <div className="rounded-xl border border-warmGray/10 bg-warmGray/5 p-3 overflow-hidden">
        <p className="text-small font-semibold text-warmGray mb-2">
          {t('Chi tiết tham số thay đổi ({{n}} chỉ số):', { n: changedKeys.length })}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {changedKeys.map(key => {
            const oldValue = review.old_values?.[key];
            const newValue = review.new_values?.[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-warmGray/15 text-xs shadow-sm"
              >
                <span className="text-charcoal font-medium truncate max-w-[140px]">
                  {FIELD_LABELS[key] || key}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-warmGray line-through">
                    {formatParamValue(oldValue, key)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-warmGray/50" />
                  <span className="text-accent-900 font-bold bg-accent-50 px-1.5 py-0.5 rounded border border-accent-600/30">
                    {formatParamValue(newValue, key)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nút hành động cho mục chờ duyệt */}
      {isPending && !readOnly && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-warmGray/10">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-warmGray hover:text-alertRed hover:bg-red-50 gap-1.5 font-medium"
            onClick={() => setShowConfirmRevert(true)}
            disabled={isProcessing}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('Hoàn nguyên giá trị cũ')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={isProcessing}
            onClick={() => onAccept(review._id)}
            className="gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5 text-limeMist" />
            {t('Chấp thuận thay đổi')}
          </Button>
        </div>
      )}

      {/* Modal xác nhận hoàn nguyên chuẩn ConfirmModal (FE_Design_Claude &a) */}
      <ConfirmModal
        open={showConfirmRevert}
        title={t('Xác nhận hoàn nguyên giá trị cũ')}
        description={t('Giá trị cũ được gửi lại xuống thiết bị và mục này chuyển sang Đã hoàn tác.')}
        confirmLabel={t('Hoàn nguyên')}
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
