import { useEffect, useState, type FormEvent } from 'react';
import { Button, FilterChip, Modal, Textarea } from '@/components/ui';
import { alertsDict } from '@/constants/alerts.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useAnswerOnsiteCheck } from '@/hooks/shared/useAlerts';
import { useToastStore } from '@/stores/toastStore';
import type { Alert, OnsiteObservation } from '@/types';

const OBSERVATIONS: OnsiteObservation[] = ['BIRDS_DISTURBED', 'WORK_OR_PEOPLE_NEARBY', 'RAIN', 'SENSOR_DIRTY_OR_FAULTY', 'NOTHING_UNUSUAL', 'OTHER'];
// Theo api-spec: 1 ảnh tối đa 5 MB, ghi chú tối đa 1000 ký tự
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const NOTE_MAX_LENGTH = 1000;

// Kỹ thuật viên của nhà trả lời yêu cầu kiểm tra tại chỗ: điều thấy được (bắt buộc), ghi chú, 1 ảnh; câu trả lời vào bằng chứng của chuyên gia
export default function OnsiteCheckModal({ alert, onClose }: { alert: Alert | null; onClose: () => void }): JSX.Element {
  const { t } = useTranslation(alertsDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const answer = useAnswerOnsiteCheck();
  const [observation, setObservation] = useState<OnsiteObservation | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | undefined>();
  const badPhoto = Boolean(photo && (photo.size > MAX_PHOTO_BYTES || !PHOTO_TYPES.includes(photo.type)));
  // Backend mở phiếu sửa ngay khi cảnh báo lỗi cảm biến được trả lời là cảm biến bẩn hoặc hỏng
  const opensWorkOrder = alert?.type === 'SENSOR_ANOMALY' && observation === 'SENSOR_DIRTY_OR_FAULTY';

  // Popup không unmount giữa các lần mở: xoá lựa chọn cũ mỗi lần mở
  useEffect(() => {
    if (!alert) return;
    setObservation(null);
    setNote('');
    setPhoto(undefined);
  }, [alert]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!alert || !observation) return;
    answer.mutate(
      { id: alert._id, observation, note: note.trim() || undefined, photo },
      {
        onSuccess: () => {
          push(t(opensWorkOrder ? 'onsite.doneWorkOrder' : 'onsite.done'));
          onClose();
        },
        // 409: đã có người trả lời; hook đã tải lại cảnh báo nên chỉ báo lỗi
        onError: error => push(apiErrorMessage(error), 'error'),
      },
    );
  }

  return (
    <Modal open={Boolean(alert)} onClose={onClose} title={t('onsite.answer')} size="lg" closeOnBackdrop={!answer.isPending}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <hr className="border-gray-200" />
        {alert && <p className="text-h2 text-charcoal">{t(`type.${alert.type}`)}</p>}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-h3 text-charcoal">{t('onsite.observation')}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OBSERVATIONS.map(item => (
              <FilterChip key={item} size="lg" active={observation === item} label={t(`observation.${item}`)} onClick={() => setObservation(item)} />
            ))}
          </div>
          {opensWorkOrder && <p className="text-sm text-warmGray">{t('onsite.opensWorkOrder')}</p>}
        </fieldset>
        <Textarea
          id="onsite-check-note"
          label={t('onsite.note')}
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          placeholder={t('onsite.notePlaceholder')}
          value={note}
          onChange={event => setNote(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="onsite-check-photo" className="label-caption">{t('onsite.photo')}</label>
          <input
            id="onsite-check-photo"
            type="file"
            accept={PHOTO_TYPES.join(',')}
            className="text-sm"
            onChange={event => setPhoto(event.target.files?.[0])}
          />
          {badPhoto && <p className="text-xs text-alertRed">{t('onsite.photoInvalid')}</p>}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={answer.isPending}>{t('onsite.cancel')}</Button>
          <Button type="submit" disabled={!observation || badPhoto} loading={answer.isPending}>{t('onsite.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
