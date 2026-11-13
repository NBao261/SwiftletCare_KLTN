import { useMemo } from 'react';
import { WORK_ORDER_STATUS_TONE, ownerActions, type OwnerAction } from '@/components/features/farm-owner/work-orders/workOrder.utils';
import { ActionsMenu, Badge, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { NO_VALUE } from '@/constants/display';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { WORK_ORDER_PAGE_SIZE } from '@/hooks/farm-owner/useWorkOrders';
import type { WorkOrder } from '@/types';

// Cùng chiều cao dòng các bảng trang Sức khỏe
const ROW_HEIGHT = 72;

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  houseNames: Map<string, string>;
  canManage: boolean;
  onView: (workOrder: WorkOrder) => void;
  onAction: (action: OwnerAction, workOrder: WorkOrder) => void;
}

// OPS-FR-001…004 — bảng Work Order (phân trang server): việc, nhà, người làm, trạng thái, lúc mở, menu thao tác
export default function WorkOrderTable({
  workOrders, page, total, onPageChange, houseNames, canManage, onView, onAction,
}: WorkOrderTableProps): JSX.Element {
  const { t, dateTime } = useTranslation(workOrderDict);
  const firstIndex = (page - 1) * WORK_ORDER_PAGE_SIZE;
  // Số thứ tự tra Map dựng 1 lần, không indexOf mỗi dòng (FE_Design 13.12)
  const rowNumbers = useMemo(
    () => new Map(workOrders.map((workOrder, index) => [workOrder._id, firstIndex + index + 1])),
    [workOrders, firstIndex],
  );

  const columns = useMemo<DataTableColumn<WorkOrder>[]>(() => [
    { key: 'index', header: t('col.index'), className: 'w-16', render: workOrder => <span className="text-sm text-warmGray">{rowNumbers.get(workOrder._id)}</span> },
    {
      key: 'title',
      header: t('col.title'),
      className: 'w-[27%]',
      render: workOrder => (
        <div className="flex min-w-0 flex-col">
          <span title={workOrder.title} className="truncate text-sm font-semibold text-charcoal">{workOrder.title}</span>
          <span className="truncate text-xs text-warmGray">
            {workOrder.alert_type ? t(`alertType.${workOrder.alert_type}`) : t(`origin.${workOrder.origin}`)}
          </span>
        </div>
      ),
    },
    {
      key: 'house',
      header: t('col.house'),
      className: 'w-[16%]',
      render: workOrder => <span className="block truncate whitespace-nowrap text-sm text-charcoal">{houseNames.get(workOrder.house_id) ?? NO_VALUE}</span>,
    },
    // Một dòng, dài thì cắt "…" (rê chuột xem đủ) như các ô khác của bảng
    {
      key: 'assignee',
      header: t('col.assignee'),
      className: 'w-[19%]',
      render: workOrder => (workOrder.assignee
        ? <span title={workOrder.assignee.full_name} className="block truncate whitespace-nowrap text-sm text-charcoal">{workOrder.assignee.full_name}</span>
        : <span title={t('cell.unassigned')} className="block truncate whitespace-nowrap text-sm italic text-warmGray">{t('cell.unassigned')}</span>),
    },
    {
      key: 'status',
      header: t('col.status'),
      className: 'w-[14%] whitespace-nowrap',
      render: workOrder => <Badge tone={WORK_ORDER_STATUS_TONE[workOrder.status]}>{t(`status.${workOrder.status}`)}</Badge>,
    },
    { key: 'openedAt', header: t('col.openedAt'), className: 'w-[14%] whitespace-nowrap', render: workOrder => <span className="text-sm text-charcoal">{dateTime(workOrder.opened_at)}</span> },
    // Thao tác qua menu ⋯ (FE_Design mục 1, dòng Bảng): xem chi tiết, rồi các thao tác của Farm Owner theo trạng thái
    {
      key: 'actions',
      header: t('col.actions'),
      align: 'center',
      className: 'w-24 whitespace-nowrap',
      render: workOrder => (
        // Bấm menu (kể cả mục trong portal) không mở chi tiết của dòng
        <div className="flex items-center justify-center" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
          <ActionsMenu
            items={[
              { label: t('action.view'), onClick: () => onView(workOrder) },
              ...(canManage ? ownerActions(workOrder.status) : []).map(action => ({
                label: t(`action.${action}`),
                onClick: () => onAction(action, workOrder),
                danger: action === 'cancel',
              })),
            ]}
          />
        </div>
      ),
    },
  ], [t, dateTime, rowNumbers, houseNames, canManage, onView, onAction]);

  return (
    <FixedRowsTable
      columns={columns}
      rows={workOrders}
      getRowKey={workOrder => workOrder._id}
      onRowClick={onView}
      rowHeight={ROW_HEIGHT}
      pageSize={WORK_ORDER_PAGE_SIZE}
      emptyNotice={t('list.emptyTitle')}
      serverPagination={{ page, total, onChange: onPageChange }}
    />
  );
}
