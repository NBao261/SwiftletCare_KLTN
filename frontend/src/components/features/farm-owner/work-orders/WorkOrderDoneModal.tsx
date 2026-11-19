import { useEffect, useState, type FormEvent } from 'react';
import { Button, FilterChip, Modal, Textarea } from '@/components/ui';
import { CAUSE_ALERT_TYPES, SITE_CAUSES } from '@/constants/siteCause';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useWorkOrderActions } from '@/hooks/farm-owner/useWorkOrders';
import { useToastStore } from '@/stores/toastStore';
import type { SiteCause, WorkOrder } from '@/types';

// Report 3 §4.5 — tối đa 5 ảnh cho cả Work Order (MAX_WORK_ORDER_PHOTOS), mỗi ảnh ≤ 5 MB; ghi chú việc đã làm ≤ 2.000 ký tự (api-spec)
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const NOTE_MAX_LENGTH = 2000;

// OPS-FR-002, ALERT-FR-018 — Farm Owner báo xong Work Order đang làm: nguyên nhân tìm thấy tại chỗ (bắt buộc với cảnh báo thiết bị), việc đã làm, ảnh
export default function WorkOrderDoneModal({ workOrder, onClose }: { workOrder: WorkOrder | null; onClose: () => void }): JSX.Element {
  const { t } = useTranslation(workOrderDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const { complete } = useWorkOrderActions();
  const [cause, setCause] = useState<SiteCause | null>(null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const needsCause = Boolean(workOrder?.alert_type && CAUSE_ALERT_TYPES.has(workOrder.alert_type));
  const photoSlots = MAX_PHOTOS - (workOrder?.photo_urls?.length ?? 0);
  const tooBig = photos.some(photo => photo.size > MAX_PHOTO_BYTES);

  // Popup không unmount giữa các lần mở — xoá lựa chọn cũ mỗi lần mở
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
        onSuccess: () => {
          push(t('done.done'));
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
          <label htmlFor="work-order-photos" className="label-caption">{t('done.photos', { n: Math.max(photoSlots, 0) })}</label>
          <input
            id="work-order-photos"
            type="file"
            accept="image/*"
            multiple
            disabled={photoSlots <= 0}
            className="text-sm"
            onChange={event => setPhotos(Array.from(event.target.files ?? []).slice(0, Math.max(photoSlots, 0)))}
          />
          {tooBig && <p className="text-xs text-alertRed">{t('done.photoTooBig')}</p>}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={complete.isPending}>{t('form.cancel')}</Button>
          <Button type="submit" disabled={(needsCause && !cause) || tooBig} loading={complete.isPending}>{t('action.done')}</Button>
        </div>
      </form>
    </Modal>
  );
}
