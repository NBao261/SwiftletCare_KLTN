import { useState } from 'react';

import { Button } from '@/components/ui';
import NoteActionModal from '@/components/ui/NoteActionModal';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import { hoursLeftToRestore } from '@/components/features/farm-owner/devices/removedDevices';
import { NO_VALUE } from '@/constants/display';
import { DEVICE_SETUP_ROLES } from '@/constants/roles';
import { devicesDict } from '@/constants/devices.i18n';
import { usePermission } from '@/hooks/common/usePermission';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useRemovedDevices, useRestoreDevice, type RemovedDeviceRow } from '@/hooks/farm-owner/useRemovedDevices';
import { useToastStore } from '@/stores/toastStore';

// thiết bị gỡ trong 24 giờ (Farm Owner, hoặc Farm Technician ở nhà được giao), khôi phục kèm lý do; không có thiết bị nào thì không hiện khung
export default function RemovedDevicesSection(): JSX.Element | null {
  const { t, dateTime } = useTranslation(devicesDict);
  const canRestoreDevices = usePermission(...DEVICE_SETUP_ROLES);
  const { data: rows, isError, error, refetch } = useRemovedDevices(canRestoreDevices);
  const restore = useRestoreDevice();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [target, setTarget] = useState<RemovedDeviceRow | null>(null);

  if (!canRestoreDevices) return null;
  // Tải lỗi: vẫn hiện khung kèm câu lỗi và nút thử lại, không giả như chưa gỡ thiết bị nào (FE_Design 13.5)
  if (isError) {
    return (
      <FarmFrame title={t('removed.title')} description={t('removed.subtitle')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-warmGray">{apiErrorMessage(error, t('removed.loadFailed'))}</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>{t('list.retry')}</Button>
        </div>
      </FarmFrame>
    );
  }
  // Chỉ ẩn khung khi đã tải xong và không có thiết bị nào gỡ trong 24 giờ
  if (!rows || rows.length === 0) return null;

  return (
    <FarmFrame title={t('removed.title')} description={t('removed.subtitle')}>
      <ul className="flex flex-col divide-y divide-gray-100">
        {rows.map(row => (
          <li key={row.device._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-charcoal">
                {row.device.device_id} · {t(row.kind === 'sensor' ? 'removed.sensor' : 'removed.camera')}
              </p>
              <p className="text-xs text-warmGray">
                {t('removed.removedAt', { time: dateTime(row.device.decommissioned_at), reason: row.device.decommission_reason ?? NO_VALUE })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-graphite">{t('removed.left', { hours: hoursLeftToRestore(row.device.restorable_until) })}</span>
              <Button size="sm" variant="secondary" onClick={() => setTarget(row)}>{t('removed.restore')}</Button>
            </div>
          </li>
        ))}
      </ul>

      <NoteActionModal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={t('removed.modalTitle', { id: target?.device.device_id ?? '' })}
        label={t('removed.reasonLabel')}
        placeholder={t('removed.reasonPlaceholder')}
        submitLabel={t('removed.restore')}
        required
        emptyMessage={t('removed.reasonEmpty')}
        loading={restore.isPending}
        onSubmit={reason => {
          if (!target) return;
          restore.mutate({ kind: target.kind, id: target.device._id, reason }, {
            onSuccess: () => { push(t('removed.restored', { id: target.device.device_id })); setTarget(null); },
            // 409: quá 24 giờ, device_id đã đăng ký lại, hoặc đã có thiết bị khác thế chỗ
            onError: restoreError => { push(apiErrorMessage(restoreError, t('removed.failed')), 'error'); setTarget(null); },
          });
        }}
      />
    </FarmFrame>
  );
}
