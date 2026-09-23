import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/apis/shared/devices.api'
import { onRelayUpdate, onDeviceStatusChange } from '@/lib/socket'
import { useSocket } from '@/hooks/common/useSocket'
import type { RelayName } from '@/types'

/**
 * useSensorNodes – danh sách device + realtime status/relay qua socket (FARM-FR-005, ENV-FR-015).
 * `zoneId` rỗng nghĩa là "tất cả" (TechnicianDevicesPage khi chưa lọc zone) — `enabled: false` cho
 * nơi gọi nào không muốn fetch-all trong lúc đó (VD Dashboard lúc chưa chọn zone).
 */
export function useSensorNodes(zoneId?: string, options?: { enabled?: boolean }) {
  useSocket()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['sensor-nodes', zoneId],
    queryFn: () => deviceApi.listSensorNodes(zoneId).then(r => r.data.data),
    enabled: options?.enabled ?? true,
  })

  useEffect(() => {
    const offRelay = onRelayUpdate(() => {
      void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] })
    })
    const offStatus = onDeviceStatusChange(() => {
      void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] })
    })
    return () => { offRelay(); offStatus() }
  }, [queryClient])

  return query
}

/** useSystemNodeStatus – OPS-NFR-004, Admin xem nhanh trạng thái mọi node toàn hệ thống */
export function useSystemNodeStatus() {
  return useQuery({
    queryKey: ['system-node-status'],
    queryFn: () => deviceApi.getSystemStatus().then(r => r.data.data),
    refetchInterval: 30_000, // trang "xem nhanh" — tự làm mới thay vì bắt người xem F5
  })
}

export function useControlRelay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, relayName, state, durationMs }: { nodeId: string; relayName: RelayName; state: boolean; durationMs?: number }) =>
      deviceApi.controlRelay(nodeId, relayName, state, durationMs),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}
