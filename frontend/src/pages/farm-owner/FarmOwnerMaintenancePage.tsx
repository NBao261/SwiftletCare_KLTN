import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusIcon } from '@phosphor-icons/react';

import ScopeFilter from '@/components/common/ScopeFilter';
import TableEmptyState from '@/components/common/TableEmptyState';
import MaintenancePlanDetailDrawer from '@/components/features/farm-owner/maintenance/MaintenancePlanDetailDrawer';
import MaintenancePlanFormModal from '@/components/features/farm-owner/maintenance/MaintenancePlanFormModal';
import MaintenancePlanTable, { type PlanAction } from '@/components/features/farm-owner/maintenance/MaintenancePlanTable';
import HeaderActions from '@/components/layouts/HeaderActions';
import { Button, ConfirmModal, EmptyState, LoadingSkeleton, NoteActionModal, SectionCard, SelectMenu } from '@/components/ui';
import { maintenanceDict } from '@/constants/maintenance.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useDueMaintenancePlans, useMaintenancePlanActions, useMaintenancePlans } from '@/hooks/farm-owner/useMaintenance';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toastStore';
import type { MaintenancePlan, MaintenancePlanState } from '@/types';

const PLAN_STATES: MaintenancePlanState[] = ['SCHEDULED', 'DUE', 'OVERDUE', 'RETIRED'];
// 'active' = mọi kế hoạch chưa xoá (backend mặc định bỏ RETIRED)
type StateFilter = 'active' | MaintenancePlanState;
// Tên tab trùng tiền tố khoá tiêu đề (due.title, list.title); tab đầu là mặc định
const TABS = ['due', 'list'] as const;
type MaintenanceTab = (typeof TABS)[number];

// Khung viền đứt khi rỗng, kéo tới gần đáy thẻ; đệm trên dày hơn 40px vì vòng tròn minh hoạ tràn lên trên khung hình 40px
function EmptyFrame({ title, hint }: { title: string; hint: string }): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 pb-10 pt-20">
      <TableEmptyState title={title} description={hint} />
    </div>
  );
}

// OPS-FR-005, 006 — Lịch bảo trì: kế hoạch đến hạn/quá hạn, danh sách kế hoạch; Farm Owner tạo, sửa, xoá; Domain Expert xem và góp ý
export default function FarmOwnerMaintenancePage(): JSX.Element {
  const { t } = useTranslation(maintenanceDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  // Kế hoạch thuộc nhà, nên trang chỉ lọc tới nhà: ô Zone khoá
  const scope = { ...useScopeFilter(), zone: undefined };
  const canManage = usePermission('FARM_OWNER');
  const canComment = usePermission('DOMAIN_EXPERT');
  const actions = useMaintenancePlanActions();
  // Tab nằm trên URL (?tab=list) để F5 hoặc quay lại vẫn đúng tab
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: MaintenanceTab = TABS.find(value => value === searchParams.get('tab')) ?? 'due';
  const setTab = (value: MaintenanceTab) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value === 'due') next.delete('tab');
    else next.set('tab', value);
    return next;
  }, { replace: true });

  const scopeQuery = scope.houseId ? { houseId: scope.houseId } : scope.farmId ? { farmId: scope.farmId } : {};
  const due = useDueMaintenancePlans(scopeQuery);

  const [stateFilter, setStateFilter] = useState<StateFilter>('active');
  const query = { ...scopeQuery, ...(stateFilter !== 'active' && { state: stateFilter }) };
  // Đổi phạm vi hoặc trạng thái thì về trang 1
  const filterKey = JSON.stringify(query);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const { records: plans, total, isLoading, isError, error, refetch } = useMaintenancePlans(query, page);

  const [pending, setPending] = useState<{ action: PlanAction; plan: MaintenancePlan } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const houseNames = useMemo(() => new Map(scope.houses.map(house => [house._id, house.name])), [scope.houses]);

  const startAction = useCallback((action: PlanAction, plan: MaintenancePlan) => setPending({ action, plan }), []);
  const closePending = () => setPending(null);
  const pendingHouseName = pending ? houseNames.get(pending.plan.house_id) ?? '' : '';
  // Popup tạo dùng nhà đang lọc, popup sửa dùng nhà của kế hoạch
  const formHouse = pending?.action === 'edit'
    ? { id: pending.plan.house_id, name: pendingHouseName }
    : { id: scope.houseId, name: scope.houseName };

  const callbacks = (doneKey: 'retire.done' | 'comment.done') => ({
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
        <div className="hidden sm:block">
          <ScopeFilter scope={scope} lockZone />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={scope} lockZone />
      </div>

      {/* Tab pill như trang Sức khỏe nhà yến: mỗi lúc 1 thẻ; tab Cần bảo trì kèm số kế hoạch đến hạn */}
      <div className="inline-flex gap-1 self-start rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={t('page.tabs')}>
        {TABS.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'h-9 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150',
              tab === value ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
            )}
          >
            {t(`${value}.title`)}
            {value === 'due' && Boolean(due.data?.length) && ` (${due.data?.length})`}
          </button>
        ))}
      </div>

      {tab === 'due' ? (
        // Kế hoạch đến hạn và quá hạn (OPS-FR-006)
        <SectionCard className="flex-1" title={t('due.title')} description={t('due.subtitle')}>
          {due.isLoading ? (
            <LoadingSkeleton count={3} className="h-14 w-full" />
          ) : due.isError ? (
            <EmptyState
              title={t('due.errorTitle')}
              description={apiErrorMessage(due.error)}
              action={<Button variant="secondary" size="sm" onClick={() => void due.refetch()}>{t('page.retry')}</Button>}
            />
          ) : !due.data?.length ? (
            <EmptyFrame title={t('due.emptyTitle')} hint={t('due.emptyHint')} />
        ) : (
            <MaintenancePlanTable
              plans={due.data}
              houseNames={houseNames}
              canManage={canManage}
              canComment={canComment}
              emptyNotice={t('due.emptyTitle')}
              onAction={startAction}
            />
          )}
        </SectionCard>
      ) : (
        // Danh sách kế hoạch (OPS-FR-005)
        <SectionCard className="flex-1" title={t('list.title')} description={t(canManage ? 'list.subtitle' : 'list.subtitleExpert')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SelectMenu
              ariaLabel={t('list.filterState')}
              value={stateFilter}
              onChange={setStateFilter}
              options={[
                { value: 'active', label: t('filter.active') },
                ...PLAN_STATES.map(state => ({ value: state, label: t(`state.${state}`) })),
              ]}
            />
            {canManage && (
              <Button
                size="sm"
                disabled={!scope.houseId}
                title={scope.houseId ? undefined : t('list.needHouse')}
                onClick={() => setIsCreateOpen(true)}
              >
                <PlusIcon size={14} weight="bold" aria-hidden />
                {t('list.create')}
              </Button>
            )}
          </div>

          {isLoading ? (
            <LoadingSkeleton count={5} className="h-14 w-full" />
          ) : isError ? (
            <EmptyState
              title={t('list.errorTitle')}
              description={apiErrorMessage(error)}
              action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>}
            />
          ) : plans.length === 0 ? (
            <EmptyFrame title={t('list.emptyTitle')} hint={t('list.emptyHint')} />
        ) : (
            <MaintenancePlanTable
              plans={plans}
              serverPagination={{ page, total, onChange: next => setPageState({ key: filterKey, page: next }) }}
              houseNames={houseNames}
              canManage={canManage}
              canComment={canComment}
              emptyNotice={t('list.emptyTitle')}
              onAction={startAction}
            />
          )}
        </SectionCard>
      )}

      <MaintenancePlanDetailDrawer
        plan={pending?.action === 'view' ? pending.plan : null}
        houseName={pendingHouseName}
        onClose={closePending}
      />

      {canManage && (
        <MaintenancePlanFormModal
          open={isCreateOpen || pending?.action === 'edit'}
          house={formHouse}
          plan={pending?.action === 'edit' ? pending.plan : null}
          onClose={() => {
            setIsCreateOpen(false);
            closePending();
          }}
        />
      )}

      {/* Xoá không hoàn tác: popup đỏ, in đậm kế hoạch và nhà */}
      <ConfirmModal
        open={pending?.action === 'retire'}
        title={t('retire.title')}
        description={pending && (
          <>
            <strong className="text-charcoal">{t(`equipment.${pending.plan.equipment}`)} · {pendingHouseName}</strong>
            <br />
            {t('retire.desc')}
          </>
        )}
        confirmLabel={t('action.retire')}
        danger
        loading={actions.retire.isPending}
        onConfirm={() => pending && actions.retire.mutate(pending.plan._id, callbacks('retire.done'))}
        onCancel={closePending}
      />
      <NoteActionModal
        open={pending?.action === 'comment'}
        onClose={closePending}
        title={t('comment.title')}
        label={t('comment.label')}
        placeholder={t('comment.placeholder')}
        hint={t('comment.hint')}
        submitLabel={t('comment.submit')}
        required
        loading={actions.comment.isPending}
        onSubmit={text => pending && actions.comment.mutate({ id: pending.plan._id, text }, callbacks('comment.done'))}
      />
    </div>
  );
}
