import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui';
import { deviceWork, type DeviceOpenItems } from '@/components/features/farm-owner/devices/deviceWork';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import { devicesDict } from '@/constants/devices.i18n';
import { canAccessPath, DEVICE_SETUP_ROLES } from '@/constants/roles';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';

// Tối đa ngần này việc hiện trên thẻ; còn lại xem ở trang Cảnh báo và Phiếu công việc
const MAX_OPEN_ROWS = 3;
const ALERTS_PATH = '/alerts';
const WORK_ORDERS_PATH = '/work-orders';

interface OpenRow {
  key: string;
  kind: string;
  title: string;
  detail: string;
  // Role không vào được trang đích thì dòng chỉ là chữ, không có đường dẫn
  to?: string;
}

interface DeviceWorkPanelProps {
  device: DeviceItem;
  items: DeviceOpenItems;
}

// Trên thẻ thiết bị: một câu việc cần làm theo tình trạng, và các cảnh báo, Work Order còn mở của thiết bị đó
export default function DeviceWorkPanel({ device, items }: DeviceWorkPanelProps): JSX.Element | null {
  const { t, ago } = useTranslation(devicesDict);
  const navigate = useNavigate();
  const role = useAuthStore(state => state.user?.role);
  const canSetUp = usePermission(...DEVICE_SETUP_ROLES);
  const work = deviceWork(device);

  const alertTarget = canAccessPath(role, ALERTS_PATH);
  const workOrderTarget = canAccessPath(role, WORK_ORDERS_PATH);
  const rows: OpenRow[] = [
    ...items.alerts.map(alert => ({
      key: `alert-${alert._id}`,
      kind: t('open.kindAlert'),
      title: t(`alertType.${alert.type}`),
      detail: ago(alert.created_at),
      to: alertTarget ? `${ALERTS_PATH}?highlight=${alert._id}` : undefined,
    })),
    ...items.workOrders.map(workOrder => ({
      key: `work-order-${workOrder._id}`,
      kind: t('open.kindWorkOrder'),
      title: workOrder.title,
      detail: `${t(`workOrderStatus.${workOrder.status}`)} · ${workOrder.assignee?.full_name ?? t('open.unassigned')}`,
      to: workOrderTarget ? WORK_ORDERS_PATH : undefined,
    })),
  ];
  if (!work && rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {work && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm',
            work.tone === 'warn' ? 'border border-climateOrange/40 bg-climateOrange/[0.06] text-charcoal' : 'bg-warmGray/10 text-warmGray',
          )}
        >
          <p>{t(work.key, { time: ago(device.lastHeartbeat) })}</p>
          {work.canSetUpAgain && canSetUp && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/devices/onboarding')}>{t('work.setUpAgain')}</Button>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="label-caption text-graphite">{t('open.title')}</p>
          <ul className="flex flex-col gap-1.5">
            {rows.slice(0, MAX_OPEN_ROWS).map(row => (
              <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="text-warmGray">{row.kind}: </span>
                  {row.to
                    ? <Link to={row.to} className="font-semibold text-charcoal underline-offset-2 hover:underline">{row.title}</Link>
                    : <span className="font-semibold text-charcoal">{row.title}</span>}
                </span>
                <span className="text-small text-warmGray">{row.detail}</span>
              </li>
            ))}
          </ul>
          {rows.length > MAX_OPEN_ROWS && <p className="text-small text-warmGray">{t('open.more', { n: rows.length - MAX_OPEN_ROWS })}</p>}
        </div>
      )}
    </div>
  );
}
