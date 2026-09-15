import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { telemetryApi } from '@/services/api'
import { joinZone, leaveZone, onTelemetryUpdate } from '@/services/socket'
import { useSocket } from './useSocket'
import type { TelemetryUpdateEvent } from '@/types'

/** useTelemetry – giá trị mới nhất qua REST, sau đó realtime qua Socket.io (ENV-FR-004/005) */
export function useTelemetry(zoneId: string | undefined) {
  useSocket()
  const queryClient = useQueryClient()
  const [live, setLive] = useState<TelemetryUpdateEvent | null>(null)

  const query = useQuery({
    queryKey: ['telemetry', 'latest', zoneId],
    queryFn: () => telemetryApi.getLatest(zoneId!).then(r => r.data.data),
    enabled: !!zoneId,
    retry: false,
  })

  useEffect(() => {
    if (!zoneId) return
    setLive(null)
    joinZone(zoneId)
    const off = onTelemetryUpdate(data => {
      if (data.zoneId !== zoneId) return
      setLive(data)
      void queryClient.invalidateQueries({ queryKey: ['telemetry', 'latest', zoneId] })
    })
    return () => {
      leaveZone(zoneId)
      off()
    }
  }, [zoneId, queryClient])

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    data: {
      temperature: live?.temperature ?? query.data?.temperature,
      humidity:    live?.humidity    ?? query.data?.humidity,
      light_lux:   live?.light       ?? query.data?.light_lux,
      nh3_ppm:     live?.nh3         ?? query.data?.nh3_ppm,
      co2_ppm:     live?.co2         ?? query.data?.co2_ppm,
      sound_db:    live?.sound       ?? query.data?.sound_db,
      timestamp:   live?.timestamp   ?? query.data?.timestamp,
    },
    relayStates: live?.relayStates,
    controlMode: live?.controlMode,
    isLive: !!live,
  }
}
