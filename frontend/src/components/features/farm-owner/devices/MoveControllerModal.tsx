import { useState, type FormEvent } from 'react';
import { Button, Modal } from '@/components/ui';
import FarmHouseZonePicker, { type FarmHouseZonePickerValue } from '@/components/features/technician/devices/FarmHouseZonePicker';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import { devicesDict } from '@/constants/devices.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useReassignZone } from '@/hooks/shared/useDevices';
import { useToastStore } from '@/stores/toastStore';

interface MoveControllerModalProps {
  device: DeviceItem;
  onClose: () => void;
}

// FARM-FR-007b — Farm Owner dời bộ điều khiển sang Zone khác; offline thì backend dời khi thiết bị kết nối lại
export default function MoveControllerModal({ device, onClose }: MoveControllerModalProps): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const reassign = useReassignZone();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [target, setTarget] = useState<Partial<FarmHouseZonePickerValue>>({});
  const [submitted, setSubmitted] = useState(false);

  let zoneError: string | undefined;
  if (submitted && !target.zoneId) zoneError = t('move.zoneEmpty');
  if (target.zoneId && target.zoneId === device.zoneId) zoneError = t('move.sameZone');

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setSubmitted(true);
    if (!target.zoneId || target.zoneId === device.zoneId) return;
    reassign.mutate({ nodeId: device.id, zoneId: target.zoneId }, {
      onSuccess: () => {
        push(t('move.done', { id: device.deviceId }));
        onClose();
      },
      onError: error => push(apiErrorMessage(error, t('move.failed')), 'error'),
    });
  }

  return (
    <Modal open onClose={onClose} title={t('move.title', { id: device.deviceId })}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-warmGray">{t('move.desc')}</p>
        <FarmHouseZonePicker value={target} onChange={setTarget} />
        {zoneError && <p className="text-xs text-alertRed">{zoneError}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={reassign.isPending}>{t('form.cancel')}</Button>
          <Button type="submit" className="flex-1" loading={reassign.isPending}>{t('move.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
