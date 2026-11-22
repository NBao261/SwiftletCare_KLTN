import { useCallback, useEffect, useMemo, useState } from 'react';

import ScopeFilter from '@/components/common/ScopeFilter';
import TableEmptyState from '@/components/common/TableEmptyState';
import RecommendationDetailDrawer from '@/components/features/farm-owner/recommendations/RecommendationDetailDrawer';
import RecommendationTable from '@/components/features/farm-owner/recommendations/RecommendationTable';
import { ruleOf } from '@/components/features/farm-owner/recommendations/recommendations.constants';
import HeaderActions from '@/components/layouts/HeaderActions';
import { Button, ConfirmModal, EmptyState, LoadingSkeleton, NoteActionModal, SectionCard, SelectMenu } from '@/components/ui';
import { recommendationsDict } from '@/constants/recommendations.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { RECOMMENDATIONS_PAGE_SIZE, useRecommendationActions, useRecommendations } from '@/hooks/farm-owner/useRecommendations';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import { useToastStore } from '@/stores/toastStore';
import type { Recommendation, RecommendationStatus } from '@/types';
import { REJECT_REASON_MAX_LENGTH } from '@/validations/common/recommendationRule.validation';

const STATUSES: RecommendationStatus[] = ['OPEN', 'ACCEPTED', 'MEASURED', 'REJECTED', 'EXPIRED'];
// 'all' = mọi trạng thái
type StatusFilter = 'all' | RecommendationStatus;

// Khung viền đứt khi rỗng, như trang Lịch bảo trì
function EmptyFrame({ title, hint }: { title: string; hint: string }): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 pb-10 pt-20">
      <TableEmptyState title={title} description={hint} />
    </div>
  );
}

// Khuyến nghị: luật của chuyên gia thoả ở nhà nào thì mở khuyến nghị; Farm Owner chấp nhận hoặc từ chối, Domain Expert xem
export default function FarmOwnerRecommendationsPage(): JSX.Element {
  const { t, exact } = useTranslation(recommendationsDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  // Khuyến nghị thuộc nhà, nên trang chỉ lọc tới nhà: ô Zone khoá
  const scope = { ...useScopeFilter(), zone: undefined };
  const canDecide = usePermission('FARM_OWNER');
  const actions = useRecommendationActions();
  const houseNames = useMemo(() => new Map(scope.houses.map(house => [house._id, house.name])), [scope.houses]);

  // Mặc định chỉ hiện khuyến nghị chờ quyết định
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const scopeQuery = scope.houseId ? { houseId: scope.houseId } : { farmId: scope.farmId || undefined };
  const filterKey = JSON.stringify({ ...scopeQuery, statusFilter });
  // Đổi phạm vi hoặc trạng thái thì về trang 1
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const hasScope = Boolean(scope.houseId || scope.farmId);
  const list = useRecommendations(
    { ...scopeQuery, ...(statusFilter !== 'all' && { status: statusFilter }), page, limit: RECOMMENDATIONS_PAGE_SIZE },
    hasScope,
  );
  // Quyết định xong làm trang cuối hết mục: lùi về trang cuối còn mục, để không kẹt ở khung rỗng
  const lastPage = Math.max(1, Math.ceil(list.total / RECOMMENDATIONS_PAGE_SIZE));
  useEffect(() => {
    if (!list.isLoading && !list.isError && page > lastPage) setPageState({ key: filterKey, page: lastPage });
  }, [list.isLoading, list.isError, page, lastPage, filterKey]);

  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [pending, setPending] = useState<{ action: 'accept' | 'reject'; recommendation: Recommendation } | null>(null);
  const openDetail = useCallback((recommendation: Recommendation) => setSelected(recommendation), []);
  const callbacks = (doneKey: 'accept.done' | 'reject.done') => ({
    onSuccess: () => {
      push(t(doneKey));
      setPending(null);
      setSelected(null);
    },
    onError: (actionError: unknown) => {
      // 409: khuyến nghị đã được quyết định nơi khác hoặc vừa hết hạn; danh sách đã tải lại nên đóng hộp thoại
      if ((actionError as { response?: { status?: number } }).response?.status === 409) {
        push(t('decide.stale'), 'error');
        setPending(null);
        setSelected(null);
        return;
      }
      push(apiErrorMessage(actionError), 'error');
    },
  });

  // Câu xác nhận nói đúng việc hệ thống sẽ làm khi chấp nhận
  const pendingRule = pending ? ruleOf(pending.recommendation) : null;
  let acceptDescription = '';
  if (pendingRule?.action.type === 'WORK_ORDER') acceptDescription = t('accept.workOrder', { title: pendingRule.action.title });
  if (pendingRule?.action.type === 'PARAMETER_CHANGE') {
    acceptDescription = t('accept.parameter', { param: t(`param.${pendingRule.action.key}`), value: exact(pendingRule.action.value, 2) });
  }

  // Danh sách trang trại đang tải thì khung chờ (FE_Design 13.5)
  if (scope.farms.length === 0 && scope.isLoading) return <LoadingSkeleton count={5} className="h-14 w-full" />;

  // Chưa chọn phạm vi → nhắc chọn; tải → khung chờ; lỗi → báo kèm Thử lại; rỗng → khung rỗng; còn lại là bảng
  let body = <EmptyState title={t('page.pickFarmTitle')} description={t('page.pickFarmHint')} />;
  if (hasScope && list.isLoading) body = <LoadingSkeleton count={5} className="h-14 w-full" />;
  if (hasScope && !list.isLoading && list.isError) {
    body = (
      <EmptyState
        title={t('common.loadError')}
        description={apiErrorMessage(list.error)}
        action={<Button variant="secondary" size="sm" onClick={() => void list.refetch()}>{t('common.retry')}</Button>}
      />
    );
  }
  if (hasScope && !list.isLoading && !list.isError && list.records.length === 0) {
    body = statusFilter === 'all'
      ? <EmptyFrame title={t('page.emptyTitle')} hint={t('page.emptyHint')} />
      : <EmptyFrame title={t('page.filteredEmptyTitle')} hint={t('page.filteredEmptyHint')} />;
  }
  if (hasScope && !list.isLoading && !list.isError && list.records.length > 0) {
    body = (
      <RecommendationTable
        recommendations={list.records}
        serverPagination={{ page, total: list.total, onChange: next => setPageState({ key: filterKey, page: next }) }}
        houseNames={houseNames}
        canDecide={canDecide}
        emptyNotice={t('page.emptyTitle')}
        onOpen={openDetail}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HeaderActions>
        <ScopeFilter scope={scope} lockZone />
      </HeaderActions>

      <SectionCard
        className="flex-1"
        description={t('page.short')}
        help={t('page.subtitle')}
        action={(
          <SelectMenu
            ariaLabel={t('page.statusLabel')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              ...STATUSES.map(status => ({ value: status, label: t(`status.${status}`) })),
              { value: 'all' as const, label: t('page.allStatuses') },
            ]}
          />
        )}
      >
        {body}
      </SectionCard>

      {/* Ngăn chi tiết đóng lại khi đang hỏi xác nhận, để popup không chồng lên ngăn */}
      <RecommendationDetailDrawer
        recommendation={pending ? null : selected}
        houseName={selected ? houseNames.get(selected.house_id) ?? '' : ''}
        canDecide={canDecide}
        onClose={() => setSelected(null)}
        onAccept={recommendation => setPending({ action: 'accept', recommendation })}
        onReject={recommendation => setPending({ action: 'reject', recommendation })}
      />

      <ConfirmModal
        open={pending?.action === 'accept'}
        title={t('accept.title')}
        description={acceptDescription}
        confirmLabel={t('detail.accept')}
        loading={actions.accept.isPending}
        onConfirm={() => pending && actions.accept.mutate(pending.recommendation._id, callbacks('accept.done'))}
        onCancel={() => setPending(null)}
      />
      <NoteActionModal
        open={pending?.action === 'reject'}
        onClose={() => setPending(null)}
        title={t('reject.title')}
        label={t('reject.label')}
        placeholder={t('reject.placeholder')}
        submitLabel={t('detail.reject')}
        required
        emptyMessage={t('reject.empty')}
        maxLength={REJECT_REASON_MAX_LENGTH}
        danger
        loading={actions.reject.isPending}
        onSubmit={reason => pending && actions.reject.mutate({ id: pending.recommendation._id, reason }, callbacks('reject.done'))}
      />
    </div>
  );
}
