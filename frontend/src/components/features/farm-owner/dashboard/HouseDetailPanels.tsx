import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ControlSubsystemPanel from '@/components/features/farm-owner/dashboard/ControlSubsystemPanel';
import EnvSensorPanel from '@/components/features/farm-owner/dashboard/EnvSensorPanel';
import HouseHarvestCard from '@/components/features/farm-owner/dashboard/HouseHarvestCard';
import NestingDensityCard from '@/components/features/farm-owner/dashboard/NestingDensityCard';
import ZoneScopeControl from '@/components/features/farm-owner/dashboard/ZoneScopeControl';
import { getAnomalies } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { SCADA_PATH } from '@/components/features/farm-owner/dashboard/scada.constants';
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure';
import LiveCameraCard from '@/components/features/farm-owner/vision/LiveCameraCard';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import type { ScopeFilterState } from '@/hooks/shared/useScopeFilter';
import { cn } from '@/lib/cn';

// Tổng quan khi đã chọn 1 nhà: số đo và điều khiển theo Zone, sản lượng, camera và mật độ tổ của nhà đó
export default function HouseDetailPanels({ scope, houseNode, canViewHarvest }: { scope: ScopeFilterState; houseNode?: HouseNode; canViewHarvest: boolean }): JSX.Element {
  const { t } = useTranslation(dashboardDict);
  const { houseId, houseName, zones, zone: scopeZone, issueZoneIds } = scope;

  // Zone của khung Cảm biến và khung Điều khiển; đồng bộ (mặc định bật) thì 2 khung dùng chung 1 Zone
  const [isZoneLinked, setIsZoneLinked] = useState(true);
  const [envZoneChoice, setEnvZoneChoice] = useState('');
  const [controlZoneChoice, setControlZoneChoice] = useState('');
  const zoneById = useMemo(() => new Map(zones.map(zone => [zone._id, zone])), [zones]);
  const scopeZoneId = scopeZone?._id;
  // Đổi Zone trên header thì 2 khung nhảy theo Zone đó (kể cả khi đang tách đồng bộ)
  useEffect(() => {
    if (!scopeZoneId) return;
    setEnvZoneChoice(scopeZoneId);
    setControlZoneChoice(scopeZoneId);
  }, [scopeZoneId]);
  const envZone = (isZoneLinked ? scopeZone : undefined) ?? zoneById.get(envZoneChoice) ?? scopeZone ?? zones[0];
  const controlZone = isZoneLinked ? envZone : zoneById.get(controlZoneChoice) ?? scopeZone ?? zones[0];
  // Ô chọn Zone + nút đồng bộ luôn hiện khi nhà có từ 2 Zone
  const hasPanelZonePicker = zones.length > 1;
  const controlZones = useMemo(() => (controlZone ? [controlZone] : []), [controlZone]);
  const control = useZonesEnvironment(controlZones);
  // Điều khiển tay rơ-le có thời hạn: Farm Owner được làm, Domain Expert thì không
  const canControlRelay = usePermission('FARM_OWNER');
  const navigate = useNavigate();
  const controlAnomalies = control.thresholds ? getAnomalies(control.readings, control.thresholds) : undefined;

  // Đổi Zone ở 1 khung: đang đồng bộ thì khung kia đổi theo, header đang lọc 1 Zone thì header cũng đổi theo
  const changeLinkedZone = (zoneId: string) => {
    setEnvZoneChoice(zoneId);
    setControlZoneChoice(zoneId);
    if (scopeZone) scope.setZoneId(zoneId);
  };
  const handleEnvZoneChange = (zoneId: string) => (isZoneLinked ? changeLinkedZone(zoneId) : setEnvZoneChoice(zoneId));
  const handleControlZoneChange = (zoneId: string) => (isZoneLinked ? changeLinkedZone(zoneId) : setControlZoneChoice(zoneId));
  // Bật đồng bộ từ khung nào thì khung kia nhảy theo Zone của khung đó; tắt thì mỗi khung giữ Zone đang xem
  const handleToggleLink = (sourceZoneId: string | undefined) => {
    if (sourceZoneId && !isZoneLinked) changeLinkedZone(sourceZoneId);
    if (sourceZoneId && isZoneLinked) {
      setEnvZoneChoice(sourceZoneId);
      setControlZoneChoice(sourceZoneId);
    }
    setIsZoneLinked(linked => !linked);
  };

  return (
    <>
      <EnvSensorPanel
        zone={envZone}
        isLinked={isZoneLinked && hasPanelZonePicker}
        scopeControl={hasPanelZonePicker && (
          <ZoneScopeControl
            zones={zones}
            value={envZone?._id ?? ''}
            onChange={handleEnvZoneChange}
            issueZoneIds={issueZoneIds}
            isLinked={isZoneLinked}
            onToggleLink={() => handleToggleLink(envZone?._id)}
            partner="control"
          />
        )}
      />

      {/* Khối điều khiển 3 rơ-le, bên phải là sản lượng thu hoạch của nhà (ẩn nếu role không xem được thu hoạch) */}
      <div className={cn('grid grid-cols-1 gap-5', houseNode && canViewHarvest && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
        <ControlSubsystemPanel
          zoneName={controlZone?.name ?? houseName}
          relayStates={control.relayStates}
          controlMode={control.controlMode}
          controlOutput={control.controlOutput}
          tooHot={controlAnomalies?.tooHot ?? false}
          isLinked={isZoneLinked && hasPanelZonePicker}
          onOpenDetail={canControlRelay ? () => navigate(SCADA_PATH) : undefined}
          scopeControl={hasPanelZonePicker && (
            <ZoneScopeControl
              zones={zones}
              value={controlZone?._id ?? ''}
              onChange={handleControlZoneChange}
              issueZoneIds={issueZoneIds}
              isLinked={isZoneLinked}
              onToggleLink={() => handleToggleLink(controlZone?._id)}
              partner="env"
            />
          )}
        />
        {houseNode && canViewHarvest && <HouseHarvestCard node={houseNode} />}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Camera cửa thu chim của nhà đang lọc, số đếm chi tiết ở trang Đàn chim */}
        <LiveCameraCard
          houseId={houseId}
          houseName={houseName}
          action={
            <Link to="/vision" className="shrink-0 text-small font-semibold text-graphite hover:text-charcoal">
              {t('camera.viewVision')}
            </Link>
          }
        />
        <NestingDensityCard houseId={houseId} houseName={houseName} />
      </div>
    </>
  );
}
