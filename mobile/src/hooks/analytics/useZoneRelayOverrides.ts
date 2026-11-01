import { useQueries } from '@tanstack/react-query'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { deviceApi } from '@/services/api/device.api'
import type { RelayOverrideLog } from '@/types'

// Mỗi controller lấy tối đa chừng này lần gần nhất
const OVERRIDES_PER_CONTROLLER = 20

// Lịch sử điều khiển tay của một tầng (ENV-FR-019): backend chỉ có route theo controller nên gộp các controller
// của tầng, mới nhất trước
export function useZoneRelayOverrides(zoneId: string, enabled: boolean) {
  const sensorNodesQuery = useSensorNodes()
  const nodes = (sensorNodesQuery.data?.data ?? []).filter(node => node.zone_id === zoneId)

  return useQueries({
    queries: nodes.map(node => ({
      queryKey: ['devices', 'relay-overrides', node._id, 'history'],
      queryFn: () =>
        deviceApi
          .listRelayOverrides(node._id, { limit: String(OVERRIDES_PER_CONTROLLER) })
          .then(response => response.data.data),
      enabled,
    })),
    combine: results => ({
      overrides: results
        .flatMap(result => result.data ?? [])
        .sort((first, second) => second.started_at.localeCompare(first.started_at)) as RelayOverrideLog[],
      isLoading: sensorNodesQuery.isLoading || results.some(result => result.isLoading),
      isError: sensorNodesQuery.isError || results.some(result => result.isError),
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  })
}
