import { useMemo } from 'react';

import { Button, DataTable, EmptyState, LoadingSkeleton, type DataTableColumn } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import { OVERRIDE_HISTORY_LIMIT } from '@/components/features/farm-owner/analytics/analytics.constants';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { roleDict } from '@/constants/enumLabels.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useZoneRelayOverrides } from '@/hooks/farm-owner/useAnalytics';
import { useSensorNodes } from '@/hooks/shared/useDevices';
import { cn } from '@/lib/cn';
import type { RelayOverrideLog, Role } from '@/types';

// Bảng đủ rộng cho 4 cột trong nửa khung
const TABLE_MIN_WIDTH = 560;

// Huy hiệu cùng cỡ badge chung (FE_Design 1.1)
const BADGE_CLASS = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold';

interface RelayOverrideHistoryCardProps {
  // 1 Zone, hoặc mọi Zone trong phạm vi đang lọc
  zoneIds: string[];
}

// Lịch sử can thiệp tay của các thiết bị trong Zone (ENV-FR-019), nguồn tính tỷ lệ thời gian tự động
export default function RelayOverrideHistoryCard({ zoneIds }: RelayOverrideHistoryCardProps): JSX.Element {
  const { t, dateTime, hourMinute } = useTranslation(analyticsDict);
  const { t: translateRole } = useTranslation(roleDict);
  const { data: allNodes, isLoading: isLoadingNodes, isError: isNodesError, refetch: refetchNodes } = useSensorNodes();
  // Thiết bị thuộc các Zone trong phạm vi
  const nodes = useMemo(() => {
    const zoneIdSet = new Set(zoneIds);
    return (allNodes ?? []).filter(node => zoneIdSet.has(node.zone_id));
  }, [allNodes, zoneIds]);
  const nodeIds = useMemo(() => nodes.map(node => node._id), [nodes]);
  const deviceNameById = useMemo(() => new Map(nodes.map(node => [node._id, node.device_id])), [nodes]);
  const overrides = useZoneRelayOverrides(nodeIds, OVERRIDE_HISTORY_LIMIT);

  // Nhãn vai trò chỉ khi backend trả đúng mã vai trò frontend biết, không hiện mã thô
  const roleLabel = (role: string | undefined): string => {
    if (role === 'DOMAIN_EXPERT') return t('override.roleExpert');
    if (!role || !(role in roleDict.vi)) return NO_VALUE;
    return translateRole(role as Role);
  };

  const columns: DataTableColumn<RelayOverrideLog>[] = [
    {
      key: 'relay',
      header: t('override.colRelay'),
      className: 'w-[30%]',
      render: log => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{t(`relay.${log.relay}`)}</p>
          <p className="truncate text-warmGray">
            {log.state ? t('override.forcedOn') : t('override.forcedOff')} · {deviceNameById.get(log.node_id) ?? NO_VALUE}
          </p>
        </div>
      ),
    },
    {
      key: 'by',
      header: t('override.colBy'),
      className: 'w-[26%]',
      render: log => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{log.started_by?.full_name ?? t('override.unknownUser')}</p>
          <p className="truncate text-warmGray">{roleLabel(log.started_by_role)}</p>
        </div>
      ),
    },
    {
      key: 'start',
      header: t('override.colStart'),
      className: 'w-[22%]',
      render: log => (
        <div className="min-w-0">
          <p className="truncate tabular-nums">{dateTime(log.started_at)}</p>
          <p className="truncate text-warmGray">{t('override.deadline', { time: hourMinute(log.expires_at) })}</p>
        </div>
      ),
    },
    {
      key: 'end',
      header: t('override.colEnd'),
      className: 'w-[22%]',
      render: log => {
        if (!log.ended_at || !log.end_reason) {
          return <span className={cn(BADGE_CLASS, 'bg-statusYellow/70 text-charcoal')}>{t('override.active')}</span>;
        }
        return (
          <div className="min-w-0">
            <span className={cn(BADGE_CLASS, 'bg-warmGray/15 text-warmGray')}>{t(`override.end.${log.end_reason}`)}</span>
            <p className="mt-1 truncate tabular-nums text-warmGray">{hourMinute(log.ended_at)}</p>
          </div>
        );
      },
    },
  ];

  // Thân khung theo trạng thái tải, lỗi, chưa có thiết bị, chưa có lần nào
  let body = (
    <DataTable
      columns={columns}
      rows={overrides.logs}
      getRowKey={log => log._id}
      emptyMessage={t('override.empty')}
      minTableWidth={TABLE_MIN_WIDTH}
    />
  );
  if (allNodes && nodes.length === 0) body = <EmptyState title={t('override.noDevice')} />;
  if (isLoadingNodes || overrides.isLoading) body = <LoadingSkeleton count={4} className="h-12 w-full" />;
  if (isNodesError || overrides.isError) {
    body = (
      <EmptyState
        title={t('common.loadError')}
        action={(
          <Button variant="secondary" size="sm" onClick={() => { void refetchNodes(); overrides.refetch(); }}>
            {t('common.retry')}
          </Button>
        )}
      />
    );
  }

  return (
    <FarmFrame title={t('override.title')} description={t('override.subtitle')} className="h-full">
      {body}
    </FarmFrame>
  );
}
