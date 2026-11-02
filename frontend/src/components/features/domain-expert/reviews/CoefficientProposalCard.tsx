// CoefficientProposalCard.tsx — Thẻ đề xuất hệ số mờ Fuzzy của Farm Owner (EXPERT-FR-011)

import { useState } from 'react';
import {
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Sliders,
  User,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { formatDateTime } from '@/lib/i18n';
import { useAllZones } from '@/hooks/shared/useFarms';
import ProposalRejectModal from './ProposalRejectModal';
import type {
  CoefficientProposal,
  CoefficientProposalStatus,
} from '@/types/expert/reviews.types';

interface CoefficientProposalCardProps {
  proposal: CoefficientProposal;
  onApprove: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string, note: string) => Promise<boolean>;
  isProcessing?: boolean;
}

const STATUS_CONFIG: Record<
  CoefficientProposalStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  PROPOSED: {
    label: 'Chờ duyệt',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  APPROVED: {
    label: 'Đã duyệt áp dụng',
    bg: 'bg-accent-50',
    text: 'text-accent-900',
    border: 'border-accent-600/30',
  },
  REJECTED: {
    label: 'Đã từ chối',
    bg: 'bg-red-50',
    text: 'text-alertRed',
    border: 'border-red-200',
  },
  SUPERSEDED: {
    label: 'Đã bị thay thế',
    bg: 'bg-stone',
    text: 'text-graphite',
    border: 'border-warmGray/20',
  },
};

const FUZZY_LABELS: Record<string, string> = {
  fuzzy_humidity_band: 'Dải biên độ ẩm (%RH)',
  fuzzy_temp_band: 'Dải biên nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt hút khử ẩm (%)',
  fuzzy_window_sec: 'Chu kỳ điều khiển (giây)',
  fuzzy_input_filter: 'Lọc nhiễu cảm biến',
};

// Định dạng giá trị hệ số mờ hiển thị
export function formatFuzzyProposalValue(keyOrValue: unknown, optionalValue?: unknown): string {
  let key: string | undefined;
  let value: unknown;

  if (optionalValue !== undefined) {
    key = typeof keyOrValue === 'string' ? keyOrValue : undefined;
    value = optionalValue;
  } else {
    value = keyOrValue;
  }

  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') return value ? 'Bật' : 'Tắt';
  if (typeof value === 'number' && key) {
    if (key.includes('humidity') || key.includes('level')) return `${value}%`;
    if (key.includes('temp')) return `${value}°C`;
    if (key.includes('sec') || key.includes('window')) return `${value}s`;
  }
  return String(value);
}

// Thẻ hiển thị đề xuất hệ số mờ Fuzzy của Farm Owner gửi lên (EXPERT-FR-011)
export default function CoefficientProposalCard({
  proposal,
  onApprove,
  onReject,
  isProcessing = false,
}: CoefficientProposalCardProps): JSX.Element {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const statusConfig = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.PROPOSED;
  const isPending = proposal.status === 'PROPOSED';

  const { data: allZones } = useAllZones();
  const zoneInfo = allZones?.find(zone => zone._id === proposal.zone_id);

  const authorName =
    typeof proposal.submitted_by === 'object' && proposal.submitted_by?.full_name
      ? proposal.submitted_by.full_name
      : 'Chủ trang trại';

  const deciderName =
    typeof proposal.decided_by === 'object' && proposal.decided_by?.full_name
      ? proposal.decided_by.full_name
      : 'Chuyên gia';

  const suggestedKeys = Object.keys(proposal.suggested_values || {});

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card border border-warmGray/15 flex flex-col gap-4 transition-all hover:border-warmGray/30">
      {/* 1. Header Card: Badges & Created Time */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-warmGray/10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-50 text-accent-900 border border-accent-600/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Đề xuất hệ số Fuzzy</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
          >
            {statusConfig.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs text-warmGray">
          <div className="flex items-center gap-1 font-semibold text-charcoal">
            <MapPin className="w-3.5 h-3.5 text-accent-700" />
            <span>{zoneInfo ? `${zoneInfo.farmName} • ${zoneInfo.name}` : 'Khu vực không xác định'}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            <span>{authorName}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDateTime(proposal.created_at)}</span>
          </div>
        </div>
      </div>

      {/* 2. Body: So sánh các hệ số mờ giữa Hiện tại vs Đề xuất */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal">
          <Sliders className="w-3.5 h-3.5 text-accent-700" />
          <span>Thông số hệ số đề xuất tối ưu:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestedKeys.map((key) => {
            const currentVal = proposal.current_values?.[key];
            const suggestedVal = proposal.suggested_values?.[key];

            return (
              <div
                key={key}
                className="flex flex-col justify-between p-2.5 rounded-xl border border-warmGray/15 bg-warmGray/5 text-xs gap-1.5"
              >
                <span className="text-xs font-medium text-charcoal">
                  {FUZZY_LABELS[key] || key}
                </span>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-1 text-warmGray">
                    <span className="text-[10px] text-warmGray font-normal">Hiện tại:</span>
                    <span>{formatFuzzyProposalValue(key, currentVal)}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-warmGray/40" />
                  <div className="flex items-center gap-1 text-accent-900">
                    <span className="text-[10px] text-accent-700 font-normal">Đề xuất:</span>
                    <span className="font-bold">{formatFuzzyProposalValue(key, suggestedVal)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Hiển thị dự báo tác động nếu có */}
      {proposal.predicted && (
        <div className="rounded-xl border border-warmGray/10 bg-warmGray/5 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal">
            <TrendingUp className="w-4 h-4 text-accent-700" />
            <span>Hiệu quả dự báo mô phỏng</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {proposal.predicted.inRangeSuggested !== undefined && (
              <div className="flex flex-col bg-white p-2 rounded-lg border border-warmGray/15">
                <span className="text-[10px] text-warmGray">Thời gian đạt chuẩn</span>
                <span className="font-bold text-charcoal">
                  {proposal.predicted.inRangeNow ?? '—'}% →{' '}
                  <span className="text-accent-700 font-bold">{proposal.predicted.inRangeSuggested}%</span>
                </span>
              </div>
            )}
            {proposal.predicted.mistingSuggested !== undefined && (
              <div className="flex flex-col bg-white p-2 rounded-lg border border-warmGray/15">
                <span className="text-[10px] text-warmGray">Tần suất phun sương</span>
                <span className="font-bold text-charcoal">
                  {proposal.predicted.mistingNow ?? '—'}% →{' '}
                  <span className="text-accent-900 font-bold">{proposal.predicted.mistingSuggested}%</span>
                </span>
              </div>
            )}
            {proposal.predicted.in_range_pct !== undefined && (
              <div className="flex flex-col bg-white p-2 rounded-lg border border-warmGray/15">
                <span className="text-[10px] text-warmGray">Đạt chuẩn môi trường</span>
                <span className="font-bold text-accent-700">
                  {proposal.predicted.in_range_pct}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Ghi chú lý do từ chối (nếu status là REJECTED) */}
      {proposal.status === 'REJECTED' && proposal.note && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-alertRed shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-bold text-alertRed">
              Lý do từ chối từ chuyên gia ({deciderName}):
            </span>
            <p className="text-alertRed leading-relaxed italic">{proposal.note}</p>
          </div>
        </div>
      )}

      {/* 5. Thông tin chuyên gia đã duyệt (nếu APPROVED) */}
      {proposal.status === 'APPROVED' && proposal.decided_at && (
        <div className="rounded-xl border border-accent-600/30 bg-accent-50/60 p-2.5 flex items-center justify-between text-xs text-accent-900">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-accent-700" />
            <span>
              Đã được duyệt áp dụng bởi <strong>{deciderName}</strong>
            </span>
          </div>
          <span className="text-[11px] text-warmGray">
            {formatDateTime(proposal.decided_at)}
          </span>
        </div>
      )}

      {/* 6. Footer Actions: Chuyên gia duyệt hoặc từ chối */}
      {isPending && (
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-warmGray/10">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowRejectModal(true)}
            disabled={isProcessing}
            className="text-warmGray hover:text-alertRed hover:bg-red-50 border-warmGray/20 font-medium"
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            Từ chối đề xuất
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onApprove(proposal._id)}
            loading={isProcessing}
            className="font-semibold shadow-sm gap-1.5"
          >
            <CheckCircle className="w-4 h-4 text-limeMist" />
            Duyệt & Áp dụng
          </Button>
        </div>
      )}

      {/* Modal từ chối với lý do bắt buộc (Đóng sau khi hoàn thành) */}
      <ProposalRejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={async (note) => {
          const isSuccess = await onReject(proposal._id, note);
          if (isSuccess) {
            setShowRejectModal(false);
          }
        }}
        isSubmitting={isProcessing}
      />
    </div>
  );
}
