import type { ReactNode } from 'react';

import { cameraHelpKeys } from '@/components/features/farm-owner/devices/cameraSource';
import { devicesDict } from '@/constants/devices.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { CameraStatus } from '@/types';

interface Props {
  status: CameraStatus | null | undefined;
  // Nút hoặc câu chỉ ra việc làm tiếp (VD mở Cài đặt camera)
  action?: ReactNode;
  className?: string;
}

// Gợi ý việc kiểm khi camera IP chưa có hình; không hiện khi camera đã có hình
export default function CameraSourceHelp({ status, action, className }: Props): JSX.Element | null {
  const { t } = useTranslation(devicesDict);
  const keys = cameraHelpKeys(status);
  if (keys.length === 0) return null;
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl bg-warmGray/10 px-4 py-3 text-sm', className)}>
      {keys.length > 1 ? (
        <>
          <p className="font-semibold text-charcoal">{t('help.title')}</p>
          <ol className="list-decimal space-y-1 pl-5 text-warmGray">{keys.map(key => <li key={key}>{t(key)}</li>)}</ol>
        </>
      ) : (
        <p className="text-warmGray">{t(keys[0])}</p>
      )}
      {action}
    </div>
  );
}
