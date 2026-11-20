import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@phosphor-icons/react';

import SectionCard from '@/components/ui/SectionCard';
import type { FarmStructure } from '@/components/features/farm-owner/farms/farmStructure';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { alertTypeDict } from '@/constants/enumLabels.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { Alert, WorkOrder } from '@/types';

// Tối đa 5 dòng, phần còn lại ở trang Cảnh báo, Công việc, Sức khoẻ
const MAX_ROWS = 5;

interface DashboardTodoCardProps {
  // Cảnh báo chờ xác nhận trong phạm vi, mới nhất trước
  alerts: Alert[];
  // Phiếu chờ duyệt trong phạm vi
  approvals: WorkOrder[];
  // Số ngày chưa đánh giá trong 7 ngày qua
  daysToRate: number;
  structure: FarmStructure;
}

// Việc cần làm của chủ nhà yến ở Tổng quan (FO-01): mỗi dòng là một việc, bấm mở trang làm việc đó
export default function DashboardTodoCard({ alerts, approvals, daysToRate, structure }: DashboardTodoCardProps): JSX.Element {
  const { t, num } = useTranslation(dashboardDict);
  const { t: alertTypeLabel } = useTranslation(alertTypeDict);

  const rows = [
    ...alerts.map(alert => {
      const zone = alert.zone_id ? structure.zoneById.get(alert.zone_id) : undefined;
      const house = zone?.house ?? (alert.house_id ? structure.houseById.get(alert.house_id)?.house : undefined);
      const place = [house?.name, zone?.zone.name].filter(Boolean).join(' · ');
      return { key: alert._id, to: '/alerts', text: t('todo.alert', { type: alertTypeLabel(alert.type), place }) };
    }),
    ...approvals.map(order => ({ key: order._id, to: '/work-orders', text: t('todo.approve', { title: order.title }) })),
    ...(daysToRate > 0 ? [{ key: 'rate', to: '/health', text: t('todo.rate', { n: num(daysToRate) }) }] : []),
  ].slice(0, MAX_ROWS);

  return (
    <SectionCard
      title={t('todo.title')}
      action={<Link to="/alerts" className="text-body font-semibold text-graphite hover:text-charcoal">{t('todo.viewAlerts')}</Link>}
    >
      {rows.length === 0 ? (
        <p className="text-body text-warmGray">{t('todo.empty')}</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {rows.map(row => (
            <li key={row.key}>
              <Link to={row.to} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-2 text-base text-charcoal hover:bg-warmGray/5">
                <span className="min-w-0">{row.text}</span>
                <ArrowRightIcon size={16} className="shrink-0 text-warmGray" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
