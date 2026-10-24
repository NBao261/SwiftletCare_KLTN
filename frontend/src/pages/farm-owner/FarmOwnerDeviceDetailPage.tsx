import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CpuIcon, InfoIcon, SlidersHorizontalIcon, SquaresFourIcon, WarningIcon, WifiHighIcon } from '@phosphor-icons/react';

import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import DeviceDetailCard from '@/components/features/farm-owner/devices/DeviceDetailCard';
import DeviceSection from '@/components/features/farm-owner/devices/DeviceSection';
import LullabyTracksModal from '@/components/features/farm-owner/devices/LullabyTracksModal';
import SpeakerScheduleModal from '@/components/features/farm-owner/devices/SpeakerScheduleModal';
import ZoneThresholdsModal from '@/components/features/farm-owner/devices/ZoneThresholdsModal';
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants';
import KitComponentsToggle from '@/components/features/farm-owner/devices/KitComponentsToggle';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import type { DeviceDetailState } from '@/components/features/farm-owner/devices/devices.constants';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import { devicesDict } from '@/constants/devices.i18n';
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useDeviceInventory } from '@/hooks/farm-owner/useDeviceInventory';
import { useScopeZones } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { useSensorNodes } from '@/hooks/shared/useDevices';
import { cn } from '@/lib/cn';
import { NO_VALUE } from '@/constants/display';
import type { House } from '@/types';

const NO_HOUSES: House[] = [];
const DEVICES_PATH = '/devices';

// Chi tiết thiết bị của 1 nhà yến cho Farm Owner — chỉ xem (FARM-FR-005/006): trạng thái, heartbeat, mạng của từng thiết bị
export default function FarmOwnerDeviceDetailPage(): JSX.Element {
  const { t, num } = useTranslation(devicesDict);
  const location = useLocation();
  const state = location.state as DeviceDetailState | null;
  // Mở lại trang (mất history state) thì lấy nhà đang lọc ở khung lọc chung
  const scope = useScopeFilter();
  const houseId = state?.houseId ?? scope.houseId;
  const house = scope.houses.find(item => item._id === houseId);
  const houses = useMemo(() => (house ? [house] : NO_HOUSES), [house]);
  const houseFarmId = house?.farm_id ?? '';
  const { zones, isLoading: isLoadingZones } = useScopeZones(houseFarmId, house?._id ?? '');
  const houseZones = house ? zones : [];
  const { inventory, isLoading: isLoadingDevices, isError, refetch } = useDeviceInventory(houses, houseZones);
  const item = inventory[0];
  // Popup vận hành Farm Owner được làm: ngưỡng của 1 Zone, lịch / bài loa ru của 1 node cảm biến
  const [thresholdZone, setThresholdZone] = useState<{ id: string; name: string }>();
  const [scheduleNodeId, setScheduleNodeId] = useState<string>();
  const [tracksNodeId, setTracksNodeId] = useState<string>();
  // Bản ghi node đầy đủ (lịch, âm lượng, bài đang chọn) từ cùng cache danh sách node
  const { data: sensorNodes } = useSensorNodes();
  const sensorNodeById = useMemo(() => new Map((sensorNodes ?? []).map(node => [node._id, node])), [sensorNodes]);
  const scheduleNode = scheduleNodeId ? sensorNodeById.get(scheduleNodeId) : undefined;
  const tracksNode = tracksNodeId ? sensorNodeById.get(tracksNodeId) : undefined;

  usePageBreadcrumb([{ label: house?.name ?? '' }]);
  usePageBack(DEVICES_PATH, t('detail.back'));

  if (scope.isLoading || isLoadingZones || isLoadingDevices) {
    return <LoadingSkeleton count={4} className="h-32 w-full" />;
  }

  if (isError) {
    return (
      <EmptyState
        title={t('list.errorTitle')}
        description={t('list.errorDesc')}
        action={<Button variant="secondary" size="sm" onClick={refetch}>{t('list.retry')}</Button>}
      />
    );
  }

  if (!house || !item) {
    return (
      <EmptyState
        title={t('detail.missingTitle')}
        description={t('detail.missingDesc')}
        action={
          <Link to={DEVICES_PATH}>
            <Button>{t('detail.goList')}</Button>
          </Link>
        }
      />
    );
  }

  const sensorCount = item.zoneGroups.reduce((sum, group) => sum + group.devices.length, 0);
  const renderCards = (devices: DeviceItem[], zoneName?: string) => (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      {devices.map(device => (
        <DeviceDetailCard
          key={device.id}
          device={device}
          zoneName={zoneName}
          onOpenSchedule={device.type === 'sensor' ? () => setScheduleNodeId(device.id) : undefined}
          onOpenTracks={device.type === 'sensor' ? () => setTracksNodeId(device.id) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <FarmFrame title={house.name} description={t('detail.subtitle', { farm: scope.farmNames.get(houseFarmId) ?? NO_VALUE })}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile icon={SquaresFourIcon} label={t('detail.kpiZones')} value={num(item.zoneGroups.length)} sub={t('detail.kpiZonesSub')} />
          <KpiTile
            icon={CpuIcon}
            label={t('detail.kpiTotal')}
            value={num(item.tally.total)}
            sub={t('detail.kpiTotalSub', { sensors: num(sensorCount), cameras: num(item.cameras.length) })}
          />
          <KpiTile icon={WifiHighIcon} label={t('detail.kpiOnline')} value={num(item.tally.online)} sub={t('detail.kpiOnlineSub')} />
          <KpiTile
            icon={WarningIcon}
            label={t('detail.kpiFaulty')}
            value={num(item.tally.faulty)}
            sub={t('detail.kpiFaultySub', { n: num(item.tally.pending) })}
            tone={item.tally.faulty > 0 ? 'orange' : 'neutral'}
          />
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-graphite">
          <InfoIcon size={18} className="mt-0.5 shrink-0" />
          {t('detail.readOnly')}
        </p>
      </FarmFrame>

      {item.zoneGroups.length === 0 && item.cameras.length === 0 && (
        <FarmFrame title={t('detail.noDevices')}>
          <p className="text-sm text-warmGray">{t('list.noZone')}</p>
        </FarmFrame>
      )}

      {/* Mỗi Zone 1 bộ kit: thông tin bộ kit hiện sẵn, bảng thiết bị (cảm biến, loa, relay) bấm mới xổ; mở từ "Chi tiết" của bộ kit thì xổ sẵn */}
      {item.zoneGroups.map(group => {
        const isTarget = group.devices.some(device => device.id === state?.deviceId);
        return (
          <DeviceSection
            key={group.zone._id}
            title={group.zone.name}
            description={t('list.zoneCount', { n: num(group.devices.length) })}
            isHighlighted={isTarget}
            action={
              <Button
                variant="secondary"
                size="sm"
                className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)}
                onClick={() => setThresholdZone({ id: group.zone._id, name: group.zone.name })}
              >
                <SlidersHorizontalIcon size={14} />
                {t('action.thresholds')}
              </Button>
            }
          >
            {/* Zone chưa có thiết bị vẫn hiện khung, ghi rõ chưa lắp */}
            {group.devices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-warmGray">{t('list.zoneEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {renderCards(group.devices, group.zone.name)}
                <KitComponentsToggle
                  zoneId={group.zone._id}
                  nodes={group.devices}
                  thresholds={group.zone.thresholds}
                  defaultOpen={isTarget}
                />
              </div>
            )}
          </DeviceSection>
        );
      })}

      {item.cameras.length > 0 && (
        <DeviceSection
          title={t('list.cameraGroup')}
          description={t('list.zoneCount', { n: num(item.cameras.length) })}
          isHighlighted={item.cameras.some(camera => camera.id === state?.deviceId)}
        >
          {renderCards(item.cameras)}
        </DeviceSection>
      )}

      {thresholdZone && <ZoneThresholdsModal zoneId={thresholdZone.id} zoneName={thresholdZone.name} onClose={() => setThresholdZone(undefined)} />}
      {scheduleNode && <SpeakerScheduleModal node={scheduleNode} onClose={() => setScheduleNodeId(undefined)} />}
      {tracksNode && <LullabyTracksModal node={tracksNode} onClose={() => setTracksNodeId(undefined)} />}
    </div>
  );
}
