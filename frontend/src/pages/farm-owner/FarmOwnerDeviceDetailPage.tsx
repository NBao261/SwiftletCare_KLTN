import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CpuIcon, SlidersHorizontalIcon, SquaresFourIcon, WarningIcon, WifiHighIcon } from '@phosphor-icons/react';

import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import DeviceDetailCard from '@/components/features/farm-owner/devices/DeviceDetailCard';
import DeviceSection from '@/components/features/farm-owner/devices/DeviceSection';
import LullabyTracksModal from '@/components/features/farm-owner/devices/LullabyTracksModal';
import SpeakerScheduleModal from '@/components/features/farm-owner/devices/SpeakerScheduleModal';
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants';
import KitComponentsToggle from '@/components/features/farm-owner/devices/KitComponentsToggle';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import type { DeviceDetailState } from '@/components/features/farm-owner/devices/devices.constants';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/common/KpiTile';
import { devicesDict } from '@/constants/devices.i18n';
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useDeviceInventory } from '@/hooks/farm-owner/useDeviceInventory';
import { useScopeZones } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import { useSendNodeCommand, useSensorNodes } from '@/hooks/shared/useDevices';
import { useOpenZoneTuning } from '@/hooks/shared/useOpenZoneTuning';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { canManageController, canRestartController } from '@/components/features/farm-owner/devices/deviceActions';
import MoveControllerModal from '@/components/features/farm-owner/devices/MoveControllerModal';
import ReplaceControllerModal from '@/components/features/farm-owner/devices/ReplaceControllerModal';
import RemoveControllerModal from '@/components/features/farm-owner/devices/RemoveControllerModal';
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
  // Lịch và bài loa ru chỉ Farm Owner đặt (BR-07); Domain Expert chỉ đọc
  const canOperateSpeaker = usePermission('FARM_OWNER');
  // Ngưỡng của Zone chỉ sửa ở /domain-expert/tuning; popup ở đây là lịch và bài loa ru của 1 bộ điều khiển
  const openZoneTuning = useOpenZoneTuning();
  const [scheduleNodeId, setScheduleNodeId] = useState<string>();
  const [tracksNodeId, setTracksNodeId] = useState<string>();
  // Bản ghi node đầy đủ (lịch, âm lượng, bài đang chọn) từ cùng cache danh sách node
  const { data: sensorNodes } = useSensorNodes();
  const sensorNodeById = useMemo(() => new Map((sensorNodes ?? []).map(node => [node._id, node])), [sensorNodes]);
  const scheduleNode = scheduleNodeId ? sensorNodeById.get(scheduleNodeId) : undefined;
  const tracksNode = tracksNodeId ? sensorNodeById.get(tracksNodeId) : undefined;
  // FARM-FR-013 — khởi động lại bộ điều khiển (Farm Owner, thiết bị ONLINE)
  const role = useAuthStore(state => state.user?.role);
  const sendCommand = useSendNodeCommand();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [restartDevice, setRestartDevice] = useState<DeviceItem>();
  // FARM-FR-007b, 008 — bộ điều khiển đang mở popup dời, thay hoặc gỡ
  const [moveDevice, setMoveDevice] = useState<DeviceItem>();
  const [replaceDevice, setReplaceDevice] = useState<DeviceItem>();
  const [removeDevice, setRemoveDevice] = useState<DeviceItem>();

  function handleRestart(): void {
    if (!restartDevice) return;
    const { id, deviceId } = restartDevice;
    sendCommand.mutate({ nodeId: id, input: { command: 'RESTART' } }, {
      onSuccess: () => push(t('restart.sent', { id: deviceId })),
      // Firmware dưới COMMAND_SUPPORT_SINCE (1.4.0) trả 501
      onError: reason => push((reason as { response?: { status?: number } }).response?.status === 501
        ? t('restart.unsupported')
        : apiErrorMessage(reason, t('restart.failed')), 'error'),
      onSettled: () => setRestartDevice(undefined),
    });
  }

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
          onOpenSchedule={canOperateSpeaker && device.type === 'sensor' ? () => setScheduleNodeId(device.id) : undefined}
          onOpenTracks={canOperateSpeaker && device.type === 'sensor' ? () => setTracksNodeId(device.id) : undefined}
          onRestart={canRestartController(role, device) ? () => setRestartDevice(device) : undefined}
          moreActions={canManageController(role, device) ? [
            { label: t('action.move'), onClick: () => setMoveDevice(device) },
            { label: t('action.replace'), onClick: () => setReplaceDevice(device) },
            { label: t('action.remove'), onClick: () => setRemoveDevice(device), danger: true },
          ] : []}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <FarmFrame title={house.name} description={t('detail.subtitle', { farm: scope.farmNames.get(houseFarmId) ?? NO_VALUE })} help={t('detail.readOnly')}>
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
                disabled={!openZoneTuning}
                onClick={() => openZoneTuning?.(group.zone._id)}
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

      {scheduleNode && <SpeakerScheduleModal node={scheduleNode} onClose={() => setScheduleNodeId(undefined)} />}
      {tracksNode && <LullabyTracksModal node={tracksNode} onClose={() => setTracksNodeId(undefined)} />}
      {moveDevice && <MoveControllerModal device={moveDevice} onClose={() => setMoveDevice(undefined)} />}
      {replaceDevice && <ReplaceControllerModal device={replaceDevice} onClose={() => setReplaceDevice(undefined)} />}
      {removeDevice && <RemoveControllerModal device={removeDevice} onClose={() => setRemoveDevice(undefined)} />}
      <ConfirmModal
        open={restartDevice !== undefined}
        title={t('restart.title', { id: restartDevice?.deviceId ?? '' })}
        description={t('restart.desc')}
        confirmLabel={t('action.restart')}
        loading={sendCommand.isPending}
        onConfirm={handleRestart}
        onCancel={() => setRestartDevice(undefined)}
      />
    </div>
  );
}
