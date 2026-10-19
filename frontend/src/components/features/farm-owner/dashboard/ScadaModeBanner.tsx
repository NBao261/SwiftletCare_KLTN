import { useEffect, useState } from 'react';
import { WarningIcon } from '@phosphor-icons/react';

import { LIVE_MAX_AGE_MS } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { ControlMode } from '@/types';

type PlcState = 'live' | 'lost' | 'waiting';

// Màu chấm và chữ trạng thái PLC: online xanh, mất kết nối đỏ, chưa từng kết nối xám
const PLC_DOT_CLASS: Record<PlcState, string> = { live: 'bg-success', lost: 'bg-alertRed', waiting: 'bg-warmGray' };
const PLC_TEXT_CLASS: Record<PlcState, string> = { live: 'text-success', lost: 'text-alertRed', waiting: 'text-warmGray' };

interface ScadaModeBannerProps {
  lastSyncedAt?: string;
  controlMode?: ControlMode;
  overrideExpiry?: string;
  // Sự cố nổi bật nhất trong phạm vi đang chọn; không có thì bỏ phần cảnh báo
  issueText?: string;
}

// Capsule SCADA góc trên trái ảnh đầu trang: trạng thái PLC + sự cố nổi bật; chế độ và lần đồng bộ hiện khi rê chuột
export default function ScadaModeBanner({ lastSyncedAt, controlMode, overrideExpiry, issueText }: ScadaModeBannerProps): JSX.Element {
  const { t, ago, time } = useTranslation(dashboardDict);
  const [, setTick] = useState(0);

  // Đếm lại mỗi giây để trạng thái PLC tự chuyển "mất kết nối" khi quá hạn
  useEffect(() => {
    const timer = setInterval(() => setTick(tick => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  let plcState: PlcState = 'waiting';
  if (lastSyncedAt !== undefined) {
    plcState = Date.now() - new Date(lastSyncedAt).getTime() <= LIVE_MAX_AGE_MS ? 'live' : 'lost';
  }
  const plcLabel = { live: t('banner.plc.online'), lost: t('banner.plc.lost'), waiting: t('banner.plc.waiting') }[plcState];

  const modeLabel = controlMode ? t(`banner.mode.${controlMode}`) : '';
  const modeUntil = controlMode === 'MANUAL' && overrideExpiry ? ` · ${t('banner.modeUntil', { time: time(overrideExpiry) })}` : '';
  const syncedLabel = lastSyncedAt ? t('banner.synced', { ago: ago(lastSyncedAt) }) : t('banner.notSynced');
  const tooltip = modeLabel ? `${modeLabel}${modeUntil} · ${syncedLabel}` : syncedLabel;

  return (
    <div
      className="flex max-w-full items-center gap-3 self-start rounded-full border border-white/50 bg-white/85 px-4 py-2 text-xs shadow-sm backdrop-blur-md"
      title={tooltip}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', PLC_DOT_CLASS[plcState])} />
        <span className="shrink-0 whitespace-nowrap font-bold uppercase tracking-[0.06em] text-charcoal">{t('banner.title')}</span>
        <span className="shrink-0 text-warmGray" aria-hidden>•</span>
        <span className={cn('shrink-0 whitespace-nowrap font-semibold', PLC_TEXT_CLASS[plcState])}>{plcLabel}</span>
      </span>

      {issueText && (
        <>
          <span className="h-4 w-px shrink-0 bg-warmGray/30" aria-hidden />
          <span className="flex min-w-0 items-center gap-1.5 font-medium text-safetyOrange">
            <WarningIcon size={14} weight="bold" className="shrink-0" />
            <span className="truncate">{issueText}</span>
          </span>
        </>
      )}
    </div>
  );
}
