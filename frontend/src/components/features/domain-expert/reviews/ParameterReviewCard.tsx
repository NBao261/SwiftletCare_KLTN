/**
 * ParameterReviewCard.tsx — Thẻ hiển thị một mục duyệt thay đổi tham số của Farm Owner (G-04)
 * SRS: EXPERT-FR-010, Report 3 §6.10
 * Design: Chuẩn Ops Console FE_Design_Claude.md §1.1 & §2.1
 */

import { useState } from 'react';
import {
  SlidersHorizontal,
  Thermometer,
  RotateCcw,
  CheckCircle,
  Clock,
  ArrowRight,
  User,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui';
import type { ParameterReview, ParameterReviewStatus } from '@/types/expert/reviews.types';

interface Props {
  review: ParameterReview;
  onAccept: (id: string) => Promise<void>;
  onRevert: (id: string) => Promise<void>;
  isProcessing?: boolean;
}

const STATUS_CONFIG: Record<
  ParameterReviewStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING_REVIEW: {
    label: 'Chờ duyệt',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
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
    text: 'text-red-700',
    border: 'border-red-200',
  },
  ADJUSTED: {
    label: 'Chuyên gia đã chỉnh',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
};

const FIELD_LABELS: Record<string, string> = {
  temp_min: 'Nhiệt độ tối thiểu (°C)',
  temp_max: 'Nhiệt độ tối đa (°C)',
  humidity_min: 'Độ ẩm tối thiểu (%)',
  humidity_max: 'Độ ẩm tối đa (%)',
  light_lux_max: 'Ánh sáng tối đa (lux)',
  nh3_ppm_max: 'Khí NH3 tối đa (ppm)',
  co2_ppm_max: 'Khí CO2 tối đa (ppm)',
  fuzzy_humidity_band: 'Dải biên độ ẩm (%RH)',
  fuzzy_temp_band: 'Dải biên nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt hút khử ẩm (%)',
  fuzzy_window_sec: 'Chu kỳ điều khiển (giây)',
  fuzzy_input_filter: 'Lọc nhiễu cảm biến đầu vào',
};

function formatParamValue(_key: string, val: unknown): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'Bật' : 'Tắt';
  return String(val);
}

export default function ParameterReviewCard({
  review,
  onAccept,
  onRevert,
  isProcessing = false,
}: Props) {
  const [showConfirmRevert, setShowConfirmRevert] = useState(false);
  const statusCfg = STATUS_CONFIG[review.status] || STATUS_CONFIG.PENDING_REVIEW;
  const isPending = review.status === 'PENDING_REVIEW';

  // Lấy danh sách các trường có sự thay đổi giữa old_values và new_values
  const changedKeys = Object.keys(review.new_values || {}).filter(
    (key) => JSON.stringify(review.old_values?.[key]) !== JSON.stringify(review.new_values?.[key])
  );

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
              <Thermometer className="w-4 h-4 text-emerald-600" />
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
            <div className="flex items-center gap-2 text-[11px] text-warmGray mt-0.5">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {authorName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(review.updated_at || review.created_at).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
        </div>

        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Diff Table: So sánh giá trị cũ vs mới */}
      <div className="rounded-xl border border-warmGray/10 bg-warmGray/5 p-3 overflow-hidden">
        <p className="text-[11px] font-semibold text-warmGray uppercase tracking-wider mb-2">
          Chi tiết tham số thay đổi ({changedKeys.length} chỉ số):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {changedKeys.map((key) => {
            const oldVal = review.old_values?.[key];
            const newVal = review.new_values?.[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-warmGray/15 text-xs shadow-2xs"
              >
                <span className="text-charcoal font-medium truncate max-w-[140px]">
                  {FIELD_LABELS[key] || key}
                </span>
                <div className="flex items-center gap-1.5 font-mono shrink-0">
                  <span className="text-warmGray line-through">
                    {formatParamValue(key, oldVal)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-warmGray/50" />
                  <span className="text-accent-900 font-bold bg-accent-50 px-1.5 py-0.5 rounded border border-accent-600/30">
                    {formatParamValue(key, newVal)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Box for Revert */}
      {showConfirmRevert && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800 space-y-2 animate-in fade-in duration-150">
          <p className="font-semibold flex items-center gap-1.5">
            <Info className="w-4 h-4 text-red-600" />
            Xác nhận hoàn nguyên về giá trị an toàn ban đầu?
          </p>
          <p className="text-[11px] text-red-700">
            Hệ thống sẽ gửi lệnh cập nhật giá trị cũ xuống bộ điều khiển tại nhà yến và đóng mục duyệt này với trạng thái HOÀN NGUYÊN (REVERTED).
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowConfirmRevert(false)}
              disabled={isProcessing}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
              loading={isProcessing}
              onClick={async () => {
                await onRevert(review._id);
                setShowConfirmRevert(false);
              }}
            >
              Xác nhận Hoàn nguyên
            </Button>
          </div>
        </div>
      )}

      {/* Actions (Only when PENDING_REVIEW and not confirming revert) */}
      {isPending && !showConfirmRevert && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-warmGray/10">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-warmGray hover:text-alertRed hover:bg-alertRed/10 gap-1.5 font-medium"
            onClick={() => setShowConfirmRevert(true)}
            disabled={isProcessing}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hoàn nguyên giá trị cũ
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-charcoal hover:bg-black text-[#B5D32C] font-semibold gap-1.5 shadow-sm"
            loading={isProcessing}
            onClick={() => onAccept(review._id)}
          >
            <CheckCircle className="w-3.5 h-3.5 text-[#B5D32C]" />
            Chấp thuận thay đổi
          </Button>
        </div>
      )}
    </div>
  );
}
