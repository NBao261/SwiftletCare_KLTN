import type { ReactNode } from 'react';
import { ArrowRightIcon, HouseIcon } from '@phosphor-icons/react';

import HealthStatusBadge from '@/components/common/HealthStatusBadge';
import SimulatedBadge from '@/components/common/SimulatedBadge';
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants';
import { Badge, Button } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { farmOverviewDict } from '@/constants/farmOverview.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { HouseOverview } from '@/types';

type Tone = 'neutral' | 'green' | 'orange';

// Ô số: xanh = không còn gì mở, cam = còn việc mở, xám = số không có mốc tốt/xấu (tỷ lệ về, FE_Design 2.6.1)
const STAT_TONE: Record<Tone, { box: string; value: string }> = {
  neutral: { box: 'border-warmGray/10 bg-warmGray/5', value: 'text-charcoal' },
  green: { box: 'border-accent-200 bg-accent-50', value: 'text-accent-800' },
  orange: { box: 'border-orange-200 bg-orange-50', value: 'text-safetyOrange' },
};

// Khung thẻ và ô icon theo trạng thái hôm nay: Tốt viền xanh, Cần theo dõi viền cam, Cần xử lý khung cảnh báo (FE_Design 1.1)
const CARD_TONE: Record<'GOOD' | 'WATCH' | 'ACTION' | 'NONE', { card: string; icon: string }> = {
  GOOD: { card: 'border border-accent-300 bg-white', icon: 'border-accent-200 bg-accent-100 text-accent-700' },
  WATCH: { card: 'border border-orange-300 bg-white', icon: 'border-orange-200 bg-orange-100 text-orange-600' },
  ACTION: { card: 'border-2 border-orange-300 bg-orange-50', icon: 'border-orange-200 bg-orange-100 text-orange-600' },
  NONE: { card: 'border border-warmGray/15 bg-white', icon: 'border-warmGray/15 bg-warmGray/10 text-graphite' },
};

// Ô số nhỏ trong thẻ: nhãn, số lớn, dòng phụ
function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub: string; tone: Tone }): JSX.Element {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-xl border px-3 py-2.5', STAT_TONE[tone].box)}>
      <span className="label-caption truncate">{label}</span>
      <span className={cn('text-xl font-extrabold leading-none tabular-nums', STAT_TONE[tone].value)}>{value}</span>
      <span className="line-clamp-2 text-caption font-medium tracking-normal text-warmGray" title={sub}>{sub}</span>
    </div>
  );
}

interface HouseOverviewCardProps {
  house: HouseOverview;
  // Mở trang Phân tích đang lọc đúng nhà này
  onOpenAnalytics: (house: HouseOverview) => void;
}

// ANALYTICS-FR-015 — thẻ 1 nhà: giai đoạn, trạng thái hôm nay (hoặc lý do chưa có), cảnh báo và phiếu đang mở, tỷ lệ về gần nhất
export default function HouseOverviewCard({ house, onOpenAnalytics }: HouseOverviewCardProps): JSX.Element {
  const { t, num, date } = useTranslation(farmOverviewDict);
  const rate = house.latest_return_rate;
  const tone = CARD_TONE[house.status ?? 'NONE'];
  // Nhà tạo trước FARM-FR-014 chưa có stage: mặc định OCCUPIED (api-spec House.stage)
  const stage = house.stage ?? 'OCCUPIED';

  return (
    <article
      className={cn('flex flex-col gap-4 rounded-2xl p-5', tone.card)}
    >
      <header className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', tone.icon)}>
          <HouseIcon size={20} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Tên dài: 1 dòng, thừa thì "…", rê chuột xem đủ */}
          <h3 className="truncate text-h3 text-charcoal" title={house.name}>{house.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={stage === 'ATTRACTING' ? 'info' : 'neutral'}>{t(`stage.${stage}`)}</Badge>
            <SimulatedBadge simulated={house.simulated} />
          </div>
        </div>
        {/* Trạng thái hôm nay, hoặc lý do chưa có */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="label-caption">{t('card.status')}</span>
          {house.status ? (
            <HealthStatusBadge status={house.status} />
          ) : (
            <span className="whitespace-nowrap text-xs italic text-warmGray">{t(`reason.${house.status_reason ?? 'NOT_COMPUTED'}`)}</span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat
          label={t('card.openAlerts')}
          value={num(house.open_alerts)}
          sub={t('card.openSub')}
          tone={house.open_alerts > 0 ? 'orange' : 'green'}
        />
        <Stat
          label={t('card.openWorkOrders')}
          value={num(house.open_work_orders)}
          sub={t('card.openSub')}
          tone={house.open_work_orders > 0 ? 'orange' : 'green'}
        />
        <Stat
          label={t('card.returnRate')}
          value={rate ? `${num(rate.value, 1)}%` : NO_VALUE}
          sub={rate ? t('card.returnRateDate', { date: date(rate.date) }) : t('card.noReturnRate')}
          tone="neutral"
        />
      </div>

      {/* mt-auto: nút luôn ở đáy thẻ, các thẻ cùng hàng (cao bằng nhau trong lưới) có nút thẳng hàng */}
      <div className="mt-auto flex justify-end">
        <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => onOpenAnalytics(house)}>
          {t('card.openAnalytics')}
          <ArrowRightIcon size={14} weight="bold" aria-hidden />
        </Button>
      </div>
    </article>
  );
}
