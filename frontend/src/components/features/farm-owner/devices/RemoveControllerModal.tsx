import NoteActionModal from '@/components/ui/NoteActionModal';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import { devicesDict } from '@/constants/devices.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useDecommissionDevice } from '@/hooks/shared/useDevices';
import { useToastStore } from '@/stores/toastStore';

interface RemoveControllerModalProps {
  device: DeviceItem;
  onClose: () => void;
}

// Khôi phục được trong 24 giờ; thiết bị ONLINE thì cảnh báo trước rồi gửi force
export default function RemoveControllerModal({ device, onClose }: RemoveControllerModalProps): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const decommission = useDecommissionDevice();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const isOnline = device.status === 'ONLINE';

  function handleSubmit(reason: string): void {
    decommission.mutate({ nodeId: device.id, reason, force: isOnline }, {
      onSuccess: () => {
        push(t('remove.done', { id: device.deviceId }));
        onClose();
      },
      onError: error => push(apiErrorMessage(error, t('remove.failed')), 'error'),
    });
  }

  return (
    <NoteActionModal
      open
      onClose={onClose}
      title={t('remove.title', { id: device.deviceId })}
      label={t('remove.reason')}
      placeholder={t('remove.reasonPlaceholder')}
      hint={t(isOnline ? 'remove.hintOnline' : 'remove.hint')}
      submitLabel={t('remove.submit')}
      required
      maxLength={500}
      emptyMessage={t('form.reasonEmpty')}
      danger
      loading={decommission.isPending}
      onSubmit={handleSubmit}
    />
  );
}
