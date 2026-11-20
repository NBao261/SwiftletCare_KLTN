import { useCallback, useMemo } from 'react';
import SeverityBadge from '@/components/common/SeverityBadge';
import { STATUS_BADGE_CLASS } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { ActionsMenu, Badge, type ActionsMenuItem, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { alertsDict } from '@/constants/alerts.i18n';
import { NO_VALUE } from '@/constants/display';
import { isAlertFinished } from '@/constants/severity';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
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

// ALERT-FR-007 — bảng cảnh báo: mức, loại, vị trí, thiết bị, trạng thái, lúc tạo, menu thao tác
export default function AlertTable({ alerts, serverPagination, locationOf, canAcknowledge, onAction }: AlertTableProps): JSX.Element {
  const { t, dateTime } = useTranslation(alertsDict);
  // table-fixed: cột % cộng đủ phần còn lại sau Mức, Thao tác để không dư khoảng trống giữa các cột
  // Menu ⋯ của 1 dòng (bảng và thẻ điện thoại); bấm menu, kể cả mục trong portal, không mở chi tiết của dòng
  const rowMenu = useCallback((alert: Alert, alignClass: string) => {
    const items: ActionsMenuItem[] = [{ label: t('action.view'), onClick: () => onAction('view', alert) }];
    if (canAcknowledge && alert.status === 'ACTIVE') {
      items.push({ label: t('action.acknowledge'), onClick: () => onAction('acknowledge', alert) });
    }
    return (
      <div className={cn('flex items-center', alignClass)} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        <ActionsMenu items={items} />
      </div>
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
      className: 'w-[25%]',
      // Một dòng: loại cảnh báo; tiêu đề chi tiết xem trong ngăn chi tiết
      render: alert => <span title={alert.title} className="block truncate text-sm font-semibold text-charcoal">{t(`type.${alert.type}`)}</span>,
    },
    {
      key: 'location',
      header: t('col.location'),
      className: 'w-[17%]',
      render: alert => {
        const { location } = locationOf(alert);
        return <span title={location} className="block truncate whitespace-nowrap text-sm text-charcoal">{location}</span>;
      },
    },
    {
      key: 'device',
      header: t('col.device'),
      className: 'w-[13%]',
      render: alert => (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <span className="block truncate whitespace-nowrap text-sm font-semibold text-charcoal">{locationOf(alert).device ?? NO_VALUE}</span>
          <SimulatedBadge simulated={locationOf(alert).simulated} />
        </div>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      className: 'w-[11%] whitespace-nowrap',
      render: alert => <Badge className={STATUS_BADGE_CLASS[alert.status]}>{t(`status.${alert.status}`)}</Badge>,
    },
    {
      key: 'createdAt',
      header: t('col.createdAt'),
      className: 'w-[16%] whitespace-nowrap',
      render: alert => <span className="text-sm text-charcoal">{dateTime(alert.created_at)}</span>,
    },
    {
      key: 'actions',
      header: t('col.actions'),
      align: 'center',
      className: 'w-24 whitespace-nowrap',
      render: alert => rowMenu(alert, 'justify-center'),
    },
  ], [t, dateTime, locationOf, rowMenu]);

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
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={alert.severity} isMuted={isAlertFinished(alert.status)} />
              <Badge className={STATUS_BADGE_CLASS[alert.status]}>{t(`status.${alert.status}`)}</Badge>
            </div>
            <p className="text-body font-semibold text-charcoal">{t(`type.${alert.type}`)}</p>
            <p className="text-small text-warmGray">{locationOf(alert).location} · {dateTime(alert.created_at)}</p>
          </div>
          {rowMenu(alert, 'justify-end')}
        </div>
      )}
    />
  );
}
