// AlertsKpiAndStatsBar: Interactive KPI filter cards
import { cn } from '@/lib/cn';
import type { InferredAlertType } from '@/types/expert.types';
import type { AlertSeverity } from '@/types';
import type { AlertTabFilter } from '@/hooks/domain-expert/useExpertAlerts';
import { t } from '@/i18n';

export interface KpiCounts {
  total: number;
  pending: number;
  confirmed: number;
  rejected: number;
}

interface KpiCardProps {
  label: string;
  sublabel: string;
  value: string | number;
  accent: string;
  dotColor: string;
  badgeBg?: string;
  isActive: boolean;
  onClick: () => void;
}

function KpiCard({ label, sublabel, value, accent, dotColor, badgeBg, isActive, onClick }: KpiCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 text-left w-full transition-all duration-200 cursor-pointer shadow-card',
        isActive
          ? 'border-charcoal ring-1 ring-charcoal bg-white'
          : 'border border-warmGray/15 bg-white hover:border-warmGray/30',
      )}
    >
      <div className="flex items-start justify-between gap-2 w-full">
        <span className="text-xs font-medium text-warmGray leading-tight">{t(label)}</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', badgeBg ?? 'bg-neutral-100')}>
          <span className={cn('h-2.5 w-2.5 rounded-full', dotColor)} />
        </span>
      </div>
      <div>
        <div className={cn('text-3xl font-extrabold leading-none tabular-nums', accent)}>{value}</div>
        <p className="mt-1.5 text-small text-warmGray leading-tight">{t(sublabel)}</p>
      </div>
    </button>
  );
}

export const TYPE_OPTS: Array<{ value: InferredAlertType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Loại cảnh báo' },
  { value: 'NOISE_ANOMALY', label: 'Tiếng ồn bất thường' },
  { value: 'SENSOR_ANOMALY', label: 'Cảm biến bất thường' },
  { value: 'FORECAST_BREACH', label: 'Sắp vượt ngưỡng' },
  { value: 'LOW_RETURN_RATE', label: 'Giảm tỷ lệ chim về' },
];

// Cảnh báo suy luận chỉ ở mức MEDIUM/LOW, tức cấp P3 Trung bình và P4 Thấp của FE_Design 2.4
export const INFERRED_SEVERITIES: AlertSeverity[] = ['MEDIUM', 'LOW'];

export const TAB_INFO: Record<AlertTabFilter, { label: string; countKey: keyof KpiCounts }> = {
  ALL: { label: 'Tất cả', countKey: 'total' },
  PENDING: { label: 'Chờ kiểm chứng', countKey: 'pending' },
  CONFIRMED: { label: 'Đã xác nhận', countKey: 'confirmed' },
  REJECTED: { label: 'Đã bác bỏ', countKey: 'rejected' },
};

interface Props {
  counts: KpiCounts;
  isLoading: boolean;
  activeTab: AlertTabFilter;
  onTabChange: (tab: AlertTabFilter) => void;
}

export default function AlertsKpiAndStatsBar({
  counts,
  isLoading,
  activeTab,
  onTabChange,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-2xl p-5 shadow-card border border-warmGray/15 animate-pulse">
            <div className="h-3 bg-warmGray/15 rounded w-2/3 mb-3" />
            <div className="h-8 bg-warmGray/15 rounded w-1/3 mb-2" />
            <div className="h-3 bg-warmGray/15 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label={t('Tổng cảnh báo suy luận')}
        sublabel="30 ngày qua"
        value={counts.total}
        accent="text-charcoal"
        dotColor="bg-[#B5D32C]"
        badgeBg="bg-[#B5D32C]/15"
        isActive={activeTab === 'ALL'}
        onClick={() => onTabChange('ALL')}
      />
      <KpiCard
        label={t('Chờ kiểm chứng')}
        sublabel="Chờ chuyên gia kiểm chứng"
        value={counts.pending}
        accent="text-orange-500"
        dotColor="bg-orange-500"
        badgeBg="bg-orange-500/15"
        isActive={activeTab === 'PENDING'}
        onClick={() => onTabChange('PENDING')}
      />
      <KpiCard
        label={t('Đã xác nhận (Sự cố thật)')}
        sublabel="Hệ thống suy luận chính xác"
        value={counts.confirmed}
        accent="text-charcoal"
        dotColor="bg-emerald-500"
        badgeBg="bg-emerald-50"
        isActive={activeTab === 'CONFIRMED'}
        onClick={() => onTabChange('CONFIRMED')}
      />
      <KpiCard
        label={t('Đã bác bỏ (Báo động giả)')}
        sublabel="Nhiễu hoặc dao động tự nhiên"
        value={counts.rejected}
        accent="text-warmGray"
        dotColor="bg-neutral-400"
        badgeBg="bg-neutral-100"
        isActive={activeTab === 'REJECTED'}
        onClick={() => onTabChange('REJECTED')}
      />
    </div>
  );
}
