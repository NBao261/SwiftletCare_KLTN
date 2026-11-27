import { useState, type FormEvent } from 'react';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import { devicesDict } from '@/constants/devices.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useReplaceSensorNode } from '@/hooks/shared/useDevices';
import { useToastStore } from '@/stores/toastStore';
import { ACTIVATION_KEY_MAX_LENGTH, deviceIdError, isActivationKeyTooLong } from '@/validations/common/deviceId.validation';

interface ReplaceControllerModalProps {
  device: DeviceItem;
  onClose: () => void;
}

// thay bộ điều khiển hỏng: backend đăng ký thiết bị mới trước, sai mã kích hoạt thì thiết bị cũ giữ nguyên
export default function ReplaceControllerModal({ device, onClose }: ReplaceControllerModalProps): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const replace = useReplaceSensorNode();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [newDeviceId, setNewDeviceId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const newId = newDeviceId.trim();
  let idError: string | undefined;
  if (submitted && !newId) idError = t('replace.idEmpty');
  else if (newId && deviceIdError(newId)) idError = deviceIdError(newId);
  if (newId && newId === device.deviceId) idError = t('replace.idSame');
  const keyError = submitted && !secretKey.trim() ? t('replace.keyEmpty') : isActivationKeyTooLong(secretKey) ? `Mã kích hoạt tối đa ${ACTIVATION_KEY_MAX_LENGTH} ký tự` : undefined;
  const reasonError = submitted && !reason.trim() ? t('form.reasonEmpty') : undefined;

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setSubmitted(true);
    if (deviceIdError(newId) || newId === device.deviceId || !secretKey.trim() || isActivationKeyTooLong(secretKey) || !reason.trim()) return;
    replace.mutate(
      { nodeId: device.id, input: { new_device_id: newId, secret_key: secretKey.trim(), reason: reason.trim() } },
      {
        onSuccess: () => {
          push(t('replace.done', { old: device.deviceId, new: newId }));
          onClose();
        },
        onError: error => push(apiErrorMessage(error, t('replace.failed')), 'error'),
      },
    );
  }

  return (
    <Modal open onClose={onClose} title={t('replace.title', { id: device.deviceId })}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-warmGray">{t('replace.desc')}</p>
        <Input
          id="replace-new-device-id"
          label={t('replace.newId')}
          required
          value={newDeviceId}
          onChange={event => setNewDeviceId(event.target.value)}
          placeholder={t('replace.newIdPlaceholder')}
          error={idError}
        />
        <Input
          id="replace-secret-key"
          label={t('replace.key')}
          required
          value={secretKey}
          onChange={event => setSecretKey(event.target.value)}
          placeholder={t('replace.keyPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          error={keyError}
        />
        <Textarea
          id="replace-reason"
          label={t('replace.reason')}
          required
          rows={2}
          maxLength={500}
          placeholder={t('replace.reasonPlaceholder')}
          value={reason}
          onChange={event => setReason(event.target.value)}
          error={reasonError}
        />
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={replace.isPending}>{t('form.cancel')}</Button>
          <Button type="submit" className="flex-1" loading={replace.isPending}>{t('replace.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
