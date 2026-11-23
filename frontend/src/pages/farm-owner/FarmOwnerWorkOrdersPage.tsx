import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@phosphor-icons/react';

import ScopeFilter from '@/components/common/ScopeFilter';
import TableEmptyState from '@/components/common/TableEmptyState';
import WorkOrderCreateModal from '@/components/features/farm-owner/work-orders/WorkOrderCreateModal';
import WorkOrderDetailDrawer from '@/components/features/farm-owner/work-orders/WorkOrderDetailDrawer';
import WorkOrderDoneModal from '@/components/features/farm-owner/work-orders/WorkOrderDoneModal';
import WorkOrderReassignModal from '@/components/features/farm-owner/work-orders/WorkOrderReassignModal';
import WorkOrderTable from '@/components/features/farm-owner/work-orders/WorkOrderTable';
import {
  WORK_ORDER_STATUSES, approvalDescriptionKey, memberNames, reassignCandidates, statusFilterQuery, type OwnerAction, type StatusFilter,
  type WorkOrderActor,
} from '@/components/features/farm-owner/work-orders/workOrder.utils';
import HeaderActions from '@/components/layouts/HeaderActions';
import { Button, ConfirmModal, EmptyState, FilterChip, LoadingSkeleton, NoteActionModal, SectionCard, SelectMenu } from '@/components/ui';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import { WORK_ORDER_PAGE_SIZE, useWorkOrderActions, useWorkOrders } from '@/hooks/farm-owner/useWorkOrders';
import { lastPage } from '@/lib/helpers';
import { useFarmDetails } from '@/hooks/shared/useFarms';
import { useToastStore } from '@/stores/toastStore';
import type { WorkOrder } from '@/types';

// Ghi chú mở lại, lý do huỷ tối đa 1.000 ký tự (api-spec)
const NOTE_MAX_LENGTH = 1000;

// Lời giải thích của trang theo người xem
const HELP_KEY = { owner: 'list.subtitle', technician: 'list.subtitleTechnician', reader: 'list.subtitleExpert' } as const;

// Chủ nhà yến thao tác mọi việc, kỹ thuật viên làm phiếu của nhà được giao, chuyên gia chỉ xem
export default function FarmOwnerWorkOrdersPage(): JSX.Element {
  const { t } = useTranslation(workOrderDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  // Work Order thuộc nhà, nên trang chỉ lọc tới nhà: ô Zone khoá
  const scope = { ...useScopeFilter(), zone: undefined };
  const canManage = usePermission('FARM_OWNER');
  const isTechnician = usePermission('FARM_TECHNICIAN');
  // Kỹ thuật viên bắt đầu, làm checklist và báo xong phiếu của nhà được giao; chuyên gia chỉ đọc
  let actor: WorkOrderActor = 'reader';
  if (canManage) actor = 'owner';
  else if (isTechnician) actor = 'technician';
  const actions = useWorkOrderActions();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  // Kỹ thuật viên mặc định chỉ xem phiếu giao cho mình (backend assigneeId=me)
  const [isOnlyMine, setIsOnlyMine] = useState(true);
  const query = {
    ...(scope.houseId ? { houseId: scope.houseId } : scope.farmId ? { farmId: scope.farmId } : {}),
    ...statusFilterQuery(statusFilter),
    ...(isTechnician && isOnlyMine ? { assigneeId: 'me' } : {}),
  };
  // Bộ lọc "Giao cho tôi" bỏ qua phiếu chưa giao (không có thợ trực) nên trạng thái rỗng nhắc tắt bộ lọc
  let emptyHintKey: 'list.emptyHint' | 'list.emptyHintMine' | 'list.emptyHintReader' = 'list.emptyHint';
  if (isTechnician && isOnlyMine) emptyHintKey = 'list.emptyHintMine';
  else if (actor !== 'owner') emptyHintKey = 'list.emptyHintReader';
  // Đổi phạm vi hoặc trạng thái thì về trang 1
  const filterKey = JSON.stringify(query);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const { records: workOrders, total, isLoading, isError, error, refetch } = useWorkOrders(query, page);
  // Duyệt hay huỷ phiếu cuối của trang cuối làm trang rỗng: lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (!isLoading && !isError && workOrders.length === 0 && page > 1) {
      setPageState({ key: filterKey, page: lastPage(total, WORK_ORDER_PAGE_SIZE) });
    }
  }, [isLoading, isError, workOrders.length, page, total, filterKey]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ action: OwnerAction; workOrder: WorkOrder } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const houseById = useMemo(() => new Map(scope.houses.map(house => [house._id, house])), [scope.houses]);
  const houseNames = useMemo(() => new Map(scope.houses.map(house => [house._id, house.name])), [scope.houses]);
  // Tên thành viên farm cho diễn biến và danh sách thợ giao lại
  const detailFarmIds = useMemo(() => (scope.farmId ? [scope.farmId] : scope.farms.map(farm => farm._id)), [scope.farmId, scope.farms]);
  const farmDetails = useFarmDetails(detailFarmIds);
  const personNames = useMemo(() => memberNames(farmDetails), [farmDetails]);

  const selectedHouse = scope.houseId ? houseById.get(scope.houseId) : undefined;
  const pendingHouse = pending ? houseById.get(pending.workOrder.house_id) : undefined;
  const candidates = pending?.action === 'reassign'
    ? reassignCandidates(pendingHouse, personNames, pending.workOrder.assignee?._id)
    : [];

  const openDetail = useCallback((workOrder: WorkOrder) => setDetailId(workOrder._id), []);
  const startAction = useCallback((action: OwnerAction, workOrder: WorkOrder) => setPending({ action, workOrder }), []);
  const closePending = () => setPending(null);
  // Xong thì báo và đóng popup; lỗi (VD 409 trạng thái đã đổi) báo theo nhóm lỗi
  const callbacks = (doneKey: 'start.done' | 'approve.done' | 'reopen.done' | 'cancel.done') => ({
    onSuccess: () => {
      push(t(doneKey));
      closePending();
    },
    onError: (actionError: unknown) => push(apiErrorMessage(actionError), 'error'),
  });

  // Chưa có farm: đang tải thì khung chờ, tải lỗi thì báo kèm Thử lại, xong mới báo chưa có farm (FE_Design 13.5)
  if (scope.farms.length === 0 && scope.isLoading) return <LoadingSkeleton count={5} className="h-14 w-full" />;
  if (scope.farms.length === 0 && scope.isError) {
    return (
      <EmptyState
        title={t('page.loadFailed')}
        description={apiErrorMessage(undefined)}
        action={<Button variant="secondary" size="sm" onClick={scope.refetch}>{t('page.retry')}</Button>}
      />
    );
  }
  if (scope.farms.length === 0) {
    return (
      <EmptyState
        title={t('page.noFarmTitle')}
        description={t('page.noFarmDesc')}
        action={<Link to="/farms"><Button>{t('page.goFarms')}</Button></Link>}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HeaderActions>
        <ScopeFilter scope={scope} lockZone />
      </HeaderActions>

      <SectionCard description={t('list.short')} help={t(HELP_KEY[actor])}>
        {/* Lọc trạng thái bên trái, nút mở tay bên phải (chỉ Farm Owner) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SelectMenu
            ariaLabel={t('list.filterStatus')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'open', label: t('filter.open') },
              { value: 'all', label: t('filter.all') },
              ...WORK_ORDER_STATUSES.map(status => ({ value: status, label: t(`status.${status}`) })),
            ]}
          />
          {isTechnician && (
            <FilterChip active={isOnlyMine} label={t('filter.mine')} onClick={() => setIsOnlyMine(current => !current)} />
          )}
          {canManage && (
            <Button
              size="sm"
              disabled={!selectedHouse}
              title={selectedHouse ? undefined : t('list.needHouse')}
              onClick={() => setIsCreateOpen(true)}
            >
              <PlusIcon size={14} weight="bold" aria-hidden />
              {t('list.create')}
            </Button>
          )}
          {canManage && !selectedHouse && <span className="text-small text-warmGray">{t('list.needHouseShort')}</span>}
        </div>

        {isLoading ? (
          <LoadingSkeleton count={5} className="h-14 w-full" />
        ) : isError ? (
          <EmptyState
            title={t('list.errorTitle')}
            description={apiErrorMessage(error)}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>}
          />
        ) : workOrders.length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-12">
            <TableEmptyState title={t('list.emptyTitle')} description={t(emptyHintKey)} />
          </div>
        ) : (
          <WorkOrderTable
            workOrders={workOrders}
            page={page}
            total={total}
            onPageChange={next => setPageState({ key: filterKey, page: next })}
            houseNames={houseNames}
            actor={actor}
            onView={openDetail}
            onAction={startAction}
          />
        )}
      </SectionCard>

      <WorkOrderDetailDrawer
        workOrderId={detailId}
        houseNames={houseNames}
        personNames={personNames}
        actor={actor}
        onAction={startAction}
        onClose={() => setDetailId(null)}
      />

      {selectedHouse && (
        <WorkOrderCreateModal open={isCreateOpen} house={{ id: selectedHouse._id, name: selectedHouse.name }} onClose={() => setIsCreateOpen(false)} />
      )}

      {/* Bắt đầu hỏi lại vì phiếu chuyển sang đang làm dưới tên người bấm */}
      <ConfirmModal
        open={pending?.action === 'start'}
        title={t('action.start')}
        description={pending?.workOrder.title ?? ''}
        confirmLabel={t('action.start')}
        loading={actions.start.isPending}
        onConfirm={() => pending && actions.start.mutate(pending.workOrder, callbacks('start.done'))}
        onCancel={closePending}
      />
      <WorkOrderDoneModal workOrder={pending?.action === 'done' ? pending.workOrder : null} onClose={closePending} />
      {/* Duyệt đóng cả cảnh báo nên hỏi lại trước */}
      <ConfirmModal
        open={pending?.action === 'approve'}
        title={t('approve.title')}
        description={t(pending ? approvalDescriptionKey(pending.workOrder) : 'approve.desc')}
        confirmLabel={t('action.approve')}
        loading={actions.approve.isPending}
        onConfirm={() => pending && actions.approve.mutate(pending.workOrder, callbacks('approve.done'))}
        onCancel={closePending}
      />
      <NoteActionModal
        open={pending?.action === 'reopen'}
        onClose={closePending}
        title={t('reopen.title')}
        label={t('reopen.label')}
        placeholder={t('reopen.placeholder')}
        hint={t('reopen.hint')}
        submitLabel={t('action.reopen')}
        required
        maxLength={NOTE_MAX_LENGTH}
        loading={actions.reopen.isPending}
        onSubmit={note => pending && actions.reopen.mutate({ workOrder: pending.workOrder, note }, callbacks('reopen.done'))}
      />
      <NoteActionModal
        open={pending?.action === 'cancel'}
        onClose={closePending}
        title={t('cancel.title')}
        label={t('cancel.label')}
        placeholder={t('cancel.placeholder')}
        hint={t('cancel.hint')}
        submitLabel={t('action.cancel')}
        required
        maxLength={NOTE_MAX_LENGTH}
        danger
        loading={actions.cancel.isPending}
        onSubmit={reason => pending && actions.cancel.mutate({ workOrder: pending.workOrder, reason }, callbacks('cancel.done'))}
      />
      <WorkOrderReassignModal
        workOrder={pending?.action === 'reassign' ? pending.workOrder : null}
        houseName={pendingHouse?.name ?? ''}
        candidates={candidates}
        onClose={closePending}
      />
    </div>
  );
}
