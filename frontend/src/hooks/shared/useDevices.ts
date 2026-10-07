import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, type Query } from '@tanstack/react-query'
import { deviceApi } from '@/apis/shared/devices.api'
import { onRelayUpdate, onDeviceStatusChange } from '@/lib/socket'
import { useSocket } from '@/hooks/common/useSocket'
import type { RelayName, SpeakerScheduleInput, NodeCommandInput, SensorNode } from '@/types'
import type { ReplaceSensorNodeInput } from '@/apis/shared/devices.api'

/**
 * useSensorNodes – danh sách device + realtime status/relay qua socket (FARM-FR-005, ENV-FR-015).
 * `zoneId` rỗng nghĩa là "tất cả" (TechnicianDevicesPage khi chưa lọc zone) — `enabled: false` cho
 * nơi gọi nào không muốn fetch-all trong lúc đó (VD Dashboard lúc chưa chọn zone).
 */
export function useSensorNodes(zoneId?: string, options?: { enabled?: boolean; refetchInterval?: number | false | ((query: Query<SensorNode[], Error, SensorNode[], (string | undefined)[]>) => number | false | undefined) }) {
  useSocket()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['sensor-nodes', zoneId],
    queryFn: () => deviceApi.listSensorNodes(zoneId).then(r => r.data.data),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
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

export function useClearRelayOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => deviceApi.clearRelayOverride(nodeId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}

export function useUpdateSpeakerSchedule(nodeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SpeakerScheduleInput) => deviceApi.updateSpeakerSchedule(nodeId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}

/** TICKET-FR-008 — gửi lệnh từ xa (RESTART / PUSH_CONFIG / OTA) tới 1 sensor node */
export function useSendNodeCommand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: NodeCommandInput }) =>
      deviceApi.sendCommand(nodeId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}

/**
 * FARM-FR-008 — gỡ sensor node (không hoàn tác). Trang Thiết bị chỉ liệt kê sensor node;
 * camera node đã có `deviceApi.decommissionCameraNode` khi UI camera được dựng.
 */
export function useDecommissionDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, reason }: { nodeId: string; reason: string }) =>
      deviceApi.decommissionSensorNode(nodeId, reason),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}

/** FARM-FR-008 — thay sensor node hỏng bằng node mới cùng Zone (cần secret_key trên nhãn node mới) */
export function useReplaceSensorNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: ReplaceSensorNodeInput }) =>
      deviceApi.replaceSensorNode(nodeId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}
