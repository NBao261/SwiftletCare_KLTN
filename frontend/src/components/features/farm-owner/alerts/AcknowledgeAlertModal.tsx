import { useEffect, useState, type FormEvent } from 'react';
import { Button, FilterChip, Modal, Textarea } from '@/components/ui';
import { alertsDict } from '@/constants/alerts.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useAcknowledgeAlert } from '@/hooks/shared/useAlerts';
import { useToastStore } from '@/stores/toastStore';
import type { Alert, AlertType, SiteCause } from '@/types';

// Cảnh báo thiết bị có ô nguyên nhân — khớp AUTO_WORK_ORDER_TYPES của backend và isCauseAlertType của mobile (ALERT-FR-018)
const CAUSE_ALERT_TYPES: ReadonlySet<AlertType> = new Set<AlertType>([
  'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'SPEAKER_FAILURE',
]);
const SITE_CAUSES: SiteCause[] = ['WATER', 'NOZZLE', 'PUMP', 'FAN', 'DOOR', 'SENSOR', 'SPEAKER', 'OTHER'];
// Giới hạn ghi chú của PUT /alerts/{id}/acknowledge (api-spec)
const NOTE_MAX_LENGTH = 1000;

interface AcknowledgeAlertModalProps {
  // null = đóng
  alert: Alert | null;
  onClose: () => void;
}

// ALERT-FR-009, 018 — Farm Owner hoặc Farm Technician (nhà được giao) xác nhận cảnh báo kèm ghi chú; cảnh báo thiết bị có thêm nguyên nhân tìm thấy tại chỗ (tuỳ chọn)
export default function AcknowledgeAlertModal({ alert, onClose }: AcknowledgeAlertModalProps): JSX.Element {
  const { t } = useTranslation(alertsDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const acknowledge = useAcknowledgeAlert();
  const [cause, setCause] = useState<SiteCause | null>(null);
  const [note, setNote] = useState('');
  const hasCause = alert ? CAUSE_ALERT_TYPES.has(alert.type) : false;

  // Popup không unmount giữa các lần mở — xoá lựa chọn cũ mỗi lần mở
  useEffect(() => {
    if (!alert) return;
    setCause(null);
    setNote('');
  }, [alert]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!alert) return;
    acknowledge.mutate(
      { id: alert._id, note: note.trim() || undefined, cause: hasCause && cause ? cause : undefined },
      {
        onSuccess: () => {
          push(t('ack.done'));
          onClose();
        },
        onError: error => push(apiErrorMessage(error), 'error'),
      },
    );
  }

  return (
    <Modal open={Boolean(alert)} onClose={onClose} title={t('ack.title')} titleClassName="text-h1" size="lg" closeOnBackdrop={!acknowledge.isPending}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <hr className="border-gray-200" />
        {alert && <p className="text-h2 text-charcoal">{alert.title}</p>}
        {/* Nguyên nhân: tên mục đậm, gợi ý cỡ chữ thường, 8 nút cỡ lớn xếp lưới đều 2 hàng × 4 (mobile 2 cột) */}
        {hasCause && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-h3 text-charcoal">{t('ack.cause')}</legend>
            <p className="text-sm text-warmGray">{t('ack.causeHint')}</p>
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
        )}
        <Textarea
          id="acknowledge-note"
          label={t('ack.note')}
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          placeholder={t('ack.notePlaceholder')}
          value={note}
          onChange={event => setNote(event.target.value)}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={acknowledge.isPending}>{t('ack.cancel')}</Button>
          <Button type="submit" loading={acknowledge.isPending}>{t('ack.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
