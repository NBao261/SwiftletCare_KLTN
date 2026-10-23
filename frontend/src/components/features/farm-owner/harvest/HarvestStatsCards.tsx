import { useMemo, type ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon, CalendarCheckIcon, ChartBarIcon, ClockCounterClockwiseIcon, MinusIcon, type Icon } from '@phosphor-icons/react';

import { Card } from '@/components/ui';
import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import { KILOGRAM_DIGITS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { summarizeHarvestOverview, type HarvestGroup, type PeriodSummary } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { AllZone } from '@/hooks/shared/useFarms';
import { formatStandardDate } from '@/lib/i18n';
import { NO_VALUE } from '@/constants/display';

type ChangeDirection = 'up' | 'down' | 'flat';

// Mũi tên theo chiều thay đổi; màu luôn xám vì đây là số thống kê tĩnh (lime chỉ cho thiết bị bật/online, cam chỉ cho cảnh báo)
const CHANGE_ICON: Record<ChangeDirection, Icon> = {
  up: ArrowUpIcon,
  down: ArrowDownIcon,
  flat: MinusIcon,
};

// Chiều thay đổi suy ra từ dấu của giá trị so sánh thật
function changeDirection(change: number): ChangeDirection {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

// Huy hiệu so sánh xám cạnh số chính, bo tròn cùng cỡ badge chung, mũi tên xám đậm theo chiều tăng/giảm
function ChangeBadge({ change, children }: { change: number; children: ReactNode }): JSX.Element {
  const ChangeIcon = CHANGE_ICON[changeDirection(change)];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-warmGray/15 bg-warmGray/10 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
      <ChangeIcon size={10} weight="bold" className="text-charcoal" />
      {children}
    </span>
  );
}

interface HarvestStatsCardsProps {
  groups: HarvestGroup[];
  // Tên trang trại theo mã, tra theo Zone của đợt thu
  farmNames: Map<string, string>;
  // Nhà yến của từng Zone, để ghi nhà thu và đếm số nhà yến
  zones: AllZone[];
}

// Khung tổng quan (Card lg) 3 ô KPI chuẩn (KpiTile, FE_Design 1.1) theo tầng quản lý: đợt gần nhất · quý hiện tại · cả năm, tính từ lần thu thật
export default function HarvestStatsCards({ groups, farmNames, zones }: HarvestStatsCardsProps): JSX.Element {
  const { t, num } = useTranslation(harvestDict);
  const houseIdByZone = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone.house_id])), [zones]);
  const houseNameByZone = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone.houseName])), [zones]);
  const farmIdByZone = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone.farmId])), [zones]);
  const overview = summarizeHarvestOverview(groups, new Date(), houseIdByZone);
  const { latest, quarter, year } = overview;

  // Dấu + cho số dương để huy hiệu đọc rõ chiều tăng
  const signed = (value: number): string => `${value > 0 ? '+' : ''}${num(value, 1)}`;
  const periodSub = (summary: PeriodSummary): string =>
    t('stats.periodSub', { nests: num(summary.nests), houses: num(summary.houses), runs: num(summary.runs) });

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">{t('stats.title')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('stats.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile
          icon={ClockCounterClockwiseIcon}
          label={t('stats.latestTitle')}
          value={latest ? num(latest.kilograms, KILOGRAM_DIGITS) : NO_VALUE}
          unit="kg"
          sub={latest
            ? t('stats.latestSub', {
              farm: farmNames.get(farmIdByZone.get(latest.group.zone_id) ?? '') ?? NO_VALUE,
              house: houseNameByZone.get(latest.group.zone_id) ?? NO_VALUE,
              date: formatStandardDate(latest.group.harvest_date),
            })
            : t('stats.none')}
          badge={latest?.changePercent != null && (
            <ChangeBadge change={latest.changePercent}>{t('stats.vsPreviousRun', { change: signed(latest.changePercent) })}</ChangeBadge>
          )}
        />
        <KpiTile
          icon={ChartBarIcon}
          label={t('stats.quarterTitle', { quarter: quarter.quarter, year: quarter.year })}
          value={quarter.runs > 0 ? num(quarter.kilograms, KILOGRAM_DIGITS) : NO_VALUE}
          unit={quarter.runs > 0 ? 'kg' : undefined}
          sub={periodSub(quarter)}
          badge={quarter.changePercent !== null && (
            <ChangeBadge change={quarter.changePercent}>{t('stats.vsPreviousQuarter', { change: signed(quarter.changePercent) })}</ChangeBadge>
          )}
        />
        <KpiTile
          icon={CalendarCheckIcon}
          label={t('stats.yearTitle', { year: year.year })}
          value={year.runs > 0 ? num(year.kilograms, KILOGRAM_DIGITS) : NO_VALUE}
          unit={year.runs > 0 ? 'kg' : undefined}
          sub={periodSub(year)}
          badge={year.changePercent !== null && (
            <ChangeBadge change={year.changePercent}>{t('stats.vsPreviousYear', { change: signed(year.changePercent) })}</ChangeBadge>
          )}
        />
      </div>
    </Card>
  );
}
