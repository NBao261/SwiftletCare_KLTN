import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { alertApi } from '@/apis/shared/alerts.api';
import { deviceApi } from '@/apis/shared/devices.api';
import { farmMockApi } from '@/apis/farm-owner/farmMock.api';
import { telemetryApi } from '@/apis/farm-owner/telemetry.api';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import {
  READING_FRESH_MS, buildZoneComponents, latestReadingByNode, type ComponentKind, type DeviceCheck,
} from '@/components/features/farm-owner/devices/zoneComponents';
import type { TelemetryRecord } from '@/types';

const READING_LIMIT = 200;
const ALERT_LIMIT = '50';

// Khoá tra tên thiết bị con: 1 bộ kit có 1 thiết bị mỗi loại
export function componentNameKey(nodeId: string, kind: ComponentKind): string {
  return `${nodeId}|${kind}`;
}

// Số đo mới nhất của Zone; Zone chưa có số đo nào thì backend trả 404 → coi là không có
async function latestZoneReading(zoneId: string): Promise<TelemetryRecord[]> {
  try {
    const response = await telemetryApi.getLatest(zoneId);
    return response.data.data ? [response.data.data] : [];
  } catch {
    return [];
  }
}

// Kiểm tra thiết bị của bộ kit trong 1 Zone: chỉ tải khi bấm nút, giữ kết quả lần bấm đó (không realtime, không tự làm mới)
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
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  const check = query.data;
  const groups = useMemo(() => buildZoneComponents(nodes, check), [nodes, check]);

  // Tên Kỹ thuật viên đặt cho từng thiết bị con: khoá "id node|loại" → tên
  const sensorNodes = useMemo(() => nodes.filter(node => node.type === 'sensor'), [nodes]);
  const componentNames = useQueries({
    queries: sensorNodes.map(node => ({
      queryKey: ['device-component-names', node.deviceId],
      queryFn: () => farmMockApi.getDeviceComponentNames(node.deviceId).then(response => response.data.data),
      staleTime: Infinity,
    })),
    combine: results => {
      const names = new Map<string, string>();
      results.forEach((result, index) => {
        for (const component of result.data ?? []) names.set(componentNameKey(sensorNodes[index].id, component.kind), component.name);
      });
      return names;
    },
  });

  return {
    groups,
    componentNames,
    checkedAt: check?.checkedAt,
    isChecking: query.isFetching,
    isError: query.isError,
    runCheck: () => void query.refetch(),
  };
}
