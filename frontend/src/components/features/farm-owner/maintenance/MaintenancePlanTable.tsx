import { useMemo } from 'react';
import { ActionsMenu, Badge, Button, type ActionsMenuItem, type BadgeTone, type DataTableColumn } from '@/components/ui';
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

// bảng kế hoạch: việc, nhà, chu kỳ, trạng thái, hạn, lần gần nhất, menu thao tác
export default function MaintenancePlanTable({
  plans, serverPagination, houseNames, canManage, canComment, emptyNotice, onAction,
}: MaintenancePlanTableProps): JSX.Element {
  const { t, num, date } = useTranslation(maintenanceDict);

  const columns = useMemo<DataTableColumn<MaintenancePlan>[]>(() => {
    // Hạn ở dòng trên: đang đến hạn thì từ lúc nào; theo lịch thì ngày kế tiếp; bơm, quạt thì theo bộ đếm của bộ điều khiển
    // Dòng dưới: số phiếu đang mở khi đến hạn, nếu không thì lần bảo trì gần nhất
    function dueCell(plan: MaintenancePlan): JSX.Element {
      const isDue = (plan.state === 'DUE' || plan.state === 'OVERDUE') && Boolean(plan.due_since);
      let main = <span className="text-sm font-semibold text-charcoal">{plan.next_due_at ? date(plan.next_due_at) : NO_VALUE}</span>;
      if (isDue && plan.due_since) main = <span className="text-sm font-semibold text-charcoal">{t('cell.dueSince', { date: date(plan.due_since) })}</span>;
      else if (plan.basis !== 'CALENDAR') main = <span className="text-sm font-semibold text-warmGray">{t('cell.byCounter')}</span>;
      let note: string | null = plan.last_done_at ? t('cell.lastDone', { date: date(plan.last_done_at) }) : null;
      if (isDue && plan.open_work_orders && plan.open_work_orders.length > 0) note = t('cell.openWorkOrders', { count: plan.open_work_orders.length });
      return (
        <div className="flex flex-col">
          {main}
          {note && <span className="text-xs text-warmGray">{note}</span>}
        </div>
      );
    }

    // Menu ⋯ chỉ chứa thao tác ngoài "Xem": sửa, xoá, góp ý
    function menuItems(plan: MaintenancePlan): ActionsMenuItem[] {
      const items: ActionsMenuItem[] = [];
      if (canManage && plan.state !== 'RETIRED') {
        items.push({ label: t('action.edit'), onClick: () => onAction('edit', plan) });
        items.push({ label: t('action.retire'), onClick: () => onAction('retire', plan), danger: true });
      }
      if (canComment && plan.state !== 'RETIRED') items.push({ label: t('action.comment'), onClick: () => onAction('comment', plan) });
      return items;
    }

    return [
      {
        key: 'equipment',
        header: t('col.equipment'),
        className: 'w-[26%]',
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
        className: 'w-[18%]',
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
      { key: 'due', header: t('col.due'), className: 'w-[18%] whitespace-nowrap', render: dueCell },
      {
        key: 'actions',
        header: '',
        align: 'right',
        className: 'w-[16%] whitespace-nowrap',
        render: plan => {
          const items = menuItems(plan);
          return (
            // Bấm nút hoặc menu (kể cả mục trong portal) không mở chi tiết của dòng
            <div className="flex items-center justify-end gap-1" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => onAction('view', plan)}>{t('action.open')}</Button>
              {items.length > 0 && <ActionsMenu items={items} />}
            </div>
          );
        },
      },
    ];
  }, [t, num, date, houseNames, canManage, canComment, onAction]);

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
