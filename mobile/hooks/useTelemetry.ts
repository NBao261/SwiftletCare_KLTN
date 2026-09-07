import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, useCallback } from 'react'
import { telemetryApi } from '@/services/api/telemetry'
import { joinZone, leaveZone, onTelemetryUpdate } from '@/services/socket'
import type { TelemetryRecord, WsTelemetryUpdate } from '@/types'

export function useLatestTelemetry(zoneId: string) {
  return useQuery({
    queryKey: ['telemetry', 'latest', zoneId],
    queryFn:  () => telemetryApi.getLatest(zoneId).then(r => r.data),
    refetchInterval: 30_000,
    enabled: !!zoneId,
  })
}

export function useLiveTelemetry(zoneId: string) {
  const [live, setLive] = useState<WsTelemetryUpdate | null>(null)

  useEffect(() => {
    if (!zoneId) return
    joinZone(zoneId)
    onTelemetryUpdate(data => {
      if (data.zoneId === zoneId) setLive(data)
    })
    return () => { leaveZone(zoneId) }
  }, [zoneId])

  return live
}

export function useTelemetryHistory(zoneId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['telemetry', 'history', zoneId, from, to],
    queryFn:  () => telemetryApi.getHistory(zoneId, from, to).then(r => r.data),
    enabled:  !!zoneId,
  })
}
