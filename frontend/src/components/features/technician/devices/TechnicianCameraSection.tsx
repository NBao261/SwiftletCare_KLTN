import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';

import StatusDot from '@/components/common/StatusDot';
import CameraSourceModal, { CAMERA_STATUS_TONE } from '@/components/features/farm-owner/devices/CameraSourceModal';
import { Badge, Button, SectionCard } from '@/components/ui';
import { devicesDict } from '@/constants/devices.i18n';
import { houseCamerasQuery } from '@/hooks/farm-owner/useHouseCameras';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { CameraNode, House } from '@/types';

interface CameraRow {
  camera: CameraNode;
  houseName: string;
}

// Camera đếm chim của các nhà được giao: tình trạng camera IP và nút nhập địa chỉ camera (FARM-FR-004b)
export default function TechnicianCameraSection({ houses }: { houses: Pick<House, '_id' | 'name'>[] }): JSX.Element | null {
  const { t } = useTranslation(devicesDict);
  const [editing, setEditing] = useState<{ id: string; deviceId: string }>();
  const results = useQueries({ queries: houses.map(house => houseCamerasQuery(house._id)) });

  const rows: CameraRow[] = houses.flatMap((house, index) =>
    (results[index]?.data ?? []).map(camera => ({ camera, houseName: house.name })));
  if (rows.length === 0) return null;

  return (
    <SectionCard title={t('techCamera.title')} description={t('techCamera.description')}>
      <ul className="flex flex-col divide-y divide-warmGray/15 overflow-hidden rounded-2xl border border-warmGray/15 bg-white">
        {rows.map(({ camera, houseName }) => (
          <li key={camera._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-charcoal">{t('list.cameraName', { id: camera.device_id })}</p>
              <p className="truncate text-xs text-warmGray">{houseName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusDot status={camera.status} colored />
              <Badge tone={camera.camera_status ? CAMERA_STATUS_TONE[camera.camera_status] : 'neutral'}>
                {t(camera.camera_status ? `cameraStatus.${camera.camera_status}` : 'cameraStatus.unknown')}
              </Badge>
              <Button size="sm" variant="secondary" onClick={() => setEditing({ id: camera._id, deviceId: camera.device_id })}>
                {t('help.open')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <CameraSourceModal camera={editing} onClose={() => setEditing(undefined)} />
    </SectionCard>
  );
}
