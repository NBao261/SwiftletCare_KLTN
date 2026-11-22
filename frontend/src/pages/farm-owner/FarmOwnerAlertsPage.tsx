import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import ScopeFilter from '@/components/common/ScopeFilter';
import TableEmptyState from '@/components/common/TableEmptyState';
import HeaderActions from '@/components/layouts/HeaderActions';
import AcknowledgeAlertModal from '@/components/features/farm-owner/alerts/AcknowledgeAlertModal';
import AlertDetailDrawer from '@/components/features/farm-owner/alerts/AlertDetailDrawer';
import AlertTable, { type AlertAction } from '@/components/features/farm-owner/alerts/AlertTable';
import { Button, EmptyState, LoadingSkeleton, SectionCard, SelectMenu } from '@/components/ui';
import { alertsDict } from '@/constants/alerts.i18n';
import { alertTypeDict } from '@/constants/enumLabels.i18n';
import { NO_VALUE } from '@/constants/display';
import { LEVELS, severityQueryOf } from '@/constants/severity';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useCameraNodes } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import { ALERT_PAGE_SIZE, useAlertsList, usePendingAlertTotal } from '@/hooks/shared/useAlerts';
import { useSensorNodes, useSystemNodeStatus } from '@/hooks/shared/useDevices';
import { useAllZones } from '@/hooks/shared/useFarms';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import { nodeLocation } from '@/lib/deviceLocation';
import { lastPage } from '@/lib/helpers';
import type { Alert, AlertStatus, AlertType, SeverityLevel } from '@/types';
import type { InferredAlertType } from '@/types/expert/alerts.types';

const ALERT_STATUSES: AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED'];
// 'open' = còn hiệu lực (ACTIVE, ACKNOWLEDGED), hiện tách khỏi DISMISSED và RESOLVED
type StatusFilter = 'open' | 'all' | AlertStatus;
type LevelFilter = 'all' | SeverityLevel;
type VerdictFilter = 'all' | 'pending' | 'confirmed' | 'rejected';
const ALERT_TYPES = Object.keys(alertTypeDict.vi) as AlertType[];
// "Device alert", khớp DEVICE_ALERT_TYPES của backend: Admin chỉ thấy các loại này
const DEVICE_ALERT_TYPES: AlertType[] = [
  'NODE_OFFLINE', 'EDGE_AI_DEGRADED', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'UNEXPECTED_RESTART',
  'SPEAKER_FAILURE', 'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'CONFIG_MISMATCH', 'MAINTENANCE_DUE',
];
const INFERRED_TYPES: InferredAlertType[] = ['NOISE_ANOMALY', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE'];
const isInferred = (type: AlertType) => (INFERRED_TYPES as AlertType[]).includes(type);

// /alerts (mặc định chỉ cảnh báo còn hiệu lực, kèm số chờ xác nhận) của Farm Owner, Farm Technician (nhà được giao), Admin (chỉ xem cảnh báo thiết bị): lọc phạm vi, trạng thái, mức độ, loại và kết luận, chi tiết, xác nhận kèm nguyên nhân
export default function FarmOwnerAlertsPage(): JSX.Element {
  const { t } = useTranslation(alertsDict);
  const apiErrorMessage = useApiErrorMessage();
  const canAcknowledge = usePermission('FARM_OWNER', 'FARM_TECHNICIAN');
  const isAdmin = usePermission('ADMIN');
  const isTechnician = usePermission('FARM_TECHNICIAN');
  const subtitleKey = isAdmin ? 'list.subtitleAdmin' : isTechnician ? 'list.subtitleTechnician' : 'list.subtitle';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const pendingCount = usePendingAlertTotal();
  // Câu số chờ xác nhận chỉ hiện khi đã có số; Admin không xác nhận cảnh báo nên dùng câu trung tính
  let pendingKey: 'list.noPending' | 'list.pending' | 'list.pendingAdmin' = 'list.pending';
  if (pendingCount === 0) pendingKey = 'list.noPending';
  else if (isAdmin) pendingKey = 'list.pendingAdmin';
  const pendingText = pendingCount === undefined ? '' : ` ${t(pendingKey, { n: pendingCount })}`;
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AlertType>('all');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');
  // Kết luận chuyên gia chỉ có ở cảnh báo suy luận: chọn loại khác thì bỏ lọc kết luận
  const verdictApplies = typeFilter === 'all' || isInferred(typeFilter);
  const verdict = verdictApplies && verdictFilter !== 'all' ? verdictFilter : undefined;
  // lọc theo trang trại, nhà, Zone (Admin không có cấu trúc farm nên không có bộ lọc phạm vi)
  const scope = useScopeFilter();
  const place = isAdmin ? {} : {
    ...(scope.farmId && { farmId: scope.farmId }),
    ...(scope.houseId && { houseId: scope.houseId }),
    ...(scope.zone && { zoneId: scope.zone._id }),
  };
  // Đổi bộ lọc thì về trang 1
  const filterKey = `${statusFilter}|${levelFilter}|${typeFilter}|${verdict ?? ''}|${JSON.stringify(place)}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const { records: alerts, total, isLoading, isError, error, refetch } = useAlertsList({
    ...(statusFilter === 'open' ? { open: 'true' as const } : statusFilter !== 'all' && { status: statusFilter }),
    ...(levelFilter !== 'all' && { severity: severityQueryOf(levelFilter) }),
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(verdict && { verdict }),
    ...place,
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
  // Admin không đọc được cấu trúc farm (GET /farms trả rỗng): vị trí lấy từ danh sách thiết bị toàn hệ thống
  const { data: systemStatus } = useSystemNodeStatus(isAdmin);
  const adminLocations = useMemo(
    () => new Map((systemStatus?.nodes ?? []).map(node => [node._id, nodeLocation(node)])),
    [systemStatus],
  );
  const zoneNames = useMemo(() => new Map((allZones ?? []).map(zone => [zone._id, `${zone.houseName} > ${zone.name}`])), [allZones]);
  const houseNames = useMemo(() => new Map((allZones ?? []).map(zone => [zone.house_id, zone.houseName])), [allZones]);
  const deviceNames = useMemo(() => new Map([
    ...(sensorNodes ?? []).map(node => [node._id, node.device_id] as const),
    ...(cameras ?? []).map(camera => [camera._id, camera.device_id] as const),
  ]), [sensorNodes, cameras]);
  // thiết bị giả lập ghi nhãn ở cột và ngăn chi tiết
  const simulatedIds = useMemo(() => new Set(
    [...(sensorNodes ?? []), ...(cameras ?? [])].filter(device => device.simulated).map(device => device._id),
  ), [sensorNodes, cameras]);
  const locationOf = useCallback((alert: Alert) => {
    let location = NO_VALUE;
    if (isAdmin && alert.node_id) location = adminLocations.get(alert.node_id) || NO_VALUE;
    else if (alert.zone_id) location = zoneNames.get(alert.zone_id) ?? NO_VALUE;
    else if (alert.house_id) location = houseNames.get(alert.house_id) ?? NO_VALUE;
    return {
      location,
      device: alert.node_id ? deviceNames.get(alert.node_id) ?? null : null,
      simulated: !!alert.node_id && simulatedIds.has(alert.node_id),
    };
  }, [isAdmin, adminLocations, zoneNames, houseNames, deviceNames, simulatedIds]);

  const closeDetail = () => {
    setDetailId(null);
    // Bỏ ?highlight để F5 không mở lại
    if (searchParams.has('highlight')) setSearchParams({}, { replace: true });
  };
  // Chọn hàng khác thì bỏ ?highlight, để bấm lại chuông của cảnh báo cũ vẫn đổi URL và mở được
  const handleAction = useCallback((action: AlertAction, alert: Alert) => {
    if (action === 'view') {
      setDetailId(alert._id);
      if (highlightId && highlightId !== alert._id) setSearchParams({}, { replace: true });
    } else setAckAlert(alert);
  }, [highlightId, setSearchParams]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      {!isAdmin && (
        <HeaderActions>
          <ScopeFilter scope={scope} />
        </HeaderActions>
      )}
      {/* Một card: tên trang đã ở header nên card không lặp tiêu đề */}
      <SectionCard description={`${t(subtitleKey)}${pendingText}`}>
        <div className="flex flex-wrap items-center gap-3">
          <SelectMenu
            ariaLabel={t('list.filterStatus')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'open', label: t('filter.open') },
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
          <SelectMenu
            ariaLabel={t('list.filterType')}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: 'all', label: t('filter.allTypes') },
              ...(isAdmin ? DEVICE_ALERT_TYPES : ALERT_TYPES).map(type => ({ value: type, label: t(`type.${type}`) })),
            ]}
          />
          {verdictApplies && !isAdmin && (
            <SelectMenu
              ariaLabel={t('list.filterVerdict')}
              value={verdictFilter}
              onChange={setVerdictFilter}
              options={[
                { value: 'all', label: t('filter.allVerdicts') },
                { value: 'pending', label: t('verdict.pending') },
                { value: 'confirmed', label: t('verdict.confirmed') },
                { value: 'rejected', label: t('verdict.rejected') },
              ]}
            />
          )}
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
