import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { alertApi } from '@/apis/shared/alerts.api';
import { deviceApi } from '@/apis/shared/devices.api';
import { telemetryApi } from '@/apis/farm-owner/telemetry.api';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import {
  READING_FRESH_MS, buildZoneComponents, latestReadingByNode, type DeviceCheck,
} from '@/components/features/farm-owner/devices/zoneComponents';
import type { TelemetryRecord } from '@/types';

const READING_LIMIT = 200;
const ALERT_LIMIT = '50';


// Số đo mới nhất của Zone; Zone chưa có số đo nào thì backend trả null
async function latestZoneReading(zoneId: string): Promise<TelemetryRecord[]> {
  const response = await telemetryApi.getLatest(zoneId);
  return response.data.data ? [response.data.data] : [];
}

// Chỉ tải khi bấm, không realtime
export function useZoneComponents(zoneId: string, nodes: DeviceItem[]) {
  const sensorIds = useMemo(() => nodes.filter(node => node.type === 'sensor').map(node => node.id), [nodes]);
  const query = useQuery({
    queryKey: ['device-check', zoneId, sensorIds],
    queryFn: async (): Promise<DeviceCheck> => {
      const checkedAt = Date.now();
      const [recentRecords, latestRecords, alerts, details] = await Promise.all([
        telemetryApi
          .getHistory(zoneId, { from: new Date(checkedAt - READING_FRESH_MS).toISOString(), limit: READING_LIMIT })
          .then(response => response.data.data),
        latestZoneReading(zoneId),
        alertApi.list({ zoneId, limit: ALERT_LIMIT }).then(response => response.data.data),
        Promise.all(sensorIds.map(id => deviceApi.getSensorNode(id).then(response => response.data.data))),
      ]);
      return {
        readings: latestReadingByNode([...recentRecords, ...latestRecords]),
        alerts,
        details: new Map(details.map(detail => [detail._id, detail])),
        checkedAt,
      };
    },
    // Lỗi thì người dùng bấm lại, không tự thử lại
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  const check = query.data;
  const groups = useMemo(() => buildZoneComponents(nodes, check), [nodes, check]);

  return {
    groups,
    checkedAt: check?.checkedAt,
    isChecking: query.isFetching,
    isError: query.isError,
    runCheck: () => void query.refetch(),
  };
}
