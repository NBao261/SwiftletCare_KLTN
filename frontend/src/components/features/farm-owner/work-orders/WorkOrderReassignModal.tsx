import { useEffect, useState } from 'react';
import { Button, Modal, SelectMenu } from '@/components/ui';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useWorkOrderActions } from '@/hooks/farm-owner/useWorkOrders';
import { useToastStore } from '@/stores/toastStore';
import type { WorkOrder } from '@/types';

interface WorkOrderReassignModalProps {
  // null = đóng
  workOrder: WorkOrder | null;
  houseName: string;
  // Thợ đang được giao nhà, trừ người đang nhận (reassignCandidates)
  candidates: { id: string; name: string }[];
  onClose: () => void;
}

// OPS-FR-004 — giao lại cho 1 kỹ thuật viên của nhà; backend kiểm thợ còn được giao và còn hoạt động (400)
export default function WorkOrderReassignModal({ workOrder, houseName, candidates, onClose }: WorkOrderReassignModalProps): JSX.Element {
  const { t } = useTranslation(workOrderDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const { reassign } = useWorkOrderActions();
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => {
    if (workOrder) setAssigneeId('');
  }, [workOrder]);

  function handleSave(): void {
    if (!workOrder || !assigneeId) return;
    reassign.mutate(
      { workOrder, assigneeId },
      {
        onSuccess: () => {
          push(t('reassign.done'));
          onClose();
        },
        onError: error => push(apiErrorMessage(error), 'error'),
      },
    );
  }

  return (
    <Modal open={Boolean(workOrder)} onClose={onClose} title={t('reassign.title')} closeOnBackdrop={!reassign.isPending}>
      <div className="flex flex-col gap-5">
        <hr className="border-gray-200" />
        {candidates.length === 0 ? (
          <p className="text-sm text-warmGray">{t('reassign.none')}</p>
        ) : (
          <>
            <p className="text-sm text-warmGray">{t('reassign.desc', { house: houseName })}</p>
            <div className="flex flex-col gap-1.5">
              <span className="label-caption">{t('reassign.label')}</span>
              <SelectMenu
                field
                highlightFiltered={false}
                ariaLabel={t('reassign.label')}
                value={assigneeId}
                onChange={setAssigneeId}
                options={[{ value: '', label: t('reassign.choose') }, ...candidates.map(candidate => ({ value: candidate.id, label: candidate.name }))]}
              />
            </div>
          </>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={reassign.isPending}>{t('form.cancel')}</Button>
          {candidates.length > 0 && (
            <Button onClick={handleSave} disabled={!assigneeId} loading={reassign.isPending}>{t('form.save')}</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
