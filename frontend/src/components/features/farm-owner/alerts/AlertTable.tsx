import { useMemo } from 'react';
import SeverityBadge from '@/components/common/SeverityBadge';
import { STATUS_BADGE_CLASS } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { ActionsMenu, Badge, type ActionsMenuItem, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { alertsDict } from '@/constants/alerts.i18n';
import { NO_VALUE } from '@/constants/display';
import { isAlertFinished } from '@/constants/severity';
import { useTranslation } from '@/hooks/common/useTranslation';
import { ALERT_PAGE_SIZE } from '@/hooks/shared/useAlerts';
import type { Alert } from '@/types';

// Cùng chiều cao dòng bảng phiếu công việc
const ROW_HEIGHT = 72;

export type AlertAction = 'view' | 'acknowledge';

interface AlertTableProps {
  alerts: Alert[];
  serverPagination: { page: number; total: number; onChange: (page: number) => void };
  // Vị trí và thiết bị của từng cảnh báo, page dựng 1 lần
  locationOf: (alert: Alert) => { location: string; device: string | null };
  canAcknowledge: boolean;
  onAction: (action: AlertAction, alert: Alert) => void;
}

// ALERT-FR-007 — bảng cảnh báo: STT, mức, loại, vị trí, thiết bị, trạng thái, lúc tạo, menu thao tác
export default function AlertTable({ alerts, serverPagination, locationOf, canAcknowledge, onAction }: AlertTableProps): JSX.Element {
  const { t, dateTime } = useTranslation(alertsDict);
  const firstIndex = (serverPagination.page - 1) * ALERT_PAGE_SIZE;
  // Số thứ tự tra Map dựng 1 lần, không indexOf mỗi dòng (FE_Design 13.12)
  const rowNumbers = useMemo(() => new Map(alerts.map((alert, index) => [alert._id, firstIndex + index + 1])), [alerts, firstIndex]);

  // table-fixed: cột % cộng đủ phần còn lại sau STT, Mức, Thao tác để không dư khoảng trống giữa các cột
  const columns = useMemo<DataTableColumn<Alert>[]>(() => [
    { key: 'index', header: t('col.index'), className: 'w-16', render: alert => <span className="text-sm text-warmGray">{rowNumbers.get(alert._id)}</span> },
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
      render: alert => <span className="block truncate whitespace-nowrap text-sm font-semibold text-charcoal">{locationOf(alert).device ?? NO_VALUE}</span>,
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
      render: alert => {
        const items: ActionsMenuItem[] = [{ label: t('action.view'), onClick: () => onAction('view', alert) }];
        if (canAcknowledge && alert.status === 'ACTIVE') {
          items.push({ label: t('action.acknowledge'), onClick: () => onAction('acknowledge', alert) });
        }
        return (
          // Bấm menu (kể cả mục trong portal) không mở chi tiết của dòng
          <div className="flex items-center justify-center" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            <ActionsMenu items={items} />
          </div>
        );
      },
    },
  ], [t, dateTime, rowNumbers, locationOf, canAcknowledge, onAction]);

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
    />
  );
}
