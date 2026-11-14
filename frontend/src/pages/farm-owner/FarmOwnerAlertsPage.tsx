import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import TableEmptyState from '@/components/common/TableEmptyState';
import AcknowledgeAlertModal from '@/components/features/farm-owner/alerts/AcknowledgeAlertModal';
import AlertDetailDrawer from '@/components/features/farm-owner/alerts/AlertDetailDrawer';
import AlertTable, { type AlertAction } from '@/components/features/farm-owner/alerts/AlertTable';
import { Button, EmptyState, LoadingSkeleton, SectionCard, SelectMenu } from '@/components/ui';
import { alertsDict } from '@/constants/alerts.i18n';
import { NO_VALUE } from '@/constants/display';
import { LEVELS, severityQueryOf } from '@/constants/severity';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useCameraNodes } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import { ALERT_PAGE_SIZE, useAlertsList } from '@/hooks/shared/useAlerts';
import { useSensorNodes } from '@/hooks/shared/useDevices';
import { useAllZones } from '@/hooks/shared/useFarms';
import { lastPage } from '@/lib/helpers';
import type { Alert, AlertStatus, SeverityLevel } from '@/types';

const ALERT_STATUSES: AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED'];
type StatusFilter = 'all' | AlertStatus;
type LevelFilter = 'all' | SeverityLevel;

// ALERT-FR-007, 009, 018 — /alerts của Farm Owner, Farm Technician (nhà được giao), Admin (chỉ xem cảnh báo thiết bị): lọc trạng thái và mức độ, chi tiết, xác nhận kèm nguyên nhân
export default function FarmOwnerAlertsPage(): JSX.Element {
  const { t } = useTranslation(alertsDict);
  const apiErrorMessage = useApiErrorMessage();
  const canAcknowledge = usePermission('FARM_OWNER', 'FARM_TECHNICIAN');
  const isAdmin = usePermission('ADMIN');
  const isTechnician = usePermission('FARM_TECHNICIAN');
  const subtitleKey = isAdmin ? 'list.subtitleAdmin' : isTechnician ? 'list.subtitleTechnician' : 'list.subtitle';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  // Đổi trạng thái hay mức độ thì về trang 1
  const filterKey = `${statusFilter}|${levelFilter}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const { records: alerts, total, isLoading, isError, error, refetch } = useAlertsList({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(levelFilter !== 'all' && { severity: severityQueryOf(levelFilter) }),
    page,
    limit: ALERT_PAGE_SIZE,
  });
  // Xác nhận cảnh báo cuối của trang cuối (đang lọc Mới) làm trang rỗng: lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (!isLoading && !isError && alerts.length === 0 && page > 1) {
      setPageState({ key: filterKey, page: lastPage(total, ALERT_PAGE_SIZE) });
    }
  }, [isLoading, isError, alerts.length, page, total, filterKey]);

  // Bấm 1 thông báo ở chuông (AppHeader) sang đây kèm ?highlight=<id>: mở thẳng chi tiết cảnh báo đó
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [detailId, setDetailId] = useState<string | null>(highlightId);
  // Đang ở /alerts mà bấm thông báo khác: route không remount, nên mở theo ?highlight mỗi lần nó đổi
  useEffect(() => {
    if (highlightId) setDetailId(highlightId);
  }, [highlightId]);
  const [ackAlert, setAckAlert] = useState<Alert | null>(null);

  // Vị trí: "Nhà > Zone", hoặc tên nhà với cảnh báo cả nhà (camera); thiết bị: mã bộ điều khiển hoặc camera
  const { data: allZones } = useAllZones();
  const { data: sensorNodes } = useSensorNodes();
  const { data: cameras } = useCameraNodes();
  const zoneNames = useMemo(() => new Map((allZones ?? []).map(zone => [zone._id, `${zone.houseName} > ${zone.name}`])), [allZones]);
  const houseNames = useMemo(() => new Map((allZones ?? []).map(zone => [zone.house_id, zone.houseName])), [allZones]);
  const deviceNames = useMemo(() => new Map([
    ...(sensorNodes ?? []).map(node => [node._id, node.device_id] as const),
    ...(cameras ?? []).map(camera => [camera._id, camera.device_id] as const),
  ]), [sensorNodes, cameras]);
  const locationOf = useCallback((alert: Alert) => {
    let location = NO_VALUE;
    if (alert.zone_id) location = zoneNames.get(alert.zone_id) ?? NO_VALUE;
    else if (alert.house_id) location = houseNames.get(alert.house_id) ?? NO_VALUE;
    return { location, device: alert.node_id ? deviceNames.get(alert.node_id) ?? null : null };
  }, [zoneNames, houseNames, deviceNames]);

  const closeDetail = () => {
    setDetailId(null);
    // Bỏ ?highlight để F5 không mở lại
    if (searchParams.has('highlight')) setSearchParams({}, { replace: true });
  };
  const handleAction = useCallback((action: AlertAction, alert: Alert) => {
    if (action === 'view') setDetailId(alert._id);
    else setAckAlert(alert);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <SectionCard className="flex-1" title={t('list.title')} description={t(subtitleKey)}>
        <div className="flex flex-wrap items-center gap-3">
          <SelectMenu
            ariaLabel={t('list.filterStatus')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: t('filter.all') },
              ...ALERT_STATUSES.map(item => ({ value: item, label: t(`status.${item}`) })),
            ]}
          />
          <SelectMenu
            ariaLabel={t('list.filterLevel')}
            value={levelFilter}
            onChange={setLevelFilter}
            options={[
              { value: 'all', label: t('filter.allLevels') },
              ...LEVELS.map(level => ({ value: level, label: t(`level.${level}`) })),
            ]}
          />
        </div>

        {isLoading ? (
          <LoadingSkeleton count={5} className="h-14 w-full" />
        ) : isError ? (
          <EmptyState
            title={t('list.errorTitle')}
            description={apiErrorMessage(error)}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>}
          />
        ) : alerts.length === 0 ? (
          // Khung viền đứt tới gần đáy thẻ; đệm trên dày hơn 40px vì vòng tròn minh hoạ tràn lên trên khung hình 40px
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 pb-10 pt-20">
            <TableEmptyState title={t('list.emptyTitle')} description={t('list.emptyHint')} />
          </div>
        ) : (
          <AlertTable
            alerts={alerts}
            serverPagination={{ page, total, onChange: next => setPageState({ key: filterKey, page: next }) }}
            locationOf={locationOf}
            canAcknowledge={canAcknowledge}
            onAction={handleAction}
          />
        )}
      </SectionCard>

      <AlertDetailDrawer
        alertId={detailId}
        locationOf={locationOf}
        canAcknowledge={canAcknowledge}
        onAcknowledge={alert => {
          closeDetail();
          setAckAlert(alert);
        }}
        onClose={closeDetail}
      />
      <AcknowledgeAlertModal alert={ackAlert} onClose={() => setAckAlert(null)} />
    </div>
  );
}
