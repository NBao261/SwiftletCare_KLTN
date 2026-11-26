import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WifiSlashIcon } from '@phosphor-icons/react';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import RelayOverrideHistoryCard from '@/components/features/farm-owner/dashboard/RelayOverrideHistoryCard';
import ScadaNodeCard from '@/components/features/farm-owner/dashboard/ScadaNodeCard';
import { withLiveRelays } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import {
  SCADA_DEFAULT_DURATION_MINUTES,
  SCADA_DURATION_MINUTES,
} from '@/components/features/farm-owner/dashboard/scada.constants';
import { Button, EmptyState, FilterChip, LoadingSkeleton } from '@/components/ui';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useZoneRelayOverrides } from '@/hooks/farm-owner/useAnalytics';
import { useLiveZoneTelemetry } from '@/hooks/farm-owner/useLiveZoneTelemetry';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import { useSensorNodes } from '@/hooks/shared/useDevices';

const HISTORY_LIMIT = 8;

// Điều khiển tay: mỗi Zone một thẻ, bật hoặc tắt rơ-le có thời hạn rồi tự về tự động
export default function FarmOwnerScadaPage(): JSX.Element {
  const { t } = useTranslation(dashboardDict);
  const scope = useScopeFilter();
  const { houseId, zones, zone, isLoading: isLoadingScope } = scope;
  const [durationMinutes, setDurationMinutes] = useState(SCADA_DEFAULT_DURATION_MINUTES);

  // Phạm vi: 1 Zone đã lọc, hoặc mọi Zone trong phạm vi nhà
  const scopedZones = useMemo(() => (zone ? [zone] : zones), [zone, zones]);
  const zoneIds = useMemo(() => scopedZones.map(item => item._id), [scopedZones]);
  const zoneLabelById = useMemo(
    () => new Map(scopedZones.map(item => [item._id, houseId ? item.name : t('scada.zoneOption', { house: item.houseName, zone: item.name })])),
    [scopedZones, houseId, t],
  );
  const { data: allNodes, isLoading: isLoadingNodes, isError, refetch } = useSensorNodes();
  const live = useLiveZoneTelemetry(zoneIds);

  // Bộ điều khiển trong phạm vi theo thứ tự Zone, trạng thái rơ-le mới nhất qua socket đè lên dữ liệu đã tải
  const nodes = useMemo(() => {
    const order = new Map(zoneIds.map((id, index) => [id, index]));
    return withLiveRelays((allNodes ?? []).filter(node => order.has(node.zone_id)), live)
      .sort((left, right) => (order.get(left.zone_id) ?? 0) - (order.get(right.zone_id) ?? 0));
  }, [allNodes, zoneIds, live]);
  const nodeIds = useMemo(() => nodes.map(node => node._id), [nodes]);
  const history = useZoneRelayOverrides(nodeIds, HISTORY_LIMIT);

  // Nhãn thời hạn: dưới 60 phút ghi phút, còn lại ghi giờ
  const durationLabel = (minutes: number): string => (minutes < 60 ? t('scada.minutes', { n: minutes }) : t('scada.hours', { n: minutes / 60 }));

  if (isLoadingScope) return <LoadingSkeleton count={3} className="h-32 w-full" />;

  const filter = (
    <HeaderActions>
      <ScopeFilter scope={scope} />
    </HeaderActions>
  );

  if (scopedZones.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {filter}
        <EmptyState
          title={houseId ? t('vision.noZoneTitle') : t('page.noZoneTitle')}
          description={houseId ? t('vision.noZoneDesc') : t('page.noZoneDesc')}
          action={<Link to="/farms"><Button>{t('page.goFarms')}</Button></Link>}
        />
      </div>
    );
  }

  // Danh sách theo trạng thái tải, lỗi, chưa có bộ điều khiển; mỗi bộ điều khiển chưa kết nối là một thẻ riêng
  let devices = <LoadingSkeleton count={2} className="h-48 w-full" />;
  if (!isLoadingNodes && isError) {
    devices = <EmptyState title={t('scada.loadError')} action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('log.retry')}</Button>} />;
  }
  if (!isLoadingNodes && !isError && nodes.length === 0) devices = <EmptyState title={t('scada.noDevice')} />;
  if (!isLoadingNodes && !isError && nodes.length > 0) {
    devices = (
      <div className="flex flex-col gap-4">
        {nodes.map(node => (node.status === 'ONLINE' ? (
          <ScadaNodeCard
            key={node._id}
            node={node}
            zoneLabel={zoneLabelById.get(node.zone_id) ?? ''}
            controlOutput={live.get(node.zone_id)?.controlOutput}
            durationMinutes={durationMinutes}
            durationText={durationLabel(durationMinutes)}
            overriddenRelays={history.openRelays.get(node._id)}
          />
        ) : (
          <div key={node._id} className="flex items-center gap-3 rounded-2xl border border-dashed border-warmGray/30 bg-warmGray/[0.04] px-5 py-4">
            <WifiSlashIcon size={20} className="shrink-0 text-warmGray" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-h3 text-charcoal">{zoneLabelById.get(node.zone_id) ?? node.device_id}</p>
              <p className="text-small text-warmGray">{t('scada.offlineZone', { device: node.device_id })}</p>
            </div>
          </div>
        )))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {filter}

      {/* Thời hạn chọn một lần ở đây cho mọi nút bên dưới */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warmGray/15 bg-white px-5 py-3 shadow-card">
        <div>
          <p className="text-body font-bold text-charcoal">{t('scada.durationLabel')}</p>
          <p className="text-small text-warmGray">{t('scada.durationHint')}</p>
        </div>
        <div role="group" aria-label={t('scada.duration')} className="flex flex-wrap gap-2">
          {SCADA_DURATION_MINUTES.map(minutes => (
            <FilterChip key={minutes} active={durationMinutes === minutes} label={durationLabel(minutes)} onClick={() => setDurationMinutes(minutes)} />
          ))}
        </div>
      </div>

      {devices}

      {/* Lịch sử điều khiển tay của các Zone đang xem: nơi bấm cũng là nơi xem kết quả */}
      <RelayOverrideHistoryCard zoneIds={zoneIds} />
    </div>
  );
}
