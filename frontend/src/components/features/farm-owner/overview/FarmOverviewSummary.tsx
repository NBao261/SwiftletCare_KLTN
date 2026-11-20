import { HouseIcon, ClipboardTextIcon, WarningIcon, FirstAidKitIcon } from '@phosphor-icons/react';

import KpiTile from '@/components/common/KpiTile';
import { farmOverviewDict } from '@/constants/farmOverview.i18n';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { HouseOverview } from '@/types';

// Đếm từ tổng quan trại (không tính điểm): số nhà theo trạng thái và giai đoạn, cộng cảnh báo, phiếu đang mở
export function countHouses(houses: HouseOverview[]) {
  const counts = { attracting: 0, action: 0, watch: 0, alerts: 0, housesWithAlerts: 0, workOrders: 0 };
  for (const house of houses) {
    if (house.stage === 'ATTRACTING') counts.attracting += 1;
    if (house.status === 'ACTION') counts.action += 1;
    if (house.status === 'WATCH') counts.watch += 1;
    counts.alerts += house.open_alerts;
    if (house.open_alerts > 0) counts.housesWithAlerts += 1;
    counts.workOrders += house.open_work_orders;
  }
  return counts;
}

// ANALYTICS-FR-015 — 4 ô tóm tắt đầu tab Các nhà
export default function FarmOverviewSummary({ houses }: { houses: HouseOverview[] }): JSX.Element {
  const { t, num } = useTranslation(farmOverviewDict);
  const { t: healthT } = useTranslation(healthDict);
  const counts = countHouses(houses);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon={HouseIcon}
        label={t('summary.houses')}
        value={num(houses.length)}
        sub={t('summary.attracting', { n: num(counts.attracting) })}
        tone="green"
      />
      <KpiTile
        icon={FirstAidKitIcon}
        label={healthT('status.ACTION')}
        value={num(counts.action)}
        sub={t('summary.watch', { n: num(counts.watch), watch: healthT('status.WATCH') })}
        tone={counts.action > 0 ? 'orange' : 'green'}
      />
      <KpiTile
        icon={WarningIcon}
        label={t('card.openAlerts')}
        value={num(counts.alerts)}
        sub={t('summary.housesWithAlerts', { n: num(counts.housesWithAlerts) })}
        tone={counts.alerts > 0 ? 'orange' : 'green'}
      />
      <KpiTile
        icon={ClipboardTextIcon}
        label={t('card.openWorkOrders')}
        value={num(counts.workOrders)}
        sub={t('summary.allHouses')}
        tone={counts.workOrders > 0 ? 'orange' : 'green'}
      />
    </div>
  );
}
