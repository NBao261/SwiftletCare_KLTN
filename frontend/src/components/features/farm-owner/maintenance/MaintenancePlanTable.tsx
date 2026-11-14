import { useMemo } from 'react';
import { ActionsMenu, Badge, type ActionsMenuItem, type BadgeTone, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { NO_VALUE } from '@/constants/display';
import { maintenanceDict } from '@/constants/maintenance.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { MAINTENANCE_PAGE_SIZE } from '@/hooks/farm-owner/useMaintenance';
import type { MaintenancePlan, MaintenancePlanState } from '@/types';

// Cùng chiều cao dòng bảng phiếu công việc
const ROW_HEIGHT = 72;

export const PLAN_STATE_TONE: Record<MaintenancePlanState, BadgeTone> = {
  SCHEDULED: 'positive',
  DUE: 'warning',
  OVERDUE: 'critical',
  RETIRED: 'neutral',
};

export type PlanAction = 'view' | 'edit' | 'retire' | 'comment';

interface MaintenancePlanTableProps {
  plans: MaintenancePlan[];
  // Không truyền = bảng đến hạn: phân trang ở client, cột hạn có số phiếu công việc đang mở
  serverPagination?: { page: number; total: number; onChange: (page: number) => void };
  houseNames: Map<string, string>;
  canManage: boolean;
  canComment: boolean;
  emptyNotice: string;
  onAction: (action: PlanAction, plan: MaintenancePlan) => void;
}

// OPS-FR-005, 006 — bảng kế hoạch: việc, nhà, chu kỳ, trạng thái, hạn, lần gần nhất, menu thao tác
export default function MaintenancePlanTable({
  plans, serverPagination, houseNames, canManage, canComment, emptyNotice, onAction,
}: MaintenancePlanTableProps): JSX.Element {
  const { t, num, date } = useTranslation(maintenanceDict);
  const firstIndex = serverPagination ? (serverPagination.page - 1) * MAINTENANCE_PAGE_SIZE : 0;
  // Số thứ tự tra Map dựng 1 lần (FE_Design 13.12)
  const rowNumbers = useMemo(() => new Map(plans.map((plan, index) => [plan._id, firstIndex + index + 1])), [plans, firstIndex]);

  const columns = useMemo<DataTableColumn<MaintenancePlan>[]>(() => {
    // Hạn: đang đến hạn thì từ lúc nào; theo lịch thì ngày kế tiếp; bơm, quạt thì theo bộ đếm của bộ điều khiển
    function dueCell(plan: MaintenancePlan): JSX.Element {
      if ((plan.state === 'DUE' || plan.state === 'OVERDUE') && plan.due_since) {
        return (
          <div className="flex flex-col">
            <span className="text-sm text-charcoal">{t('cell.dueSince', { date: date(plan.due_since) })}</span>
            {plan.open_work_orders && plan.open_work_orders.length > 0 && (
              <span className="text-xs text-warmGray">{t('cell.openWorkOrders', { count: plan.open_work_orders.length })}</span>
            )}
          </div>
        );
      }
      if (plan.basis !== 'CALENDAR') return <span className="text-sm text-warmGray">{t('cell.byCounter')}</span>;
      return <span className="text-sm text-charcoal">{plan.next_due_at ? date(plan.next_due_at) : NO_VALUE}</span>;
    }

    function menuItems(plan: MaintenancePlan): ActionsMenuItem[] {
      const items: ActionsMenuItem[] = [{ label: t('action.view'), onClick: () => onAction('view', plan) }];
      if (canManage && plan.state !== 'RETIRED') {
        items.push({ label: t('action.edit'), onClick: () => onAction('edit', plan) });
        items.push({ label: t('action.retire'), onClick: () => onAction('retire', plan), danger: true });
      }
      if (canComment && plan.state !== 'RETIRED') items.push({ label: t('action.comment'), onClick: () => onAction('comment', plan) });
      return items;
    }

    return [
      { key: 'index', header: t('col.index'), className: 'w-16', render: plan => <span className="text-sm text-warmGray">{rowNumbers.get(plan._id)}</span> },
      {
        key: 'equipment',
        header: t('col.equipment'),
        className: 'w-[24%]',
        render: plan => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-charcoal">{t(`equipment.${plan.equipment}`)}</span>
            <span className="truncate text-xs text-warmGray">{t(`basis.${plan.basis}`)}</span>
          </div>
        ),
      },
      {
        key: 'house',
        header: t('col.house'),
        className: 'w-[16%]',
        render: plan => <span className="block truncate whitespace-nowrap text-sm text-charcoal">{houseNames.get(plan.house_id) ?? NO_VALUE}</span>,
      },
      {
        key: 'interval',
        header: t('col.interval'),
        className: 'w-[14%] whitespace-nowrap',
        render: plan => <span className="text-sm text-charcoal">{t(`unit.${plan.basis}`, { value: num(plan.interval) })}</span>,
      },
      {
        key: 'state',
        header: t('col.state'),
        className: 'w-[12%] whitespace-nowrap',
        render: plan => <Badge tone={PLAN_STATE_TONE[plan.state]}>{t(`state.${plan.state}`)}</Badge>,
      },
      { key: 'due', header: t('col.due'), className: 'w-[14%] whitespace-nowrap', render: dueCell },
      {
        key: 'lastDone',
        header: t('col.lastDone'),
        className: 'w-[12%] whitespace-nowrap',
        render: plan => <span className="text-sm text-charcoal">{plan.last_done_at ? date(plan.last_done_at) : NO_VALUE}</span>,
      },
      {
        key: 'actions',
        header: t('col.actions'),
        align: 'center',
        className: 'w-24 whitespace-nowrap',
        render: plan => (
          // Bấm menu (kể cả mục trong portal) không mở chi tiết của dòng
          <div className="flex items-center justify-center" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            <ActionsMenu items={menuItems(plan)} />
          </div>
        ),
      },
    ];
  }, [t, num, date, rowNumbers, houseNames, canManage, canComment, onAction]);

  return (
    <FixedRowsTable
      columns={columns}
      rows={plans}
      getRowKey={plan => plan._id}
      onRowClick={plan => onAction('view', plan)}
      rowHeight={ROW_HEIGHT}
      pageSize={MAINTENANCE_PAGE_SIZE}
      emptyNotice={emptyNotice}
      serverPagination={serverPagination}
    />
  );
}
