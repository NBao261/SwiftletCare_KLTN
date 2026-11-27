import { useMemo } from 'react';
import { WORK_ORDER_STATUS_TONE, workOrderActions, type OwnerAction, type WorkOrderActor } from '@/components/features/farm-owner/work-orders/workOrder.utils';
import { ActionsMenu, Badge, Button, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { NO_VALUE } from '@/constants/display';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { WORK_ORDER_PAGE_SIZE } from '@/hooks/farm-owner/useWorkOrders';
import type { WorkOrder } from '@/types';

// Cùng chiều cao dòng các bảng trang Sức khỏe
const ROW_HEIGHT = 72;

// Việc làm ngay trên dòng; thao tác còn lại (mở lại, giao lại, huỷ) nằm trong menu ⋯
const PRIMARY_ACTIONS: OwnerAction[] = ['start', 'done', 'approve'];

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  houseNames: Map<string, string>;
  actor: WorkOrderActor;
  onView: (workOrder: WorkOrder) => void;
  onAction: (action: OwnerAction, workOrder: WorkOrder) => void;
}

// bảng Work Order (phân trang server): việc, nhà và người làm, trạng thái, lúc mở, 1 nút việc chính
export default function WorkOrderTable({
  workOrders, page, total, onPageChange, houseNames, actor, onView, onAction,
}: WorkOrderTableProps): JSX.Element {
  const { t, dateTime, ago } = useTranslation(workOrderDict);

  const columns = useMemo<DataTableColumn<WorkOrder>[]>(() => [
    {
      key: 'title',
      header: t('col.title'),
      className: 'w-[32%]',
      render: workOrder => (
        <div className="flex min-w-0 flex-col">
          <span title={workOrder.title} className="truncate text-sm font-semibold text-charcoal">{workOrder.title}</span>
          <span className="truncate text-xs text-warmGray">
            {workOrder.alert_type ? t(`alertType.${workOrder.alert_type}`) : t(`origin.${workOrder.origin}`)}
          </span>
        </div>
      ),
    },
    // Nhà ở dòng trên, người làm ở dòng dưới (chưa giao thì ghi nghiêng)
    {
      key: 'where',
      header: t('col.where'),
      className: 'w-[22%]',
      render: workOrder => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate whitespace-nowrap text-sm font-semibold text-charcoal">{houseNames.get(workOrder.house_id) ?? NO_VALUE}</span>
          {workOrder.assignee
            ? <span title={workOrder.assignee.full_name} className="truncate whitespace-nowrap text-xs text-warmGray">{workOrder.assignee.full_name}</span>
            : <span className="truncate whitespace-nowrap text-xs italic text-warmGray">{t('cell.unassigned')}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      className: 'w-[14%] whitespace-nowrap',
      render: workOrder => <Badge tone={WORK_ORDER_STATUS_TONE[workOrder.status]}>{t(`status.${workOrder.status}`)}</Badge>,
    },
    // Dòng trên: cách đây bao lâu; dòng dưới: ngày giờ chính xác
    {
      key: 'openedAt',
      header: t('col.openedAt'),
      className: 'w-[14%] whitespace-nowrap',
      render: workOrder => (
        <div>
          <span className="block text-sm font-semibold text-charcoal">{ago(workOrder.opened_at)}</span>
          <span className="block text-xs text-warmGray">{dateTime(workOrder.opened_at)}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-[18%] whitespace-nowrap',
      render: workOrder => {
        const actions = workOrderActions(workOrder, actor);
        const primary = actions.find(action => PRIMARY_ACTIONS.includes(action));
        const rest = actions.filter(action => action !== primary);
        return (
          // Bấm nút hoặc menu (kể cả mục trong portal) không mở chi tiết của dòng
          <div className="flex items-center justify-end gap-1" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            <Button size="sm" variant={primary ? 'primary' : 'secondary'} onClick={() => (primary ? onAction(primary, workOrder) : onView(workOrder))}>
              {t(primary ? `action.${primary}` : 'action.open')}
            </Button>
            {rest.length > 0 && (
              <ActionsMenu
                items={rest.map(action => ({ label: t(`action.${action}`), onClick: () => onAction(action, workOrder), danger: action === 'cancel' }))}
              />
            )}
          </div>
        );
      },
    },
  ], [t, dateTime, ago, houseNames, actor, onView, onAction]);

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
      mobileCard={workOrder => (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-body font-semibold text-charcoal">{workOrder.title}</p>
            <p className="text-small text-warmGray">{houseNames.get(workOrder.house_id) ?? NO_VALUE} · {ago(workOrder.opened_at)}</p>
            <div><Badge tone={WORK_ORDER_STATUS_TONE[workOrder.status]}>{t(`status.${workOrder.status}`)}</Badge></div>
          </div>
          {/* Cùng nút việc chính và menu với cột cuối */}
          {columns[columns.length - 1].render(workOrder, 0)}
        </div>
      )}
    />
  );
}
