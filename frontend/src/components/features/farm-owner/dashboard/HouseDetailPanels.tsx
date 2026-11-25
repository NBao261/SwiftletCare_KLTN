import { useMemo } from 'react';

import ControlSubsystemPanel from '@/components/features/farm-owner/dashboard/ControlSubsystemPanel';
import EnvSensorPanel from '@/components/features/farm-owner/dashboard/EnvSensorPanel';
import { getAnomalies } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import LiveCameraCard from '@/components/features/farm-owner/vision/LiveCameraCard';
import { useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import type { ScopeFilterState } from '@/hooks/shared/useScopeFilter';

// Tổng quan 1 nhà: camera trực tiếp bên trái, số đo cảm biến bên phải, trạng thái điều khiển ở dưới
export default function HouseDetailPanels({ scope }: { scope: ScopeFilterState }): JSX.Element {
  const { houseId, houseName, zones, zone: scopeZone } = scope;

  // Cảm biến và điều khiển luôn cùng 1 Zone: Zone đang lọc, chưa lọc thì Zone đầu của nhà
  const zone = scopeZone ?? zones[0];
  const zoneList = useMemo(() => (zone ? [zone] : []), [zone]);
  const env = useZonesEnvironment(zoneList);
  const anomalies = env.thresholds ? getAnomalies(env.readings, env.thresholds) : undefined;

  return (
    <>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <LiveCameraCard houseId={houseId} houseName={houseName} compact />
        <EnvSensorPanel zone={zone} env={env} />
      </div>

      <ControlSubsystemPanel
        zoneName={zone?.name ?? houseName}
        relayStates={env.relayStates}
        controlMode={env.controlMode}
        controlOutput={env.controlOutput}
        tooHot={anomalies?.tooHot ?? false}
      />
    </>
  );
}
