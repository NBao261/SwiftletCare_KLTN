import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WifiSlashIcon } from '@phosphor-icons/react';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import ScadaNodeCard from '@/components/features/farm-owner/dashboard/ScadaNodeCard';
import { withLiveRelays } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import {
  SCADA_DEFAULT_DURATION_MINUTES,
  SCADA_DURATION_MINUTES,
} from '@/components/features/farm-owner/dashboard/scada.constants';
import { Button, EmptyState, FilterChip, LoadingSkeleton, SectionCard } from '@/components/ui';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useZoneRelayOverrides } from '@/hooks/farm-owner/useAnalytics';
import { useLiveZoneTelemetry } from '@/hooks/farm-owner/useLiveZoneTelemetry';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import { useSensorNodes } from '@/hooks/shared/useDevices';
import { cn } from '@/lib/cn';

const HISTORY_LIMIT = 8;

// Tab Điều khiển tay của Tổng quan (FO-02): mỗi Zone một hàng, bật/tắt rơ-le có thời hạn (ENV-FR-016..019)
export default function FarmOwnerScadaPage(): JSX.Element {
  const { t, dateTime } = useTranslation(dashboardDict);
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
  const onlineNodes = nodes.filter(node => node.status === 'ONLINE');
  const offlineNodes = nodes.filter(node => node.status !== 'ONLINE');
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

  // Danh sách theo trạng thái tải, lỗi, chưa có bộ điều khiển
  let devices = <LoadingSkeleton count={2} className="h-32 w-full" />;
  if (!isLoadingNodes && isError) {
    devices = <EmptyState title={t('scada.loadError')} action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('log.retry')}</Button>} />;
  }
  if (!isLoadingNodes && !isError && nodes.length === 0) devices = <EmptyState title={t('scada.noDevice')} />;
  if (!isLoadingNodes && !isError && nodes.length > 0) {
    devices = (
      <div className="flex flex-col gap-3">
        {onlineNodes.map(node => (
          <ScadaNodeCard
            key={node._id}
            node={node}
            zoneLabel={zoneLabelById.get(node.zone_id) ?? ''}
            controlOutput={live.get(node.zone_id)?.controlOutput}
            durationMinutes={durationMinutes}
            durationText={durationLabel(durationMinutes)}
            overriddenRelays={history.openRelays.get(node._id)}
          />
        ))}
        {/* Bộ điều khiển chưa kết nối (mất kết nối hoặc chờ kết nối lần đầu) gộp thành 1 dòng, mỗi Zone ghi một lần */}
        {offlineNodes.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-warmGray/5 px-4 py-3 text-body text-graphite">
            <WifiSlashIcon size={18} className="mt-0.5 shrink-0 text-warmGray" aria-hidden="true" />
            {t('scada.offlineLine', { names: [...new Set(offlineNodes.map(node => zoneLabelById.get(node.zone_id) ?? node.device_id))].join(', ') })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {filter}

      <SectionCard
        description={t('scada.durationHint')}
        action={(
          <div role="group" aria-label={t('scada.duration')} className="flex flex-wrap gap-2">
            {SCADA_DURATION_MINUTES.map(minutes => (
              <FilterChip key={minutes} active={durationMinutes === minutes} label={durationLabel(minutes)} onClick={() => setDurationMinutes(minutes)} />
            ))}
          </div>
        )}
      >
        {devices}
      </SectionCard>

      {/* Lần can thiệp tay gần nhất (ENV-FR-019) */}
      <SectionCard title={t('scada.historyTitle')}>
        {history.logs.length === 0 && !history.isLoading && <p className="text-body text-warmGray">{t('scada.historyEmpty')}</p>}
        {history.isLoading && <LoadingSkeleton count={3} className="h-12 w-full" />}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {history.logs.map(log => (
            <div key={log._id} className="flex items-start justify-between gap-3 rounded-xl border border-warmGray/15 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-charcoal">
                  {t(`relay.${log.relay}`)} · {log.state ? t('relay.on') : t('relay.off')}
                </p>
                <p className="truncate text-small text-warmGray">
                  {t('scada.historyBy', { name: log.started_by?.full_name ?? t('scada.unknownUser'), time: dateTime(log.started_at) })}
                </p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-small font-semibold', log.ended_at ? 'bg-warmGray/15 text-warmGray' : 'bg-statusYellow/70 text-charcoal')}>
                {log.ended_at ? t('scada.historyEnded') : t('scada.historyActive')}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
