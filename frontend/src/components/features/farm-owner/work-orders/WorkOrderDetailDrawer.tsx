import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WORK_ORDER_STATUS_TONE, workOrderActions, type OwnerAction, type WorkOrderActor } from '@/components/features/farm-owner/work-orders/workOrder.utils';
import { Badge, Button, EmptyState, LoadingSkeleton, type BadgeTone } from '@/components/ui';
import { Drawer } from '@/components/ui/Drawer';
import { NO_VALUE } from '@/constants/display';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useWorkOrder, useWorkOrderActions } from '@/hooks/farm-owner/useWorkOrders';
import { useToastStore } from '@/stores/toastStore';
import type { ChecklistResult, WorkOrder } from '@/types';

// Một dòng nhãn: giá trị
function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-warmGray">{label}</dt>
      <dd className="text-sm font-semibold text-charcoal">{children}</dd>
    </div>
  );
}

// Nút thao tác: việc chính nổi bật, huỷ màu nguy hiểm
const ACTION_VARIANT: Record<OwnerAction, 'primary' | 'secondary' | 'danger'> = {
  start: 'primary', done: 'primary', approve: 'primary', reopen: 'secondary', reassign: 'secondary', cancel: 'danger',
};

// Mục checklist: đạt xanh, hỏng đỏ
const CHECKLIST_TONE: Record<ChecklistResult, BadgeTone> = { OK: 'positive', DEFECT: 'critical' };

interface WorkOrderDetailDrawerProps {
  // Work Order đang mở; null = đóng
  workOrderId: string | null;
  houseNames: Map<string, string>;
  // Tên thành viên farm theo id, cho người đổi trạng thái trong diễn biến
  personNames: Map<string, string>;
  // Chỉ Farm Owner có nút thao tác; Domain Expert chỉ xem
  actor: WorkOrderActor;
  onAction: (action: OwnerAction, workOrder: WorkOrder) => void;
  onClose: () => void;
}

// Chi tiết Work Order
export default function WorkOrderDetailDrawer({
  workOrderId, houseNames, personNames, actor, onAction, onClose,
}: WorkOrderDetailDrawerProps): JSX.Element {
  const { t, dateTime } = useTranslation(workOrderDict);
  const apiErrorMessage = useApiErrorMessage();
  const { data: workOrder, isLoading, isError, error, refetch } = useWorkOrder(workOrderId);
  const actions = workOrder ? workOrderActions(workOrder, actor) : [];
  const push = useToastStore(state => state.push);
  const { recordChecklist } = useWorkOrderActions();
  // Farm Owner ghi kết quả từng mục khi tự làm phiếu phòng ngừa (ghi chú và ảnh từng mục ở mobile)
  const canRecordChecklist = actor !== 'reader' && workOrder?.status === 'IN_PROGRESS';
  // Đổi kết quả thì giữ ghi chú cũ, vì backend xoá ghi chú khi không gửi
  function recordItem(itemIndex: number, result: ChecklistResult, current: { result: ChecklistResult | null; note?: string | null }): void {
    if (!workOrder || current.result === result) return;
    recordChecklist.mutate(
      { workOrder, itemIndex, result, note: current.note },
      { onSuccess: () => push(t('checklist.saved')), onError: error => push(apiErrorMessage(error), 'error') },
    );
  }

  return (
    <Drawer open={Boolean(workOrderId)} onClose={onClose} title={t('detail.title')}>
      {/* Drawer không tự cuộn: vùng cuộn đặt ở đây như HealthDayDrawer */}
      <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-2">
        {isLoading ? (
          <LoadingSkeleton count={4} className="h-16 w-full" />
        ) : isError || !workOrder ? (
          <EmptyState
            title={t('detail.loadFailed')}
            description={apiErrorMessage(error)}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>}
          />
        ) : (
          <>
            {/* Việc cần làm + trạng thái */}
            <section className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-base font-semibold text-charcoal">{workOrder.title}</p>
                <Badge tone={WORK_ORDER_STATUS_TONE[workOrder.status]}>{t(`status.${workOrder.status}`)}</Badge>
              </div>
              {workOrder.description && <p className="whitespace-pre-line text-sm text-graphite">{workOrder.description}</p>}
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-warmGray/30 p-3">
                <Field label={t('detail.house')}>{houseNames.get(workOrder.house_id) ?? NO_VALUE}</Field>
                <Field label={t('detail.origin')}>{t(`origin.${workOrder.origin}`)}</Field>
                {workOrder.alert_type && <Field label={t('detail.alertType')}>{t(`alertType.${workOrder.alert_type}`)}</Field>}
                <Field label={t('detail.assignee')}>{workOrder.assignee?.full_name ?? t('cell.unassigned')}</Field>
                <Field label={t('detail.openedBy')}>{workOrder.opened_by?.full_name ?? t('detail.system')}</Field>
                <Field label={t('detail.openedAt')}>{dateTime(workOrder.opened_at)}</Field>
                {workOrder.escalated_at && <Field label={t('detail.escalatedAt')}>{dateTime(workOrder.escalated_at)}</Field>}
              </dl>
            </section>

            {/* checklist của phiếu phòng ngừa: kết quả, ghi chú, ảnh từng mục */}
            {workOrder.kind === 'PREVENTIVE' && (workOrder.checklist ?? []).length > 0 && (
              <section className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-charcoal">{t('detail.checklist')}</p>
                <ol className="flex flex-col gap-2">
                  {(workOrder.checklist ?? []).map((entry, index) => (
                    <li key={`${index}-${entry.item}`} className="flex flex-col gap-1 rounded-xl border border-warmGray/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-words text-sm text-charcoal">{index + 1}. {entry.item}</span>
                        {entry.result ? (
                          <Badge tone={CHECKLIST_TONE[entry.result]}>{t(`checklist.${entry.result}`)}</Badge>
                        ) : (
                          <span className="shrink-0 text-xs italic text-warmGray">{t('detail.checklistPending')}</span>
                        )}
                      </div>
                      {entry.note && <p className="whitespace-pre-line break-words text-xs text-graphite">{entry.note}</p>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-warmGray">
                        {entry.at && <span>{dateTime(entry.at)} · {entry.by ? personNames.get(entry.by) ?? NO_VALUE : NO_VALUE}</span>}
                        {entry.photo_url && (
                          <a href={entry.photo_url} target="_blank" rel="noreferrer" className="font-semibold text-charcoal underline">
                            {t('detail.checklistPhoto')}
                          </a>
                        )}
                      </div>
                      {entry.repair_work_order_id && <span className="text-xs font-semibold text-safetyOrange">{t('detail.checklistRepair')}</span>}
                      {canRecordChecklist && (
                        <div className="flex gap-2 pt-1">
                          {(['OK', 'DEFECT'] as const).map(result => (
                            <Button
                              key={result}
                              size="sm"
                              variant={entry.result === result ? 'primary' : 'secondary'}
                              disabled={recordChecklist.isPending}
                              onClick={() => recordItem(index, result, entry)}
                            >
                              {t(`checklist.${result}`)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Kết quả tại nhà: nguyên nhân, việc đã làm, ảnh; huỷ thì lý do huỷ */}
            <section className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-charcoal">{t('detail.record')}</p>
              {workOrder.status === 'CANCELLED' ? (
                <dl className="rounded-xl border border-warmGray/30 p-3">
                  <Field label={t('detail.cancelReason')}>{workOrder.cancel_reason ?? NO_VALUE}</Field>
                </dl>
              ) : workOrder.done_at || workOrder.result ? (
                <div className="flex flex-col gap-3 rounded-xl border border-warmGray/30 p-3">
                  <dl className="grid grid-cols-2 gap-3">
                    <Field label={t('detail.cause')}>{workOrder.cause ? t(`cause.${workOrder.cause}`) : NO_VALUE}</Field>
                    <Field label={t('detail.result')}>{workOrder.result ? t(`result.${workOrder.result}`) : NO_VALUE}</Field>
                  </dl>
                  {workOrder.work_note && (
                    <dl><Field label={t('detail.workNote')}><span className="whitespace-pre-line font-normal">{workOrder.work_note}</span></Field></dl>
                  )}
                  {(workOrder.photo_urls ?? []).length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-warmGray">{t('detail.photos')}</span>
                      <div className="grid grid-cols-3 gap-2">
                        {(workOrder.photo_urls ?? []).map((url, index) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-warmGray/20">
                            <img src={url} alt={t('detail.photoAlt', { n: index + 1 })} className="aspect-square w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-warmGray">{t('detail.noRecord')}</p>
              )}
            </section>

            {/* Diễn biến trạng thái, cũ trước */}
            <section className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-charcoal">{t('detail.history')}</p>
              <ol className="flex flex-col gap-2 border-l-2 border-warmGray/30 pl-3">
                {workOrder.history.map(entry => {
                  // Trạng thái không đổi là một lần giao lại; không hiện nguyên văn câu hệ thống
                  const isReassign = entry.from === entry.to;
                  const note = entry.by && !isReassign ? entry.note : null;
                  return (
                    <li key={`${entry.at}-${entry.to}`} className="flex flex-col gap-0.5 text-sm">
                      <span className="font-semibold text-charcoal">{isReassign ? t('action.reassign') : t(`status.${entry.to}`)}</span>
                      <span className="text-xs text-warmGray">
                        {dateTime(entry.at)} · {entry.by ? personNames.get(entry.by) ?? NO_VALUE : t('detail.system')}
                      </span>
                      {note && <span className="text-xs text-graphite">{t('detail.historyNote', { note })}</span>}
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}
      </div>

      {/* Phiếu bảo trì chưa đóng không huỷ được: chỉ chỗ xoá kế hoạch */}
      {workOrder && actor !== 'reader' && workOrder.kind === 'PREVENTIVE' && ['OPEN', 'IN_PROGRESS'].includes(workOrder.status) && (
        <p className="pt-3 text-xs text-warmGray">
          {t('detail.preventiveHint')} <Link to="/maintenance" className="font-semibold text-charcoal underline">{t('detail.maintenanceLink')}</Link>.
        </p>
      )}

      {/* Nút thao tác theo trạng thái, chỉ Farm Owner */}
      {workOrder && actions.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-warmGray/15 pt-4">
          {actions.map(action => (
            <Button
              key={action}
              size="sm"
              variant={ACTION_VARIANT[action]}
              onClick={() => onAction(action, workOrder)}
            >
              {t(`action.${action}`)}
            </Button>
          ))}
        </div>
      )}
    </Drawer>
  );
}
