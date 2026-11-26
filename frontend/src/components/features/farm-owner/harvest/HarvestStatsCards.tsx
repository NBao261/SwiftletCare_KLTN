import { useMemo } from 'react';

import StatStrip, { type StatItem } from '@/components/common/StatStrip';
import { KILOGRAM_DIGITS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { summarizeHarvestOverview, type HarvestGroup, type PeriodSummary } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { AllZone } from '@/hooks/shared/useFarms';
import { formatStandardDate } from '@/lib/i18n';
import { NO_VALUE } from '@/constants/display';

interface HarvestStatsCardsProps {
  groups: HarvestGroup[];
  // Tên trang trại theo mã, tra theo Zone của đợt thu
  farmNames: Map<string, string>;
  // Nhà yến của từng Zone, để ghi nhà thu và đếm số nhà yến
  zones: AllZone[];
}

// Dải 3 số: đợt gần nhất · quý hiện tại · cả năm, tính từ lần thu đã xác nhận
export default function HarvestStatsCards({ groups, farmNames, zones }: HarvestStatsCardsProps): JSX.Element {
  const { t, num } = useTranslation(harvestDict);
  const houseIdByZone = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone.house_id])), [zones]);
  const houseNameByZone = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone.houseName])), [zones]);
  const farmIdByZone = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone.farmId])), [zones]);
  const overview = summarizeHarvestOverview(groups, new Date(), houseIdByZone);
  const { latest, quarter, year } = overview;

  const signed = (value: number): string => `${value > 0 ? '+' : ''}${num(value, 1)}`;
  const periodSub = (summary: PeriodSummary): string =>
    t('stats.periodSub', { nests: num(summary.nests), houses: num(summary.houses), runs: num(summary.runs) });

  // Dấu + cho số dương để đọc rõ chiều tăng
  const change = (value: number | null | undefined, key: 'stats.vsPreviousRun' | 'stats.vsPreviousQuarter' | 'stats.vsPreviousYear'): string | undefined =>
    (value === null || value === undefined ? undefined : t(key, { change: signed(value) }));

  const items: StatItem[] = [
    {
      label: t('stats.latestTitle'),
      value: latest ? num(latest.kilograms, KILOGRAM_DIGITS) : NO_VALUE,
      unit: latest ? 'kg' : undefined,
      sub: latest
        ? t('stats.latestSub', {
          farm: farmNames.get(farmIdByZone.get(latest.group.zone_id) ?? '') ?? NO_VALUE,
          house: houseNameByZone.get(latest.group.zone_id) ?? NO_VALUE,
          date: formatStandardDate(latest.group.harvest_date),
        })
        : t('stats.none'),
      note: change(latest?.changePercent, 'stats.vsPreviousRun'),
    },
    {
      label: t('stats.quarterTitle', { quarter: quarter.quarter, year: quarter.year }),
      value: quarter.runs > 0 ? num(quarter.kilograms, KILOGRAM_DIGITS) : NO_VALUE,
      unit: quarter.runs > 0 ? 'kg' : undefined,
      sub: periodSub(quarter),
      note: change(quarter.changePercent, 'stats.vsPreviousQuarter'),
    },
    {
      label: t('stats.yearTitle', { year: year.year }),
      value: year.runs > 0 ? num(year.kilograms, KILOGRAM_DIGITS) : NO_VALUE,
      unit: year.runs > 0 ? 'kg' : undefined,
      sub: periodSub(year),
      note: change(year.changePercent, 'stats.vsPreviousYear'),
    },
  ];

  return <StatStrip items={items} />;
}
