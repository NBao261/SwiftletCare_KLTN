// ParameterReviewCard.tsx — Thẻ hiển thị một mục duyệt thay đổi tham số của Farm Owner (EXPERT-FR-010)
// SRS: EXPERT-FR-010; Report 3 §6.10
// Design: Chuẩn Ops Console FE_Design_Claude.md §13.5 (ConfirmModal) & §13.16a

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
import { useAllZones } from '@/hooks/shared/useFarms';
import type { ParameterReview, ParameterReviewStatus } from '@/types/expert/reviews.types';

interface ParameterReviewCardProps {
  review: ParameterReview;
  onAccept: (reviewId: string) => Promise<void>;
  onRevert: (reviewId: string) => Promise<void>;
  isProcessing?: boolean;
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

const FIELD_LABELS: Record<string, string> = {
  temp_min: 'Nhiệt độ tối thiểu (°C)',
  temp_max: 'Nhiệt độ tối đa (°C)',
  humidity_min: 'Độ ẩm tối thiểu (%)',
  humidity_max: 'Độ ẩm tối đa (%)',
  light_max: 'Ánh sáng tối đa (lux)',
  nh3_max: 'Khí NH3 tối đa (ppm)',
  co2_max: 'Khí CO2 tối đa (ppm)',
  // Khóa alias dự phòng
  light_lux_max: 'Ánh sáng tối đa (lux)',
  nh3_ppm_max: 'Khí NH3 tối đa (ppm)',
  co2_ppm_max: 'Khí CO2 tối đa (ppm)',
  fuzzy_humidity_band: 'Dải biên độ ẩm (%RH)',
  fuzzy_temp_band: 'Dải biên nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt hút khử ẩm (%)',
  fuzzy_window_sec: 'Chu kỳ điều khiển (giây)',
  fuzzy_input_filter: 'Lọc nhiễu cảm biến đầu vào',
};

// Lấy danh sách các trường có thay đổi giữa old_values và new_values
export function getChangedParameterKeys(
  oldValues: Record<string, unknown> | undefined,
  newValues: Record<string, unknown> | undefined,
): string[] {
  return Object.keys(newValues || {}).filter(
    key => JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues?.[key]),
  );
}

// Định dạng giá trị hiển thị của tham số
export function formatParamValue(value: unknown, _key?: string): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') return value ? 'Bật' : 'Tắt';
  return String(value);
}

// Thẻ hiển thị một mục duyệt thay đổi tham số của Farm Owner (EXPERT-FR-010)
export default function ParameterReviewCard({
  review,
  onAccept,
  onRevert,
  isProcessing = false,
}: ParameterReviewCardProps): JSX.Element {
  const [showConfirmRevert, setShowConfirmRevert] = useState(false);
  const statusConfig = STATUS_CONFIG[review.status] || STATUS_CONFIG.PENDING_REVIEW;
  const isPending = review.status === 'PENDING_REVIEW';
  const changedKeys = getChangedParameterKeys(review.old_values, review.new_values);

  const { data: allZones } = useAllZones();
  const zoneInfo = allZones?.find(zone => zone._id === review.zone_id);

  const authorName =
    typeof review.changed_by === 'object' && review.changed_by?.full_name
      ? review.changed_by.full_name
      : 'Chủ trang trại';

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
              {review.group === 'thresholds'
                ? 'Thay đổi Ngưỡng vi khí hậu'
                : 'Thay đổi Hệ số điều khiển mờ (Fuzzy)'}
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-warmGray mt-0.5">
              <span className="flex items-center gap-1 font-semibold text-charcoal">
                <MapPin className="w-3 h-3 text-accent-700" />
                {zoneInfo ? `${zoneInfo.farmName} • ${zoneInfo.name}` : review.zone_id}
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
          {statusConfig.label}
        </span>
      </div>

      {/* Diff Table: So sánh giá trị cũ vs mới */}
      <div className="rounded-xl border border-warmGray/10 bg-warmGray/5 p-3 overflow-hidden">
        <p className="text-[11px] font-semibold text-warmGray uppercase tracking-wider mb-2">
          Chi tiết tham số thay đổi ({changedKeys.length} chỉ số):
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
                <div className="flex items-center gap-1.5 font-mono shrink-0">
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
      {isPending && (
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
            Hoàn nguyên giá trị cũ
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
            Chấp thuận thay đổi
          </Button>
        </div>
      )}

      {/* Modal xác nhận hoàn nguyên chuẩn ConfirmModal (FE_Design_Claude §13.5 & §13.16a) */}
      <ConfirmModal
        open={showConfirmRevert}
        title="Xác nhận hoàn nguyên giá trị cũ"
        description="Hệ thống sẽ gửi lệnh cập nhật giá trị an toàn ban đầu xuống thiết bị và chuyển trạng thái mục duyệt sang Đã hoàn nguyên."
        confirmLabel="Hoàn nguyên"
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
