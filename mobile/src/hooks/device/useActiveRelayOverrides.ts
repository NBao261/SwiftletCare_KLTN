import { useQueries } from '@tanstack/react-query'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { deviceApi } from '@/services/api/device.api'
import type { RelayOverrideLog, SensorNode } from '@/types'

// Số bản ghi override gần nhất cần đọc cho mỗi controller — đủ cho 3 relay đang bị ép cùng lúc
const RECENT_OVERRIDE_LIMIT = '10'

export interface ActiveRelayOverride {
  log: RelayOverrideLog
  node: SensorNode
}

// Relay đang chạy thủ công của mọi Farm: controller ở chế độ MANUAL, bản ghi override chưa kết thúc (ended_at null)
export function useActiveRelayOverrides() {
  const sensorNodesQuery = useSensorNodes()
  const nodes = sensorNodesQuery.data?.data ?? []
  // Chỉ controller đang thủ công mới cần đọc lịch sử override
  const manualNodes = nodes.filter(node => node.control_mode === 'MANUAL')

  return useQueries({
    queries: manualNodes.map(node => ({
      queryKey: ['devices', 'relay-overrides', node._id],
      queryFn: () =>
        deviceApi.listRelayOverrides(node._id, { limit: RECENT_OVERRIDE_LIMIT }).then(response => response.data.data),
    })),
    combine: results => ({
      overrides: results.flatMap((result, index) =>
        (result.data ?? []).filter(log => log.ended_at === null).map(log => ({ log, node: manualNodes[index] })),
      ),
    }),
  })
}
