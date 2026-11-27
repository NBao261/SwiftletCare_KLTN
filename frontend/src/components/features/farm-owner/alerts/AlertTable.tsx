import { useCallback, useMemo } from 'react';
import SeverityBadge from '@/components/common/SeverityBadge';
import { STATUS_BADGE_CLASS } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { Badge, Button, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { alertsDict } from '@/constants/alerts.i18n';
import { NO_VALUE } from '@/constants/display';
import { isAlertFinished } from '@/constants/severity';
import { useTranslation } from '@/hooks/common/useTranslation';
import { ALERT_PAGE_SIZE } from '@/hooks/shared/useAlerts';
import type { Alert } from '@/types';
import SimulatedBadge from '@/components/common/SimulatedBadge';

// Cùng chiều cao dòng bảng phiếu công việc
const ROW_HEIGHT = 72;

export type AlertAction = 'view' | 'acknowledge';

interface AlertTableProps {
  alerts: Alert[];
  serverPagination: { page: number; total: number; onChange: (page: number) => void };
  // Vị trí và thiết bị của từng cảnh báo, page dựng 1 lần
  locationOf: (alert: Alert) => { location: string; device: string | null; simulated?: boolean };
  canAcknowledge: boolean;
  onAction: (action: AlertAction, alert: Alert) => void;
}

// Bảng cảnh báo: mức, loại kèm nội dung, nơi xảy ra (vị trí và thiết bị chung một ô), trạng thái, thời gian, 1 nút hành động
export default function AlertTable({ alerts, serverPagination, locationOf, canAcknowledge, onAction }: AlertTableProps): JSX.Element {
  const { t, dateTime, ago } = useTranslation(alertsDict);

  // Cảnh báo chờ xác nhận có nút Xác nhận ngay trên dòng, các dòng khác có nút Xem; bấm cả dòng cũng mở chi tiết
  const actionButton = useCallback((alert: Alert, className?: string) => {
    const isAcknowledge = canAcknowledge && alert.status === 'ACTIVE';
    return (
      <Button
        size="sm"
        variant={isAcknowledge ? 'primary' : 'secondary'}
        className={className}
        onClick={event => {
          event.stopPropagation();
          onAction(isAcknowledge ? 'acknowledge' : 'view', alert);
        }}
      >
        {t(isAcknowledge ? 'action.acknowledge' : 'action.open')}
      </Button>
    );
  }, [t, canAcknowledge, onAction]);

  const columns = useMemo<DataTableColumn<Alert>[]>(() => [
    {
      key: 'level',
      header: t('col.level'),
      className: 'w-28',
      render: alert => <SeverityBadge severity={alert.severity} isMuted={isAlertFinished(alert.status)} />,
    },
    {
      key: 'alert',
      header: t('col.alert'),
      className: 'w-[32%]',
      // Dòng 1: loại cảnh báo; dòng 2: nội dung cụ thể khi khác tên loại
      render: alert => {
        const typeLabel = t(`type.${alert.type}`);
        return (
          <div className="min-w-0">
            <span title={typeLabel} className="block truncate text-sm font-semibold text-charcoal">{typeLabel}</span>
            {alert.title && alert.title !== typeLabel && <span title={alert.title} className="block truncate text-small text-warmGray">{alert.title}</span>}
          </div>
        );
      },
    },
    {
      key: 'place',
      header: t('col.place'),
      className: 'w-[22%]',
      render: alert => {
        const { location, device, simulated } = locationOf(alert);
        return (
          <div className="min-w-0">
            <span title={location} className="block truncate whitespace-nowrap text-sm font-semibold text-charcoal">{location}</span>
            <span className="flex min-w-0 items-center gap-1 text-small text-warmGray">
              <span className="truncate">{device ?? NO_VALUE}</span>
              <SimulatedBadge simulated={simulated} />
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: t('col.status'),
      className: 'w-[14%] whitespace-nowrap',
      render: alert => <Badge className={STATUS_BADGE_CLASS[alert.status]}>{t(`status.${alert.status}`)}</Badge>,
    },
    {
      key: 'createdAt',
      header: t('col.createdAt'),
      className: 'w-[14%] whitespace-nowrap',
      // Dòng 1: cách đây bao lâu; dòng 2: ngày giờ chính xác
      render: alert => (
        <div>
          <span className="block text-sm font-semibold text-charcoal">{ago(alert.created_at)}</span>
          <span className="block text-small text-warmGray">{dateTime(alert.created_at)}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-28 whitespace-nowrap',
      render: alert => <div className="flex justify-end">{actionButton(alert)}</div>,
    },
  ], [t, dateTime, ago, locationOf, actionButton]);

  return (
    <FixedRowsTable
      columns={columns}
      rows={alerts}
      getRowKey={alert => alert._id}
      onRowClick={alert => onAction('view', alert)}
      rowHeight={ROW_HEIGHT}
      pageSize={ALERT_PAGE_SIZE}
      emptyNotice={t('list.emptyTitle')}
      serverPagination={serverPagination}
      mobileCard={alert => (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={alert.severity} isMuted={isAlertFinished(alert.status)} />
              <Badge className={STATUS_BADGE_CLASS[alert.status]}>{t(`status.${alert.status}`)}</Badge>
            </div>
            <p className="text-body font-semibold text-charcoal">{t(`type.${alert.type}`)}</p>
            <p className="flex flex-wrap items-center gap-1.5 text-small text-warmGray">
              {locationOf(alert).location} · {ago(alert.created_at)}
              <SimulatedBadge simulated={locationOf(alert).simulated} />
            </p>
          </div>
          {actionButton(alert, 'w-full')}
        </div>
      )}
    />
  );
}
