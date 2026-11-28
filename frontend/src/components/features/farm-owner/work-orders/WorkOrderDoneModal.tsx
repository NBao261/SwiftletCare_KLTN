import { useEffect, useState, type FormEvent } from 'react';
import { Button, FilterChip, Modal, Textarea } from '@/components/ui';
import { missingMaintenancePhoto } from '@/components/features/farm-owner/work-orders/maintenancePhoto';
import { CAUSE_ALERT_TYPES, SITE_CAUSES } from '@/constants/siteCause';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useWorkOrder, useWorkOrderActions } from '@/hooks/farm-owner/useWorkOrders';
import { useToastStore } from '@/stores/toastStore';
import type { SiteCause, WorkOrder } from '@/types';
import FieldError from '@/components/ui/FieldError'

// Giới hạn ảnh và ghi chú theo api-spec
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const NOTE_MAX_LENGTH = 2000;

// Nguyên nhân tại chỗ bắt buộc với cảnh báo thiết bị
export default function WorkOrderDoneModal({ workOrder, onClose }: { workOrder: WorkOrder | null; onClose: () => void }): JSX.Element {
  const { t } = useTranslation(workOrderDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const { complete } = useWorkOrderActions();
  // Kỹ thuật viên báo xong thì chủ nhà yến duyệt, không phải người bấm
  const isTechnician = usePermission('FARM_TECHNICIAN');
  // Danh sách không kèm ảnh: đọc chi tiết để biết phiếu (mở lại) đã có bao nhiêu ảnh
  const { data: detail } = useWorkOrder(workOrder?._id ?? null);
  const [cause, setCause] = useState<SiteCause | null>(null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const needsCause = Boolean(workOrder?.alert_type && CAUSE_ALERT_TYPES.has(workOrder.alert_type));
  const photoSlots = Math.max(MAX_PHOTOS - (detail?.photo_urls?.length ?? 0), 0);
  // Bảo trì chưa có ảnh nào thì chưa báo xong được
  const needsPhoto = missingMaintenancePhoto(detail ?? workOrder, photos.length);
  const badPhoto = photos.some(photo => photo.size > MAX_PHOTO_BYTES || !PHOTO_TYPES.includes(photo.type));

  // Popup không unmount giữa các lần mở: xoá lựa chọn cũ mỗi lần mở
  useEffect(() => {
    if (!workOrder) return;
    setCause(null);
    setNote('');
    setPhotos([]);
  }, [workOrder]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!workOrder) return;
    complete.mutate(
      { workOrder, input: { cause: cause ?? undefined, work_note: note.trim() || undefined, photos } },
      {
        // Phiếu gắn cảnh báo sang VERIFYING; phòng ngừa hoặc mở tay sang thẳng AWAITING_APPROVAL
        onSuccess: response => {
          const isVerifying = response.data.data.status === 'VERIFYING';
          if (isTechnician) push(t(isVerifying ? 'done.doneVerifyingTechnician' : 'done.doneAwaitingTechnician'));
          else push(t(isVerifying ? 'done.doneVerifying' : 'done.doneAwaiting'));
          onClose();
        },
        onError: error => push(apiErrorMessage(error), 'error'),
      },
    );
  }

  return (
    <Modal open={Boolean(workOrder)} onClose={onClose} title={t('done.title')} size="lg" closeOnBackdrop={!complete.isPending}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <hr className="border-gray-200" />
        {workOrder && <p className="text-h2 text-charcoal">{workOrder.title}</p>}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-h3 text-charcoal">{t('done.cause')}</legend>
          <p className="text-sm text-warmGray">{t(needsCause ? 'done.causeRequired' : 'done.causeHint')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SITE_CAUSES.map(item => (
              <FilterChip
                key={item}
                size="lg"
                active={cause === item}
                label={t(`cause.${item}`)}
                onClick={() => setCause(current => (current === item ? null : item))}
              />
            ))}
          </div>
        </fieldset>
        <Textarea
          id="work-order-note"
          label={t('done.note')}
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          placeholder={t('done.notePlaceholder')}
          value={note}
          onChange={event => setNote(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="work-order-photos" className="label-caption">{t('done.photos', { n: photoSlots })}</label>
          <input
            id="work-order-photos"
            type="file"
            accept={PHOTO_TYPES.join(',')}
            multiple
            disabled={photoSlots <= 0}
            className="text-sm"
            onChange={event => setPhotos(Array.from(event.target.files ?? []).slice(0, photoSlots))}
          />
          {workOrder?.kind === 'PREVENTIVE' && <p className={needsPhoto ? 'text-xs font-semibold text-alertRed' : 'text-xs text-warmGray'}>{t('done.photoRequired')}</p>}
          {badPhoto && <FieldError>{t('done.photoInvalid')}</FieldError>}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={complete.isPending}>{t('form.cancel')}</Button>
          <Button type="submit" disabled={(needsCause && !cause) || badPhoto || needsPhoto} loading={complete.isPending}>{t('action.done')}</Button>
        </div>
      </form>
    </Modal>
  );
}
