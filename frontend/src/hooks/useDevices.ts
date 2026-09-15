import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api'
import { onRelayUpdate, onDeviceStatusChange } from '@/services/socket'
import { useSocket } from './useSocket'
import type { RelayName } from '@/types'

/** useSensorNodes – danh sách device + realtime status/relay qua socket (FARM-FR-005, ENV-FR-015) */
export function useSensorNodes(zoneId?: string) {
  useSocket()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['sensor-nodes', zoneId],
    queryFn: () => deviceApi.listSensorNodes(zoneId).then(r => r.data.data),
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

export function useControlRelay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, relayName, state, durationMs }: { nodeId: string; relayName: RelayName; state: boolean; durationMs?: number }) =>
      deviceApi.controlRelay(nodeId, relayName, state, durationMs),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] }),
  })
}
