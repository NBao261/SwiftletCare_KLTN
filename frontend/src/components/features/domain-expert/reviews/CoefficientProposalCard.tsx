// CoefficientProposalCard.tsx: Thẻ đề xuất hệ số mờ Fuzzy của Farm Owner

import { useState } from 'react';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Badge, Button, type BadgeTone } from '@/components/ui';
import { formatDateTime } from '@/lib/i18n';
import { useAllZones } from '@/hooks/shared/useFarms';
import ProposalRejectModal from './ProposalRejectModal';
import type {
  CoefficientProposal,
  CoefficientProposalStatus,
} from '@/types/expert/reviews.types';
import { t, translated } from '@/i18n';

interface CoefficientProposalCardProps {
  proposal: CoefficientProposal;
  onApprove: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string, note: string) => Promise<boolean>;
  isProcessing?: boolean;
  // Farm Owner xem mục duyệt, đề xuất nhưng không duyệt (chỉ của Domain Expert)
  readOnly?: boolean;
}

const STATUS_TONE: Record<CoefficientProposalStatus, { label: string; tone: BadgeTone }> = {
  PROPOSED: { label: 'Chờ duyệt', tone: 'warning' },
  APPROVED: { label: 'Đã duyệt áp dụng', tone: 'positive' },
  REJECTED: { label: 'Đã từ chối', tone: 'critical' },
  SUPERSEDED: { label: 'Đã bị thay thế', tone: 'neutral' },
};

const FUZZY_LABELS: Record<string, string> = translated({
  fuzzy_humidity_band: 'Dải biên độ ẩm (%RH)',
  fuzzy_temp_band: 'Dải biên nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt hút khử ẩm (%)',
  fuzzy_window_sec: 'Chu kỳ điều khiển (giây)',
  fuzzy_input_filter: 'Lọc nhiễu cảm biến',
});

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
  if (typeof value === 'boolean') return value ? t('Bật') : t('Tắt');
  if (typeof value === 'number' && key) {
    if (key.includes('humidity') || key.includes('level')) return `${value}%`;
    if (key.includes('temp')) return `${value}°C`;
    if (key.includes('sec') || key.includes('window')) return `${value}s`;
  }
  return String(value);
}

// Thẻ đề xuất hệ số mờ của Farm Owner: tên và trạng thái, Zone · người gửi · giờ, từng hệ số hiện tại → đề xuất, dự báo tác động
export default function CoefficientProposalCard({
  proposal,
  onApprove,
  onReject,
  isProcessing = false,
  readOnly = false,
}: CoefficientProposalCardProps): JSX.Element {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const status = STATUS_TONE[proposal.status] || STATUS_TONE.PROPOSED;
  const isPending = proposal.status === 'PROPOSED';

  const { data: allZones } = useAllZones();
  const zoneInfo = allZones?.find(zone => zone._id === proposal.zone_id);

  const authorName =
    typeof proposal.submitted_by === 'object' && proposal.submitted_by?.full_name
      ? proposal.submitted_by.full_name
      : t('Chủ nhà yến');

  const deciderName =
    typeof proposal.decided_by === 'object' && proposal.decided_by?.full_name
      ? proposal.decided_by.full_name
      : t('Chuyên gia');

  const suggestedKeys = Object.keys(proposal.suggested_values || {});

  // Dự báo tác động: mỗi chỉ số một đoạn "tên now% → mới%", ghép thành một dòng
  const predicted = proposal.predicted;
  const predictedParts: string[] = [];
  if (predicted?.inRangeSuggested !== undefined) predictedParts.push(`${t('Thời gian đạt chuẩn')} ${predicted.inRangeNow ?? '—'}% → ${predicted.inRangeSuggested}%`);
  if (predicted?.mistingSuggested !== undefined) predictedParts.push(`${t('Tần suất phun sương')} ${predicted.mistingNow ?? '—'}% → ${predicted.mistingSuggested}%`);
  if (predicted?.in_range_pct !== undefined) predictedParts.push(`${t('Đạt chuẩn môi trường')} ${predicted.in_range_pct}%`);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-charcoal">{t('Đề xuất hệ số mờ')}</h4>
          <p className="mt-0.5 text-small text-warmGray">
            <span className="font-semibold text-charcoal">{zoneInfo ? `${zoneInfo.farmName} • ${zoneInfo.name}` : t('Zone không xác định')}</span> · {authorName} · {formatDateTime(proposal.created_at)}
          </p>
        </div>
        <Badge tone={status.tone}>{t(status.label)}</Badge>
      </div>

      {/* Từng hệ số: hiện tại gạch ngang, đề xuất đậm */}
      <ul className="divide-y divide-warmGray/10 rounded-xl bg-warmGray/5 px-3">
        {suggestedKeys.map(key => (
          <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate text-charcoal">{FUZZY_LABELS[key] || key}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="text-warmGray line-through">{formatFuzzyProposalValue(key, proposal.current_values?.[key])}</span>
              <ArrowRightIcon size={12} className="text-warmGray" />
              <span className="font-bold text-charcoal">{formatFuzzyProposalValue(key, proposal.suggested_values?.[key])}</span>
            </span>
          </li>
        ))}
      </ul>

      {predictedParts.length > 0 && (
        <p className="text-small text-graphite">
          <span className="font-semibold text-charcoal">{t('Hiệu quả dự báo mô phỏng')}:</span> {predictedParts.join(' · ')}
        </p>
      )}

      {/* Lý do từ chối hoặc người đã duyệt */}
      {proposal.status === 'REJECTED' && proposal.note && (
        <p className="rounded-xl bg-alertRed/10 px-3 py-2 text-small text-alertRed">
          <span className="font-semibold">{t('Lý do từ chối của chuyên gia ({{name}}):', { name: deciderName })}</span> {proposal.note}
        </p>
      )}
      {proposal.status === 'APPROVED' && proposal.decided_at && (
        <p className="rounded-xl bg-accent-50 px-3 py-2 text-small text-graphite">
          {t('Đã được duyệt áp dụng bởi')} <strong className="text-charcoal">{deciderName}</strong> · {formatDateTime(proposal.decided_at)}
        </p>
      )}

      {isPending && !readOnly && (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowRejectModal(true)} disabled={isProcessing}>
            {t('Từ chối đề xuất')}
          </Button>
          <Button type="button" size="sm" onClick={() => onApprove(proposal._id)} loading={isProcessing}>
            {t('Duyệt & Áp dụng')}
          </Button>
        </div>
      )}

      {/* Từ chối phải có lý do */}
      <ProposalRejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={async (note) => {
          const isSuccess = await onReject(proposal._id, note);
          if (isSuccess) setShowRejectModal(false);
        }}
        isSubmitting={isProcessing}
      />
    </div>
  );
}
