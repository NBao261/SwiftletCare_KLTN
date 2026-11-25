import type { ReactNode } from 'react';
import { ArrowClockwiseIcon, CalendarBlankIcon, CpuIcon, GearSixIcon, MusicNotesIcon, VideoCameraIcon } from '@phosphor-icons/react';

import SimulatedBadge from '@/components/common/SimulatedBadge';
import { ActionsMenu, Badge, type ActionsMenuItem } from '@/components/ui';
import StatusDot from '@/components/common/StatusDot';
import { uptimeParts, type DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import { CAMERA_STATUS_TONE } from '@/components/features/farm-owner/devices/CameraSourceModal';
import { DETAIL_BUTTON_CLASS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { NO_VALUE } from '@/constants/display';
import { devicesDict } from '@/constants/devices.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import { wifiQuality } from '@/lib/helpers';

const BYTES_PER_KILOBYTE = 1024;

interface DeviceDetailCardProps {
  device: DeviceItem;
  // Tên Zone của node cảm biến; camera thuộc cả nhà
  zoneName?: string;
  // Node cảm biến: mở popup lịch loa ru / bài loa ru
  onOpenSchedule?: () => void;
  onOpenTracks?: () => void;
  // Farm Owner khởi động lại bộ điều khiển đang ONLINE
  onRestart?: () => void;
  // Camera: Farm Owner nhập địa chỉ camera IP cho nút AI
  onOpenCameraSource?: () => void;
  // dời, thay, gỡ bộ điều khiển (chỉ Farm Owner); rỗng thì không hiện menu
  moreActions?: ActionsMenuItem[];
}

// Thẻ chi tiết 1 thiết bị, nút theo quyền
export default function DeviceDetailCard({ device, zoneName, onOpenSchedule, onOpenTracks, onRestart, onOpenCameraSource, moreActions = [] }: DeviceDetailCardProps): JSX.Element {
  const { t, num, day, ago, dateTime } = useTranslation(devicesDict);
  const isSensor = device.type === 'sensor';
  const quality = wifiQuality(device.rssi);
  const uptime = isSensor ? uptimeParts(device.bootedAt) : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-charcoal">
            {isSensor ? <CpuIcon size={22} /> : <VideoCameraIcon size={22} />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-charcoal">{t(isSensor ? 'device.sensor' : 'device.camera')}</p>
            <p className="truncate text-xs text-warmGray">{t(isSensor ? 'device.sensorModel' : 'device.cameraModel')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-gray-100 px-2 py-1 text-caption text-graphite">{device.deviceId}</span>
          <SimulatedBadge simulated={device.simulated} />
          <StatusDot status={device.status} />
          {onOpenSchedule && (
            <button type="button" className={cn(DETAIL_BUTTON_CLASS, 'inline-flex items-center gap-1.5')} onClick={onOpenSchedule}>
              <CalendarBlankIcon size={14} />
              {t('action.schedule')}
            </button>
          )}
          {onOpenTracks && (
            <button type="button" className={cn(DETAIL_BUTTON_CLASS, 'inline-flex items-center gap-1.5')} onClick={onOpenTracks}>
              <MusicNotesIcon size={14} />
              {t('action.tracks')}
            </button>
          )}
          {onRestart && (
            <button type="button" className={cn(DETAIL_BUTTON_CLASS, 'inline-flex items-center gap-1.5')} onClick={onRestart}>
              <ArrowClockwiseIcon size={14} />
              {t('action.restart')}
            </button>
          )}
          {onOpenCameraSource && (
            <button type="button" className={cn(DETAIL_BUTTON_CLASS, 'inline-flex items-center gap-1.5')} onClick={onOpenCameraSource}>
              <GearSixIcon size={14} />
              {t('action.cameraSource')}
            </button>
          )}
          {moreActions.length > 0 && <ActionsMenu items={moreActions} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-gray-200 pt-4 sm:grid-cols-3">
        <InfoSection title={t('detail.sectionStatus')}>
          <InfoRow keep label={t('detail.location')} value={isSensor ? zoneName ?? NO_VALUE : t('detail.wholeHouse')} />
          <InfoRow keep label={t(isSensor ? 'device.firmware' : 'device.model')} value={device.version ? `v${device.version}` : NO_VALUE} />
          <InfoRow label={t('detail.activated')} value={day(device.registeredAt)} />
          {!isSensor && (
            <InfoRow
              keep
              label={t('detail.cameraStatus')}
              value={<Badge tone={device.cameraStatus ? CAMERA_STATUS_TONE[device.cameraStatus] : 'neutral'}>
                {t(device.cameraStatus ? `cameraStatus.${device.cameraStatus}` : 'cameraStatus.unknown')}
              </Badge>}
            />
          )}
        </InfoSection>
        <InfoSection title={t('detail.sectionHeartbeat')}>
          <InfoRow
            keep
            label={t('detail.lastHeartbeat')}
            value={ago(device.lastHeartbeat)}
            sub={device.lastHeartbeat ? dateTime(device.lastHeartbeat) : undefined}
          />
          <InfoRow label={t('detail.bootedAt')} value={device.bootedAt ? dateTime(device.bootedAt) : NO_VALUE} />
          <InfoRow label={t('detail.uptime')} value={uptime ? t('detail.uptimeValue', uptime) : NO_VALUE} />
          <InfoRow
            label={t('detail.freeHeap')}
            value={device.freeHeap !== undefined ? t('detail.freeHeapValue', { kb: num(device.freeHeap / BYTES_PER_KILOBYTE) }) : NO_VALUE}
          />
        </InfoSection>
        {/* Thiết bị chưa kết nối lần nào: không có Wi-Fi, IP nên bỏ cả nhóm (FO-04) */}
        {(device.ip || (quality && device.rssi !== undefined)) && <InfoSection title={t('detail.sectionNetwork')}>
          <InfoRow
            label={t('detail.wifi')}
            value={quality && device.rssi !== undefined ? `${device.rssi} dBm · ${t(`wifi.${quality}`)}` : NO_VALUE}
          />
          <InfoRow label={t('detail.ip')} value={device.ip ?? NO_VALUE} />
        </InfoSection>}
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="label-caption text-graphite">{title}</p>
      <dl className="flex flex-col gap-2">{children}</dl>
    </div>
  );
}

// Hàng không có số (chỉ "_") thì không vẽ, trừ hàng luôn cần thấy (vị trí, phiên bản, kết nối cuối)
function InfoRow({ label, value, sub, keep = false }: { label: string; value: ReactNode; sub?: string; keep?: boolean }): JSX.Element | null {
  if (value === NO_VALUE && !sub && !keep) return null;
  return (
    <div>
      <dt className="text-small text-warmGray">{label}</dt>
      <dd className={cn('text-body font-semibold', value === NO_VALUE ? 'text-warmGray' : 'text-charcoal')}>{value}</dd>
      {sub && <dd className="text-small text-warmGray">{sub}</dd>}
    </div>
  );
}
