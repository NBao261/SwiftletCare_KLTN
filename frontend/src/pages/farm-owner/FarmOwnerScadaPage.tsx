import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import ScadaNodeCard from '@/components/features/farm-owner/dashboard/ScadaNodeCard';
import { withLiveRelays } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import {
  SCADA_DEFAULT_DURATION_MINUTES,
  SCADA_DURATION_MINUTES,
} from '@/components/features/farm-owner/dashboard/scada.constants';
import { Button, EmptyState, FilterChip, LoadingSkeleton } from '@/components/ui';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useZoneRelayOverrides } from '@/hooks/farm-owner/useAnalytics';
import { useLiveZoneTelemetry } from '@/hooks/farm-owner/useLiveZoneTelemetry';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { useSensorNodes } from '@/hooks/shared/useDevices';
import { cn } from '@/lib/cn';
import type { SensorNode } from '@/types';

const HISTORY_LIMIT = 8;

// Trang chi tiết SCADA của Farm Owner: can thiệp tay relay có thời hạn theo phạm vi Nhà + Zone (ENV-FR-016..019)
export default function FarmOwnerScadaPage(): JSX.Element {
  const { t, dateTime } = useTranslation(dashboardDict);
  usePageBreadcrumb([{ label: t('scada.crumb') }]);
  usePageBack('/dashboard', t('scada.back'));
  // Khung lọc Nhà + Zone lưu ở store chung, giữ nguyên khi chuyển trang
  const scope = useScopeFilter();
  const { houseId, houseName, zones, zone, isLoading: isLoadingScope } = scope;
  const [durationMinutes, setDurationMinutes] = useState(SCADA_DEFAULT_DURATION_MINUTES);

  // Phạm vi: 1 Zone đã lọc, hoặc mọi Zone trong phạm vi nhà
  const scopedZones = useMemo(() => (zone ? [zone] : zones), [zone, zones]);
  const zoneIds = useMemo(() => scopedZones.map(item => item._id), [scopedZones]);
  const { data: allNodes, isLoading: isLoadingNodes, isError, refetch } = useSensorNodes();
  const live = useLiveZoneTelemetry(zoneIds);

  // Thiết bị trong phạm vi, trạng thái relay mới nhất qua socket đè lên dữ liệu đã tải
  const nodes = useMemo(() => {
    const zoneIdSet = new Set(zoneIds);
    return withLiveRelays((allNodes ?? []).filter(node => zoneIdSet.has(node.zone_id)), live);
  }, [allNodes, zoneIds, live]);
  // Gom thiết bị theo Zone để chia nhóm khi xem nhiều Zone
  const nodesByZone = useMemo(() => {
    const groups = new Map<string, SensorNode[]>();
    for (const node of nodes) {
      const group = groups.get(node.zone_id) ?? [];
      group.push(node);
      groups.set(node.zone_id, group);
    }
    return groups;
  }, [nodes]);
  const nodeIds = useMemo(() => nodes.map(node => node._id), [nodes]);
  const history = useZoneRelayOverrides(nodeIds, HISTORY_LIMIT);

  // Nhãn thời hạn: dưới 60 phút ghi phút, còn lại ghi giờ
  const durationLabel = (minutes: number): string => {
    if (minutes < 60) return t('scada.minutes', { n: minutes });
    return t('scada.hours', { n: minutes / 60 });
  };

  if (isLoadingScope) {
    return <LoadingSkeleton count={3} className="h-32 w-full" />;
  }

  // Khung lọc chung nằm trên header từ sm trở lên; mobile header chật nên đặt đầu trang
  const filter = (
    <>
      <HeaderActions>
        <div className="hidden sm:block">
          <ScopeFilter scope={scope} />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={scope} />
      </div>
    </>
  );

  if (scopedZones.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {filter}
        <EmptyState
          title={houseId ? t('vision.noZoneTitle') : t('page.noZoneTitle')}
          description={houseId ? t('vision.noZoneDesc') : t('page.noZoneDesc')}
          action={(
            <Link to="/farms">
              <Button>{t('page.goFarms')}</Button>
            </Link>
          )}
        />
      </div>
    );
  }

  // Danh sách thiết bị theo trạng thái tải, lỗi, chưa có thiết bị
  let devices = <LoadingSkeleton count={2} className="h-48 w-full" />;
  if (!isLoadingNodes && isError) {
    devices = (
      <EmptyState
        title={t('scada.loadError')}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('log.retry')}</Button>}
      />
    );
  }
  if (!isLoadingNodes && !isError && nodes.length === 0) devices = <EmptyState title={t('scada.noDevice')} />;
  if (!isLoadingNodes && !isError && nodes.length > 0) {
    devices = (
      <div className="flex flex-col gap-5">
        {scopedZones.map(scopedZone => {
          const zoneNodes = nodesByZone.get(scopedZone._id);
          if (!zoneNodes) return null;
          return (
            <section key={scopedZone._id} className="flex flex-col gap-3">
              {/* Tên Zone làm tiêu đề nhóm khi đang xem nhiều Zone */}
              {scopedZones.length > 1 && (
                <h3 className="text-h3 text-charcoal">
                  {houseId ? scopedZone.name : t('scada.zoneOption', { house: scopedZone.houseName, zone: scopedZone.name })}
                </h3>
              )}
              <div className={cn('grid grid-cols-1 gap-4', zoneNodes.length > 1 && 'lg:grid-cols-2')}>
                {zoneNodes.map(node => (
                  <ScadaNodeCard
                    key={node._id}
                    node={node}
                    controlOutput={live.get(node.zone_id)?.controlOutput}
                    durationMinutes={durationMinutes}
                    durationText={durationLabel(durationMinutes)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // Tên phạm vi trên tiêu đề khung: Zone đang lọc, nhà đang lọc, hoặc tất cả nhà
  let scopeName = t('page.allHouses');
  if (houseName) scopeName = houseName;
  if (zone) scopeName = zone.name;

  return (
    <div className="flex flex-col gap-5">
      {filter}

      {/* Điều khiển tay các thiết bị trong phạm vi */}
      <FarmFrame
        title={t('scada.title', { zone: scopeName })}
        description={t('scada.intro')}
        action={(
          <div className="flex flex-col gap-2">
            <p className="label-caption">{t('scada.duration')}</p>
            <div className="flex flex-wrap gap-2">
              {SCADA_DURATION_MINUTES.map(minutes => (
                <FilterChip
                  key={minutes}
                  active={durationMinutes === minutes}
                  label={durationLabel(minutes)}
                  onClick={() => setDurationMinutes(minutes)}
                />
              ))}
            </div>
          </div>
        )}
      >
        {devices}
      </FarmFrame>

      {/* Lần can thiệp tay gần nhất (ENV-FR-019) */}
      <FarmFrame title={t('scada.historyTitle')}>
        {history.logs.length === 0 && !history.isLoading && <p className="text-small text-warmGray">{t('scada.historyEmpty')}</p>}
        {history.isLoading && <LoadingSkeleton count={3} className="h-12 w-full" />}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {history.logs.map(log => (
            <div key={log._id} className="flex items-start justify-between gap-3 rounded-xl border border-warmGray/15 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-small font-semibold text-charcoal">
                  {t(`relay.${log.relay}`)} · {log.state ? t('relay.on') : t('relay.off')}
                </p>
                <p className="truncate text-small text-warmGray">
                  {t('scada.historyBy', { name: log.started_by?.full_name ?? t('scada.unknownUser'), time: dateTime(log.started_at) })}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  log.ended_at ? 'bg-warmGray/15 text-warmGray' : 'bg-statusYellow/70 text-charcoal',
                )}
              >
                {log.ended_at ? t('scada.historyEnded') : t('scada.historyActive')}
              </span>
            </div>
          ))}
        </div>
      </FarmFrame>
    </div>
  );
}
