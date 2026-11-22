import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, type Query } from '@tanstack/react-query'
import { deviceApi } from '@/apis/shared/devices.api'
import { joinHouse, joinZone, leaveHouse, leaveZone, onRelayUpdate, onDeviceStatusChange } from '@/lib/socket'
import { useSocket } from '@/hooks/common/useSocket'
import type { DeviceStatus, RelayName, SpeakerScheduleInput, NodeCommandInput, SensorNode } from '@/types'
import type { ReplaceSensorNodeInput } from '@/apis/shared/devices.api'

// zoneId rỗng = tất cả; enabled: false khi chưa muốn tải hết
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
      void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }, { cancelRefetch: false })
    })
    const offStatus = onDeviceStatusChange(() => {
      void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }, { cancelRefetch: false })
    })
    return () => { offRelay(); offStatus() }
  }, [queryClient])

  return query
}

// Camera vào room nhà, bộ điều khiển vào room Zone
export function useDeviceStatusEvents(
  room: { houseId?: string; zoneId?: string }, nodeId: string, onStatus: (status: DeviceStatus) => void,
) {
  useSocket()
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus
  const { houseId, zoneId } = room

  useEffect(() => {
    if (houseId) joinHouse(houseId)
    else if (zoneId) joinZone(zoneId)
    const off = onDeviceStatusChange(event => {
      if (nodeId && event.nodeId === nodeId) onStatusRef.current(event.status)
    })
    return () => {
      off()
      if (houseId) leaveHouse(houseId)
      else if (zoneId) leaveZone(zoneId)
    }
  }, [houseId, zoneId, nodeId])
}

// pollMs: đọc lại tới khi config_sync là APPLIED hoặc UNKNOWN
export function useSensorNode(id: string | undefined, pollMs?: number) {
  return useQuery({
    queryKey: ['sensor-nodes', 'detail', id],
    queryFn: () => deviceApi.getSensorNode(id!).then(response => response.data.data),
    enabled: Boolean(id),
    refetchInterval: query => {
      const sync = query.state.data?.config_sync
      return pollMs && sync !== 'APPLIED' && sync !== 'UNKNOWN' ? pollMs : false
    },
  })
}

// mọi thiết bị kèm farm, nhà, khu vực; chỉ Admin gọi được (enabled = false với role khác)
export function useSystemNodeStatus(enabled = true) {
  return useQuery({
    queryKey: ['system-node-status'],
    queryFn: () => deviceApi.getSystemStatus().then(r => r.data.data),
    refetchInterval: 30_000, // trang "xem nhanh": tự làm mới thay vì bắt người xem F5
    enabled,
  })
}

export function useControlRelay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, relayName, state, durationMs, confirmed }: { nodeId: string; relayName: RelayName; state: boolean; durationMs?: number; confirmed?: boolean }) =>
      deviceApi.controlRelay(nodeId, relayName, state, durationMs, confirmed),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}

export function useClearRelayOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, relayName }: { nodeId: string; relayName?: RelayName }) => deviceApi.clearRelayOverride(nodeId, relayName),
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

// gửi lệnh từ xa (RESTART / PUSH_CONFIG / OTA) tới 1 sensor node
export function useSendNodeCommand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: NodeCommandInput }) =>
      deviceApi.sendCommand(nodeId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}

// Đang ONLINE thì gửi force sau khi người dùng xác nhận
export function useDecommissionDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, reason, force }: { nodeId: string; reason: string; force: boolean }) =>
      deviceApi.decommissionSensorNode(nodeId, reason, force),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}

// Farm Owner thay bộ điều khiển hỏng bằng thiết bị mới cùng Zone (mã kích hoạt trên nhãn thiết bị mới)
export function useReplaceSensorNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: ReplaceSensorNodeInput }) =>
      deviceApi.replaceSensorNode(nodeId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}

// Farm Owner dời bộ điều khiển sang Zone khác
export function useReassignZone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, zoneId }: { nodeId: string; zoneId: string }) => deviceApi.reassignZone(nodeId, zoneId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}
